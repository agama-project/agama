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

use agama_software::model::state::{Repository as StateRepository, SoftwareState};
use agama_software::zypp_server::{SoftwareAction, ZyppServer, ZyppServerResult};
use agama_utils::actor;
use agama_utils::api::event::Event;
use agama_utils::api::Issue;
use agama_utils::progress;
use agama_utils::question;
use glob::glob;
use std::fs;
use std::path::Path;
use std::result::Result;
use tokio::sync::{broadcast, oneshot};
use tracing_subscriber;

fn clean_leftover_repos(root_dir: &Path) {
    let repo_dir = root_dir.join("etc/zypp/repos.d/");

    for path in glob(&format!("{}/*.repo", repo_dir.display()))
        // unwrap OK: literal pattern syntax is correct
        .unwrap()
        .filter_map(Result::ok)
    {
        let _ = fs::remove_file(path);
    }
}
#[tokio::test]
async fn test_start_zypp_server() {
    let _ = tracing_subscriber::fmt::try_init();

    let root_dir =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../zypp-agama/fixtures/zypp_repos_root");
    clean_leftover_repos(&root_dir);

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

    let repo_s = StateRepository {
        name: "signed_repo".to_string(),
        alias: "signed_repo".to_string(),
        url: root_dir
            .join("usr/share/signed_repo")
            .to_string_lossy()
            .to_string(),
        enabled: true,
    };

    let software_state = SoftwareState {
        product: "test_product".to_string(),
        repositories: vec![repo_s],
        resolvables: vec![],
        options: Default::default(),
    };

    client
        .send(SoftwareAction::Write {
            state: software_state,
            progress: progress_handler,
            question: question_handler.clone(),
            tx,
        })
        .expect("Failed to send SoftwareAction::Write");

    let result: ZyppServerResult<Vec<Issue>> =
        rx.await.expect("Failed to receive response from server");
    assert!(
        result.is_ok(),
        "SoftwareAction::Write failed: {:?}",
        result.unwrap_err()
    );
    let issues = result.unwrap();
    assert_eq!(issues, vec![]);

    // Check for the verification failed question
    let questions = question_handler
        .call(question::message::Get)
        .await
        .expect("Failed to get questions");
    assert_eq!(
        questions.len(),
        1,
        "Expected one question, but got {}",
        questions.len()
    );
    let question = &questions[0];
    assert_eq!(question.spec.class, "software.verification_failed");
}
