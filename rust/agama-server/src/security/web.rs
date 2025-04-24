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

//! This module implements the web API for the software service.
//!
//! The module offers two public functions:
//!
//! * `security_service` which returns the Axum service.

use crate::error::Error;
use agama_lib::{
    error::ServiceError,
    security::{client::SecurityClient, model::SSLFingerprint},
};
use axum::{extract::State, routing::get, Json, Router};

#[derive(Clone)]
struct SecurityState<'a> {
    client: SecurityClient<'a>,
}

/// Sets up and returns the axum service for the software module.
pub async fn security_service(dbus: zbus::Connection) -> Result<Router, ServiceError> {
    let client = SecurityClient::new(dbus.clone()).await?;
    let state = SecurityState { client };
    let router = Router::new()
        .route(
            "/ssl_fingerprints",
            get(get_fingerprints).put(set_fingerprints),
        )
        .with_state(state);
    Ok(router)
}

/// Returns the list of defined ssl fingerprints.
///
/// * `state`: service state.
#[utoipa::path(
    get,
    path = "/ssl_fingerprints",
    context_path = "/api/security",
    responses(
        (status = 200, description = "List of known ssl fingerprints", body = Vec<SSLFingerprint>),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn get_fingerprints(
    State(state): State<SecurityState<'_>>,
) -> Result<Json<Vec<SSLFingerprint>>, Error> {
    let products = state.client.get_ssl_fingerprints().await?;
    Ok(Json(products))
}

/// Sets the list of SSL fingerprints.
///
/// * `state`: service state.
#[utoipa::path(
    put,
    path = "/ssl_fingerprints",
    context_path = "/api/security",
    responses(
        (status = 200, description = "SSL fingerprints were set properly."),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn set_fingerprints(
    State(state): State<SecurityState<'_>>,
    Json(fingerprints): Json<Vec<SSLFingerprint>>,
) -> Result<(), Error> {
    state.client.set_ssl_fingerprints(&fingerprints).await?;
    Ok(())
}
