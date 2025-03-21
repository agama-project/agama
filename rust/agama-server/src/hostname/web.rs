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

//! This module implements the web API for the hostname service.
//!
//! The module offers one public function:
//!
//! * `hostname_service` which returns the Axum service.
//!
//! stream is not needed, as we do not need to emit signals (for NOW).

use agama_lib::{
    error::ServiceError,
    hostname::{client::HostnameClient, model::HostnameSettings},
};
use axum::{extract::State, routing::put, Json, Router};

use crate::error;

#[derive(Clone)]
struct HostnameState<'a> {
    client: HostnameClient<'a>,
}

/// Sets up and returns the axum service for the hostname module.
pub async fn hostname_service() -> Result<Router, ServiceError> {
    let client = HostnameClient::new().await?;
    let state = HostnameState { client };
    let router = Router::new()
        .route("/config", put(set_config).get(get_config))
        .with_state(state);
    Ok(router)
}

/// Returns the hostname configuration.
///
/// * `state` : service state.
#[utoipa::path(
    get,
    path = "/config",
    context_path = "/api/hostname",
    operation_id = "get_hostname_config",
    responses(
        (status = 200, description = "hostname configuration", body = HostnameSettings),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn get_config(
    State(state): State<HostnameState<'_>>,
) -> Result<Json<HostnameSettings>, error::Error> {
    // HostnameSettings is just a wrapper over serde_json::value::RawValue
    let settings = state.client.get_config().await?;
    Ok(Json(settings))
}

/// Sets the hostname configuration.
///
/// * `state`: service state.
/// * `config`: hostname configuration.
#[utoipa::path(
    put,
    path = "/config",
    context_path = "/api/hostname",
    operation_id = "set_hostname_config",
    responses(
        (status = 200, description = "Set the hostname configuration"),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn set_config(
    State(state): State<HostnameState<'_>>,
    Json(settings): Json<HostnameSettings>,
) -> Result<Json<()>, error::Error> {
    state.client.set_config(&settings).await?;
    Ok(Json(()))
}
