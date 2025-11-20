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

//! This module implements a set of utilities for tests.

use agama_l10n::test_utils::start_service as start_l10n_service;
use agama_network::test_utils::start_service as start_network_service;
use agama_storage::test_utils::start_service as start_storage_service;
use agama_utils::{actor::Handler, api::event, issue, progress, question};

use crate::Service;

/// Starts a testing manager service.
pub async fn start_service(events: event::Sender, dbus: zbus::Connection) -> Handler<Service> {
    let issues = issue::Service::starter(events.clone()).start();
    let questions = question::start(events.clone()).await.unwrap();
    let progress = progress::Service::starter(events.clone()).start();

    Service::starter(questions, events.clone(), dbus.clone())
        .with_l10n(start_l10n_service(events.clone(), issues.clone()).await)
        .with_storage(start_storage_service(events, issues, progress, dbus).await)
        .with_network(start_network_service().await)
        .start()
        .await
        .expect("Could not spawn a testing manager service")
}
