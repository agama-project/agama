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

//! This module implements Agama's HTTP API.

use crate::server::types::{ConfigPatch, IssuesMap};
use agama_lib::error::ServiceError;
use agama_lib::install_settings::InstallSettings;
use agama_manager::message;
use agama_manager::SystemInfo;
use agama_manager::{self as manager};
use agama_utils::actor::Handler;
use agama_utils::types::{event, Status};
use anyhow;
use axum::extract::State;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::Json;
use axum::Router;
use hyper::StatusCode;
use serde::Serialize;
use serde_json::json;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Manager(#[from] manager::service::Error),
}

impl IntoResponse for Error {
    fn into_response(self) -> Response {
        tracing::warn!("Server return error {}", self);
        let body = json!({
            "error": self.to_string()
        });
        (StatusCode::BAD_REQUEST, Json(body)).into_response()
    }
}

#[derive(Clone)]
pub struct ServerState {
    manager: Handler<manager::Service>,
}

type ServerResult<T> = Result<T, Error>;

/// Sets up and returns the axum service for the manager module
///
/// * `events`: channel to send events to the websocket.
/// * `dbus`: connection to Agama's D-Bus server. If it is not given, those features
///           that require to connect to the Agama's D-Bus server won't work.
pub async fn server_service(
    events: event::Sender,
    dbus: Option<zbus::Connection>,
) -> Result<Router, ServiceError> {
    let manager = manager::start(events, dbus)
        .await
        .map_err(|e| anyhow::Error::new(e))?;

    let state = ServerState { manager };

    Ok(Router::new()
        .route("/status", get(get_status))
        .route("/system", get(get_system))
        .route("/extended_config", get(get_extended_config))
        .route(
            "/config",
            get(get_config).put(put_config).patch(patch_config),
        )
        .route("/proposal", get(get_proposal))
        .route("/action", post(run_action))
        .route("/issues", get(get_issues))
        .with_state(state))
}

/// Returns the status of the installation.
#[utoipa::path(
    get,
    path = "/status",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Status of the installation."),
        (status = 400, description = "Not possible to retrieve the status of the installation.")
    )
)]
async fn get_status(State(state): State<ServerState>) -> ServerResult<Json<Status>> {
    let status = state.manager.call(message::GetStatus).await?;
    Ok(Json(status))
}

/// Returns the information about the system.
#[utoipa::path(
    get,
    path = "/system",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "System information."),
        (status = 400, description = "Not possible to retrieve the system information.")
    )
)]
async fn get_system(State(state): State<ServerState>) -> ServerResult<Json<SystemInfo>> {
    let system = state.manager.call(message::GetSystem).await?;
    Ok(Json(system))
}

/// Returns the extended configuration.
#[utoipa::path(
    get,
    path = "/extended_config",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Extended configuration"),
        (status = 400, description = "Not possible to retrieve the configuration.")
    )
)]
async fn get_extended_config(
    State(state): State<ServerState>,
) -> ServerResult<Json<InstallSettings>> {
    let config = state.manager.call(message::GetExtendedConfig).await?;
    Ok(Json(config))
}

/// Returns the configuration.
#[utoipa::path(
    get,
    path = "/config",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Configuration."),
        (status = 400, description = "Not possible to retrieve the configuration.")
    )
)]
async fn get_config(State(state): State<ServerState>) -> ServerResult<Json<InstallSettings>> {
    let config = state.manager.call(message::GetConfig).await?;
    Ok(Json(config))
}

/// Updates the configuration.
///
/// Replaces the whole configuration. If some value is missing, it will be removed.
#[utoipa::path(
    put,
    path = "/config",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "The configuration was replaced. Other operations can be running in background."),
        (status = 400, description = "Not possible to replace the configuration.")
    ),
    params(
        ("config" = InstallSettings, description = "Configuration to apply.")
    )
)]
async fn put_config(
    State(state): State<ServerState>,
    Json(config): Json<InstallSettings>,
) -> ServerResult<()> {
    state.manager.call(message::SetConfig::new(config)).await?;
    Ok(())
}

/// Patches the configuration.
///
/// It only changes the specified values, keeping the rest as they are.
#[utoipa::path(
    patch,
    path = "/config",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "The configuration was patched. Other operations can be running in background."),
        (status = 400, description = "Not possible to patch the configuration.")
    ),
    params(
        ("config" = InstallSettings, description = "Changes in the configuration.")
    )
)]
async fn patch_config(
    State(state): State<ServerState>,
    Json(patch): Json<ConfigPatch>,
) -> ServerResult<()> {
    if let Some(config) = patch.update {
        state
            .manager
            .call(message::UpdateConfig::new(config))
            .await?;
    }
    Ok(())
}

/// Returns how the target system is configured (proposal).
#[utoipa::path(
    get,
    path = "/proposal",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Proposal successfully retrieved."),
        (status = 400, description = "Not possible to retrieve the proposal.")
    )
)]
async fn get_proposal(State(state): State<ServerState>) -> ServerResult<Response> {
    let proposal = state.manager.call(message::GetProposal).await?;
    Ok(to_option_response(proposal))
}

/// Returns the issues for each scope.
#[utoipa::path(
    get,
    path = "/issues",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Agama issues", body = IssuesMap),
        (status = 400, description = "Not possible to retrieve the issues")
    )
)]
async fn get_issues(State(state): State<ServerState>) -> ServerResult<Json<IssuesMap>> {
    let issues = state.manager.call(message::GetIssues).await?;
    let issues_map: IssuesMap = issues.into();
    Ok(Json(issues_map))
}

#[utoipa::path(
    post,
    path = "/actions",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Action successfully run."),
        (status = 400, description = "Not possible to run the action.", body = Object)
    ),
    params(
        ("action" = message::Action, description = "Description of the action to run."),
    )
)]
async fn run_action(
    State(state): State<ServerState>,
    Json(action): Json<message::Action>,
) -> ServerResult<()> {
    state.manager.call(message::RunAction::new(action)).await?;
    Ok(())
}

fn to_option_response<T: Serialize>(value: Option<T>) -> Response {
    match value {
        Some(inner) => Json(inner).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}
