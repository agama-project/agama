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
    bootloader::web::bootloader_service,
    error::Error,
    files::web::files_service,
    hostname::web::hostname_service,
    manager::web::{manager_service, manager_stream},
    network::{web::network_service, NetworkManagerAdapter},
    profile::web::profile_service,
    scripts::web::scripts_service,
    security::security_service,
    server::server_service,
    storage::web::{iscsi::iscsi_service, storage_service, storage_streams},
    users::web::{users_service, users_streams},
    web::common::{jobs_stream, service_status_stream},
};
use agama_utils::api::event;
use axum::Router;

mod auth;
pub mod common;
mod config;
pub mod docs;
mod http;
mod service;
mod state;
mod ws;

use agama_lib::connection;
use agama_lib::error::ServiceError;
use agama_lib::http::event::{OldEvent, OldSender};
use common::ProgressService;
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
    old_events: OldSender,
    dbus: zbus::Connection,
    web_ui_dir: P,
) -> Result<Router, ServiceError>
where
    P: AsRef<Path>,
{
    let network_adapter = NetworkManagerAdapter::from_system()
        .await
        .expect("Could not connect to NetworkManager to read the configuration");

    let progress = ProgressService::start(dbus.clone(), old_events.clone()).await;

    let router = MainServiceBuilder::new(events.clone(), old_events.clone(), web_ui_dir)
        .add_service(
            "/manager",
            manager_service(dbus.clone(), progress.clone()).await?,
        )
        .add_service("/v2", server_service(events, dbus.clone()).await?)
        .add_service("/security", security_service(dbus.clone()).await?)
        .add_service("/storage", storage_service(dbus.clone(), progress).await?)
        .add_service("/iscsi", iscsi_service(dbus.clone()).await?)
        .add_service("/bootloader", bootloader_service(dbus.clone()).await?)
        .add_service(
            "/network",
            network_service(network_adapter, old_events).await?,
        )
        .add_service("/users", users_service(dbus.clone()).await?)
        .add_service("/scripts", scripts_service().await?)
        .add_service("/files", files_service().await?)
        .add_service("/hostname", hostname_service().await?)
        .add_service("/profile", profile_service().await?)
        .with_config(config)
        .build();
    Ok(router)
}

/// Starts monitoring the D-Bus service progress.
///
/// The events are sent to the `events` channel.
///
/// * `events`: channel to send the events to.
pub async fn run_monitor(events: OldSender) -> Result<(), ServiceError> {
    let connection = connection().await?;
    tokio::spawn(run_events_monitor(connection, events.clone()));

    Ok(())
}

/// Emits the events from the system streams through the events channel.
///
/// * `connection`: D-Bus connection.
/// * `events`: channel to send the events to.
async fn run_events_monitor(dbus: zbus::Connection, events: OldSender) -> Result<(), Error> {
    let mut stream = StreamMap::new();

    stream.insert("manager", manager_stream(dbus.clone()).await?);
    stream.insert(
        "manager-status",
        service_status_stream(
            dbus.clone(),
            "org.opensuse.Agama.Manager1",
            "/org/opensuse/Agama/Manager1",
        )
        .await?,
    );
    for (id, user_stream) in users_streams(dbus.clone()).await? {
        stream.insert(id, user_stream);
    }
    for (id, storage_stream) in storage_streams(dbus.clone()).await? {
        stream.insert(id, storage_stream);
    }
    stream.insert(
        "storage-status",
        service_status_stream(
            dbus.clone(),
            "org.opensuse.Agama.Storage1",
            "/org/opensuse/Agama/Storage1",
        )
        .await?,
    );
    stream.insert(
        "storage-jobs",
        jobs_stream(
            dbus.clone(),
            "org.opensuse.Agama.Storage1",
            "/org/opensuse/Agama/Storage1",
            "/org/opensuse/Agama/Storage1/jobs",
        )
        .await?,
    );

    tokio::pin!(stream);
    let e = events.clone();
    while let Some((_, event)) = stream.next().await {
        _ = e.send(event);
    }
    Ok(())
}
