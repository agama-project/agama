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

use agama_security as security;
use agama_software::state::{Repository as StateRepository, ResolvableSelection, SoftwareState};
use agama_software::zypp_server::{SoftwareAction, ZyppServer, ZyppServerResult};
use agama_software::{Resolvable, WriteIssues};
use agama_utils::{
    actor,
    api::{
        event::Event,
        question::{Answer, AnswerRule, Config},
    },
    progress, question, ResolvableType,
};
use camino::{Utf8Path, Utf8PathBuf};
use glob::glob;
use std::fs;
use std::path::Path;
use std::result::Result;
use tokio::sync::{broadcast, oneshot};

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
    cleanup_past_leftovers(root_dir.as_std_path());
    let zypp_root =
        Utf8Path::new(env!("CARGO_MANIFEST_DIR")).join("../zypp-agama/fixtures/zypp_root_tmp");

    let install_dir = Utf8PathBuf::from("/mnt");
    let cmdline = Default::default();
    let client =
        ZyppServer::start(&zypp_root, &install_dir, &cmdline).expect("starting zypp server failed");

    // Setup event broadcast channel
    let (event_tx, _event_rx) = broadcast::channel::<Event>(100); // Buffer size 100

    // Spawn progress service
    let progress_service_starter = progress::service::Starter::new(event_tx.clone());
    let progress_handler = progress_service_starter.start();

    // Spawn question service
    let question_service = question::service::Service::new(event_tx.clone());
    let question_handler = actor::spawn(question_service);

    // Spawn the security service
    let security_service_starter = security::service::Starter::new(question_handler.clone());
    let security_handler = security_service_starter.start().unwrap();

    // Pre-configure the answer to the GPG key question
    let answer = Answer {
        action: "Trust".to_string(),
        value: None,
    };
    let rule = AnswerRule {
        class: Some("importGpg".to_string()),
        text: None,
        data: None,
        answer,
    };
    let config = Config {
        policy: None,
        answers: Some(vec![rule]),
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
        priority: None,
        autorefresh: true,
    };

    let mut software_state = SoftwareState::new("test_product");
    software_state.repositories = vec![repo_s];

    client
        .send(SoftwareAction::Write {
            state: software_state,
            progress: progress_handler.clone(),
            l10n: None,
            question: question_handler.clone(),
            security: security_handler.clone(),
            tx,
        })
        .expect("Failed to send SoftwareAction::Write");

    let result: ZyppServerResult<WriteIssues> =
        rx.await.expect("Failed to receive response from server");
    assert!(
        result.is_ok(),
        "SoftwareAction::Write failed: {:?}",
        result.unwrap_err()
    );
    let issues = result.unwrap();
    assert_eq!(
        issues.software.len(),
        1,
        "There are unexpected issues size {issues:#?}"
    );
    assert_eq!(issues.software[0].class, "missingProduct");

    // Test with repository where refresh fails and packages cannot be selected
    let (tx2, rx2) = oneshot::channel();
    let invalid_repo = StateRepository {
        name: "invalid_repo".to_string(),
        alias: "invalid_repo".to_string(),
        url: "dir:/non/existent/path".to_string(),
        enabled: true,
        priority: None,
        autorefresh: true,
    };
    let mut software_state2 = SoftwareState::new("test_product");
    software_state2.repositories = vec![invalid_repo];
    software_state2.resolvables.add_or_replace_resolvable(
        &Resolvable::new("test-package", ResolvableType::Package),
        ResolvableSelection::Selected,
    );

    client
        .send(SoftwareAction::Write {
            state: software_state2,
            progress: progress_handler,
            l10n: None,
            question: question_handler.clone(),
            security: security_handler,
            tx: tx2,
        })
        .expect("Failed to send SoftwareAction::Write with invalid repo");

    let result2: ZyppServerResult<WriteIssues> =
        rx2.await.expect("Failed to receive response from server");
    assert!(
        result2.is_ok(),
        "SoftwareAction::Write failed: {:?}",
        result2.unwrap_err()
    );
    let issues2 = result2.unwrap();
    assert!(
        issues2.software.iter().any(|i| i.class == "loadSource"),
        "Expected loadSource issue, got: {issues2:#?}"
    );
    assert!(
        !issues2
            .software
            .iter()
            .any(|i| i.class == "selectResolvable"),
        "Expected no selectResolvable issue when repo refresh failed, got: {issues2:#?}"
    );

    let questions = question_handler
        .call(question::message::Get)
        .await
        .expect("Failed to get questions");
    assert!(questions.is_empty());

    // NOTE: here we drop sender channel, which result in exit of zypp thread due to closed channel
}
