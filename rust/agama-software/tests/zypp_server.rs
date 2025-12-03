// Copyright (c) [2025] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

use agama_software::zypp_server::{SoftwareAction, ZyppServer, ZyppServerResult};
use agama_utils::actor;
use agama_utils::progress;
use agama_utils::question;
use agama_utils::api::event::Event;
use agama_utils::api::Issue;
use agama_software::model::state::{SoftwareState, Repository as StateRepository};
use std::path::Path;
use tokio::sync::{oneshot, broadcast};

#[tokio::test]
async fn test_start_zypp_server() {
    let root_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../zypp-agama/fixtures/zypp_root");
    let client = ZyppServer::start(&root_dir).expect("starting zypp server failed");

    // Setup event broadcast channel
    let (event_tx, _event_rx) = broadcast::channel::<Event>(100); // Buffer size 100

    // Spawn progress service
    let progress_service_starter = progress::service::Starter::new(event_tx.clone());
    let progress_handler = progress_service_starter.start();

    // Spawn question service
    let question_service = question::service::Service::new(event_tx.clone());
    let question_handler = actor::spawn(question_service);

    let (tx, rx) = oneshot::channel();

    let repo = StateRepository {
        name: "signed_repo".to_string(),
        alias: "signed_repo".to_string(),
        url: "/usr/share/signed_repo".to_string(), // Relative to root_dir
        enabled: true,
    };

    let software_state = SoftwareState {
        product: "test_product".to_string(),
        repositories: vec![repo],
        resolvables: vec![],
        options: Default::default(),
    };

    client.send(SoftwareAction::Write {
        state: software_state,
        progress: progress_handler,
        question: question_handler,
        tx,
    }).expect("Failed to send SoftwareAction::Write");

    let result: ZyppServerResult<Vec<Issue>> = rx.await.expect("Failed to receive response from server");
    assert!(result.is_ok(), "SoftwareAction::Write failed: {:?}", result.unwrap_err());
}
