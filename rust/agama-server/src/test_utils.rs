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

use std::path::PathBuf;

use agama_lib::error::ServiceError;
use agama_utils::{api::event, question};
use aide::axum::ApiRouter;

use crate::{
    server::{server_with_state, web::ServerState},
    web::{MainServiceBuilder, ServiceConfig},
};

/// It builds a router to be used in tests and when generating OpenAPI documentation.
pub async fn router(
    events: event::Sender,
    dbus: zbus::Connection,
) -> Result<ApiRouter, ServiceError> {
    let share_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share");
    std::env::set_var("AGAMA_SHARE_DIR", share_dir.display().to_string());

    let config = ServiceConfig {
        jwt_secret: "dummy".to_string(),
    };
    let manager = agama_manager::test_utils::start_service(events.clone(), dbus).await;
    let questions = question::start(events.clone())
        .await
        .expect("Failed to start the questions service");
    let state = ServerState::new(manager, questions);
    let server = server_with_state(state).expect("Failed to build the testing server");

    let router = MainServiceBuilder::new(events.clone(), share_dir.join("public"))
        .add_service("/v2", server)
        .with_config(config)
        .build();
    Ok(router)
}
