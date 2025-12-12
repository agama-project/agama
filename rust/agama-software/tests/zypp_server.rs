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

use agama_software::state::{Repository as StateRepository, SoftwareState};
use agama_software::zypp_server::{SoftwareAction, ZyppServer, ZyppServerResult};
use agama_utils::actor;
use agama_utils::api::event::Event;
use agama_utils::api::question::{Answer, AnswerRule, Config};
use agama_utils::api::Issue;
use agama_utils::progress;
use agama_utils::question;
use camino::Utf8Path;
use glob::glob;
use std::fs;
use std::path::Path;
use std::result::Result;
use tokio::sync::{broadcast, oneshot};
use tracing_subscriber;

fn cleanup_past_leftovers(root_dir: &Path) {
    remove_repos(root_dir);
    remove_rpmdb(root_dir);
}

fn remove_repos(root_dir: &Path) {
    let repo_dir = root_dir.join("etc/zypp/repos.d/");

    for path in glob(&format!("{}/*.repo", repo_dir.display()))
        // unwrap OK: literal pattern syntax is correct
        .unwrap()
        .filter_map(Result::ok)
    {
        fs::remove_file(path).expect("failed to remove repo file");
    }
}

fn remove_rpmdb(root_dir: &Path) {
    let rpmdb_dir = root_dir.join("usr/lib/sysimage/rpm/");
    if fs::exists(&rpmdb_dir).unwrap_or(false) {
        fs::remove_dir_all(rpmdb_dir).expect("removing RPM data failed");
    }
}

#[tokio::test]
async fn test_start_zypp_server() {
    let _ = tracing_subscriber::fmt::try_init();

    let root_dir =
        Utf8Path::new(env!("CARGO_MANIFEST_DIR")).join("../zypp-agama/fixtures/zypp_repos_root");
    cleanup_past_leftovers(&root_dir.as_std_path());
    let zypp_root =
        Utf8Path::new(env!("CARGO_MANIFEST_DIR")).join("../zypp-agama/fixtures/zypp_root_tmp");

    let client = ZyppServer::start(&zypp_root).expect("starting zypp server failed");

    // Setup event broadcast channel
    let (event_tx, _event_rx) = broadcast::channel::<Event>(100); // Buffer size 100

    // Spawn progress service
    let progress_service_starter = progress::service::Starter::new(event_tx.clone());
    let progress_handler = progress_service_starter.start();

    // Spawn question service
    let question_service = question::service::Service::new(event_tx.clone());
    let question_handler = actor::spawn(question_service);

    // Pre-configure the answer to the GPG key question
    let answer = Answer {
        action: "Trust".to_string(),
        value: None,
    };
    let rule = AnswerRule {
        class: Some("software.import_gpg".to_string()),
        text: None,
        data: None,
        answer,
    };
    let config = Config {
        policy: None,
        answers: vec![rule],
    };
    question_handler
        .call(question::message::SetConfig::new(Some(config)))
        .await
        .unwrap();

    let (tx, rx) = oneshot::channel();

    let repo_s = StateRepository {
        name: "signed_repo".to_string(),
        alias: "signed_repo".to_string(),
        url: root_dir.join("usr/share/signed_repo").to_string(),
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
    assert_eq!(
        result.is_ok(),
        true,
        "SoftwareAction::Write failed: {:?}",
        result.unwrap_err()
    );
    let issues = result.unwrap();
    assert_eq!(
        issues.len(),
        1,
        "There are unexpected issues size {issues:#?}"
    );
    assert_eq!(issues[0].class, "software.select_product");

    let questions = question_handler
        .call(question::message::Get)
        .await
        .expect("Failed to get questions");
    assert!(questions.is_empty());

    // NOTE: here we drop sender channel, which result in exit of zypp thread due to closed channel
}
