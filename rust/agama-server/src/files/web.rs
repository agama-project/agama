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

//! This module implements the web API for the files deployment.
//!
//! The module offers one public function:
//!
//! * `files_service` which returns the Axum service.
//!
//! stream is not needed, as we do not need to emit signals (for NOW).

use std::sync::Arc;

use agama_lib::{
    error::ServiceError,
    files::{error::FileError, model::FileSettings, settings::FilesConfig},
};
use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{post, put},
    Json, Router,
};
use serde_json::json;
use tokio::sync::RwLock;

use thiserror::Error;

#[derive(Error, Debug)]
#[error("Files error: {0}")]
struct FilesServiceError(#[from] FileError);

impl IntoResponse for FilesServiceError {
    fn into_response(self) -> Response {
        let body = json!({
            "error": self.to_string()
        });
        (StatusCode::BAD_REQUEST, Json(body)).into_response()
    }
}

#[derive(Clone, Default, Debug)]
struct FilesState {
    files: Arc<RwLock<FilesConfig>>,
}

/// Sets up and returns the axum service for the files module.
pub async fn files_service() -> Result<Router, ServiceError> {
    let state = FilesState::default();
    let router = Router::new()
        .route("/", put(set_config).get(get_config))
        .route("/write", post(write_config))
        .with_state(state);
    Ok(router)
}

/// Returns the bootloader configuration.
///
/// * `state` : service state.
#[utoipa::path(
    get,
    path = "/",
    context_path = "/api/files",
    responses(
        (status = 200, description = "files configuration"),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn get_config(
    State(state): State<FilesState>,
) -> Result<Json<Vec<FileSettings>>, FilesServiceError> {
    // StorageSettings is just a wrapper over serde_json::value::RawValue
    let settings = state.files.read().await;
    Ok(Json(settings.files.to_vec()))
}

/// Sets the files configuration.
///
/// * `state`: service state.
/// * `config`: files configuration.
#[utoipa::path(
    put,
    path = "/",
    context_path = "/api/files",
    responses(
        (status = 200, description = "Set the files configuration"),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn set_config(
    State(state): State<FilesState>,
    Json(settings): Json<Vec<FileSettings>>,
) -> Result<Json<()>, FilesServiceError> {
    let mut files = state.files.write().await;
    files.files = settings;
    Ok(Json(()))
}

/// Writes the files.
///
/// * `state`: service state.
#[utoipa::path(
    put,
    path = "/write",
    context_path = "/api/files",
    responses(
        (status = 200, description = "Writes the files"),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn write_config(State(state): State<FilesState>) -> Result<Json<()>, FilesServiceError> {
    let files = state.files.read().await;
    for file in files.files.iter() {
        file.write().await?;
    }
    Ok(Json(()))
}
