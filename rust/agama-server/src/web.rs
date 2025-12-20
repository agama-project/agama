// Copyright (c) [2024] SUSE LLC
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

//! This module implements a web-based API for Agama. It is responsible for:
//!
//! * Exposing an HTTP API to interact with Agama.
//! * Emit relevant events via websocket.
//! * Serve the code for the web user interface (not implemented yet).

use crate::{
    bootloader::web::bootloader_service, error::Error, hostname::web::hostname_service,
    profile::web::profile_service, security::security_service, server::server_service,
    users::web::users_service,
};
use agama_utils::api::event;
use axum::Router;

mod auth;
mod config;
pub mod docs;
mod http;
mod service;
mod state;
mod ws;

use agama_lib::connection;
use agama_lib::error::ServiceError;
pub use config::ServiceConfig;
pub use service::MainServiceBuilder;
use std::path::Path;
use tokio_stream::{StreamExt, StreamMap};

/// Returns a service that implements the web-based Agama API.
///
/// * `config`: service configuration.
/// * `events`: channel to send the events through the WebSocket.
/// * `dbus`: D-Bus connection.
/// * `web_ui_dir`: public directory containing the web UI.
pub async fn service<P>(
    config: ServiceConfig,
    events: event::Sender,
    dbus: zbus::Connection,
    web_ui_dir: P,
) -> Result<Router, ServiceError>
where
    P: AsRef<Path>,
{
    let router = MainServiceBuilder::new(events.clone(), web_ui_dir)
        .add_service("/v2", server_service(events, dbus.clone()).await?)
        .add_service("/security", security_service(dbus.clone()).await?)
        .add_service("/bootloader", bootloader_service(dbus.clone()).await?)
        .add_service("/users", users_service(dbus.clone()).await?)
        .add_service("/hostname", hostname_service().await?)
        .add_service("/profile", profile_service().await?)
        .with_config(config)
        .build();
    Ok(router)
}
