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

use crate::profile::profile_service;
use crate::server::{
    server_with_state,
    web::{Error, ServerState},
};
use crate::terminal::terminal_service;
use agama_mcp::McpMode;
use agama_utils::api::event;
use agama_utils::question;
use aide::axum::ApiRouter;

mod auth;
mod config;
pub mod docs;
pub mod error;
mod http;
mod service;
mod state;
mod ws;

pub use config::ServiceConfig;
pub use service::MainServiceBuilder;
use std::path::Path;

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
) -> Result<ApiRouter, Error>
where
    P: AsRef<Path>,
{
    service_with_mcp(config, events, dbus, web_ui_dir, None).await
}

/// Returns a service that implements the web-based Agama API with optional MCP server mode.
///
/// * `config`: service configuration.
/// * `events`: channel to send the events through the WebSocket.
/// * `dbus`: D-Bus connection.
/// * `web_ui_dir`: public directory containing the web UI.
/// * `mcp_mode`: optional MCP mode override; if None, parsed from the kernel command-line.
pub async fn service_with_mcp<P>(
    config: ServiceConfig,
    events: event::Sender,
    dbus: zbus::Connection,
    web_ui_dir: P,
    mcp_mode: Option<McpMode>,
) -> Result<ApiRouter, Error>
where
    P: AsRef<Path>,
{
    let mode = mcp_mode.unwrap_or_else(McpMode::from_cmdline);
    let questions = question::start(events.clone()).await?;
    let manager = agama_manager::Service::starter(questions.clone(), events.clone(), dbus)
        .start()
        .await?;
    let profile = profile_service().await;
    let state = ServerState::new(manager.clone(), questions.clone());
    let server = server_with_state(state, profile)?;

    let mut builder = MainServiceBuilder::new(events.clone(), web_ui_dir)
        .add_service("/", server)
        .add_service("/terminal", terminal_service())
        .with_config(config);

    if mode.is_enabled() {
        tracing::info!("Mounting Agama MCP server in {} mode at /mcp", mode);
        let mcp_server = agama_mcp::McpServer::new(manager, questions, mode);
        let mcp_router = agama_mcp::web::mcp_router(mcp_server);
        builder = builder.with_mcp_service(mcp_router);
    }

    Ok(builder.build())
}
