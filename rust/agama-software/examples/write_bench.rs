// Copyright (c) [2026] SUSE LLC
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
use agama_software::state::SoftwareStateBuilder;
use agama_software::zypp_server::{SoftwareAction, ZyppServer, ZyppServerResult};
use agama_utils::api::question::{Answer, AnswerRule, Config};
use agama_utils::api::software::SoftwareConfig;
use agama_utils::products::Registry;
use agama_utils::{
    actor,
    api::{event::Event, Issue},
    progress, question,
};
use camino::{Utf8Path, Utf8PathBuf};
use glob::glob;
use std::fs;
use std::path::Path;
use std::result::Result;
use std::time::SystemTime;
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

#[tokio::main]
async fn main() {
    let now = SystemTime::now();
    println!("now: {:?}", now);

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
        answers: Some(vec![rule]),
    };
    question_handler
        .call(question::message::SetConfig::new(Some(config)))
        .await
        .unwrap();

    // Spawn the security service
    let security_service_starter = security::service::Starter::new(question_handler.clone());
    let security_handler = security_service_starter.start().unwrap();

    let (tx, rx) = oneshot::channel();

    let product_dir = Utf8Path::new(env!("CARGO_MANIFEST_DIR")).join("../../products.d");
    let mut registry = Registry::new(product_dir);
    registry.read().unwrap();
    let product = registry.find("Tumbleweed", None).unwrap();
    let software_state = SoftwareStateBuilder::for_product(&product).build();

    println!(
        "before first write: {:?}ms",
        now.elapsed().unwrap().as_millis()
    );
    let now = SystemTime::now();
    client
        .send(SoftwareAction::Write {
            state: software_state,
            progress: progress_handler.clone(),
            question: question_handler.clone(),
            security: security_handler.clone(),
            tx,
        })
        .expect("Failed to send SoftwareAction::Write");

    let result: ZyppServerResult<Vec<Issue>> =
        rx.await.expect("Failed to receive response from server");
    if let Err(err) = result {
        panic!("SoftwareAction::Write failed: {:?}", err);
    }
    println!(
        "after first write: {:?}ms",
        now.elapsed().unwrap().as_millis()
    );

    let config = agama_utils::api::software::Config {
        software: Some(SoftwareConfig {
            patterns: Some(agama_utils::api::software::PatternsConfig::PatternsMap(
                agama_utils::api::software::PatternsMap {
                    add: Some(vec!["gnome".to_string()]),
                    remove: None,
                },
            )),
            ..Default::default()
        }),
        ..Default::default()
    };
    let software_state = SoftwareStateBuilder::for_product(&product)
        .with_config(&config)
        .build();
    let (tx, rx) = oneshot::channel();

    let now = SystemTime::now();
    client
        .send(SoftwareAction::Write {
            state: software_state,
            progress: progress_handler.clone(),
            question: question_handler.clone(),
            security: security_handler.clone(),
            tx,
        })
        .expect("Failed to send SoftwareAction::Write");

    let result: ZyppServerResult<Vec<Issue>> =
        rx.await.expect("Failed to receive response from server");
    if let Err(err) = result {
        panic!("SoftwareAction::Write failed: {:?}", err);
    }
    println!(
        "after second write: {:?}ms",
        now.elapsed().unwrap().as_millis()
    );

    let software_state = SoftwareStateBuilder::for_product(&product).build();
    let (tx, rx) = oneshot::channel();

    let now = SystemTime::now();
    client
        .send(SoftwareAction::Write {
            state: software_state,
            progress: progress_handler.clone(),
            question: question_handler.clone(),
            security: security_handler.clone(),
            tx,
        })
        .expect("Failed to send SoftwareAction::Write");

    let result: ZyppServerResult<Vec<Issue>> =
        rx.await.expect("Failed to receive response from server");
    if let Err(err) = result {
        panic!("SoftwareAction::Write failed: {:?}", err);
    }
    println!(
        "after third write: {:?}ms",
        now.elapsed().unwrap().as_millis()
    );
    // NOTE: here we drop sender channel, which result in exit of zypp thread due to closed channel
}
