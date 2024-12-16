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

//! This module implements the web API for the storage service.
//!
//! The module offers one public function:
//!
//! * `storage_service` which returns the Axum service.
//!
//! stream is not needed, as we do not need to emit signals (for NOW).

use agama_lib::{
    bootloader::{client::BootloaderClient, model::BootloaderSettings},
    error::ServiceError,
};
use axum::{extract::State, routing::put, Json, Router};

use crate::error;

#[derive(Clone)]
struct BootloaderState<'a> {
    client: BootloaderClient<'a>,
}

/// Sets up and returns the axum service for the storage module.
pub async fn bootloader_service(dbus: zbus::Connection) -> Result<Router, ServiceError> {
    let client = BootloaderClient::new(dbus).await?;
    let state = BootloaderState { client };
    let router = Router::new()
        .route("/config", put(set_config).get(get_config))
        .with_state(state);
    Ok(router)
}

/// Returns the bootloader configuration.
///
/// * `state` : service state.
#[utoipa::path(
    get,
    path = "/config",
    context_path = "/api/bootloader",
    operation_id = "get_bootloader_config",
    responses(
        (status = 200, description = "bootloader configuration", body = BootloaderSettings),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn get_config(
    State(state): State<BootloaderState<'_>>,
) -> Result<Json<BootloaderSettings>, error::Error> {
    // StorageSettings is just a wrapper over serde_json::value::RawValue
    let settings = state.client.get_config().await?;
    Ok(Json(settings))
}

/// Sets the bootloader configuration.
///
/// * `state`: service state.
/// * `config`: bootloader configuration.
#[utoipa::path(
    put,
    path = "/config",
    context_path = "/api/bootloader",
    operation_id = "set_bootloader_config",
    responses(
        (status = 200, description = "Set the bootloader configuration"),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn set_config(
    State(state): State<BootloaderState<'_>>,
    Json(settings): Json<BootloaderSettings>,
) -> Result<Json<()>, error::Error> {
    state.client.set_config(&settings).await?;
    Ok(Json(()))
}
