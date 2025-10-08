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

use crate::{
    supervisor::{self, message, ConfigScope, Scope, Service, SystemInfo},
    web::EventsSender,
};
use agama_lib::{error::ServiceError, install_settings::InstallSettings};
use agama_utils::actor::Handler;
use anyhow;
use axum::{
    extract::{Path, State},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use hyper::StatusCode;
use serde::Serialize;
use serde_json::json;

use super::types::IssuesMap;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("The given configuration does not belong to the '{0}' scope.")]
    Scope(Scope),
    #[error(transparent)]
    Supervisor(#[from] supervisor::service::Error),
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

fn to_option_response<T: Serialize>(value: Option<T>) -> Response {
    match value {
        Some(inner) => Json(inner).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

#[derive(Clone)]
pub struct ServerState {
    supervisor: Handler<Service>,
}

type ServerResult<T> = Result<T, Error>;

/// Sets up and returns the axum service for the manager module
///
/// * `events`: channel to send events to the websocket.
/// * `dbus`: connection to Agama's D-Bus server. If it is not given, those features
///           that require to connect to the Agama's D-Bus server won't work.
pub async fn server_service(
    events: EventsSender,
    dbus: Option<zbus::Connection>,
) -> Result<Router, ServiceError> {
    let supervisor = supervisor::start(events, dbus)
        .await
        .map_err(|e| anyhow::Error::new(e))?;

    let state = ServerState { supervisor };

    Ok(Router::new()
        .route("/status", get(get_status))
        .route("/system", get(get_system))
        .route("/extended_config/:scope", get(get_extended_config_scope))
        .route("/extended_config", get(get_extended_config))
        .route(
            "/config/:scope",
            get(get_config_scope)
                .put(put_config_scope)
                .patch(patch_config_scope),
        )
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
async fn get_status(State(state): State<ServerState>) -> ServerResult<Json<message::Status>> {
    let status = state.supervisor.call(message::GetStatus).await?;
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
    let system = state.supervisor.call(message::GetSystem).await?;
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
    let config = state.supervisor.call(message::GetExtendedConfig).await?;
    Ok(Json(config))
}

/// Returns the extended configuration for the given scope.
#[utoipa::path(
    get,
    path = "/extended_config/{scope}",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Extended configuration for the given scope."),
        (status = 400, description = "Not possible to retrieve the configuration scope.")
    ),
    params(
        ("scope" = String, Path, description = "Configuration scope (e.g., 'storage', 'l10n', etc).")
    )
)]
async fn get_extended_config_scope(
    State(state): State<ServerState>,
    Path(scope): Path<Scope>,
) -> ServerResult<Response> {
    let config = state
        .supervisor
        .call(message::GetExtendedConfigScope::new(scope))
        .await?;
    Ok(to_option_response(config))
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
    let config = state.supervisor.call(message::GetConfig).await?;
    Ok(Json(config))
}

/// Returns the configuration for the given scope.
#[utoipa::path(
    get,
    path = "/config/{scope}",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Configuration for the given scope."),
        (status = 400, description = "Not possible to retrieve the configuration scope.")
    ),
    params(
        ("scope" = String, Path, description = "Configuration scope (e.g., 'storage', 'l10n', etc).")
    )
)]
async fn get_config_scope(
    State(state): State<ServerState>,
    Path(scope): Path<Scope>,
) -> ServerResult<Response> {
    let config = state
        .supervisor
        .call(message::GetConfigScope::new(scope))
        .await?;
    Ok(to_option_response(config))
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
    state
        .supervisor
        .call(message::SetConfig::new(config))
        .await?;
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
    Json(config): Json<InstallSettings>,
) -> ServerResult<()> {
    state
        .supervisor
        .call(message::UpdateConfig::new(config))
        .await?;
    Ok(())
}

/// Updates the configuration for the given scope.
///
/// Replaces the whole scope. If some value is missing, it will be removed.
#[utoipa::path(
    put,
    path = "/config/{scope}",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "The configuration scope was replaced. Other operations can be running in background."),
        (status = 400, description = "Not possible to replace the configuration scope.")
    ),
    params(
        ("config" = InstallSettings, description = "Configuration scope to apply."),
        ("scope" = String, Path, description = "Configuration scope (e.g., 'storage', 'localization', etc).")
    )
)]
async fn put_config_scope(
    State(state): State<ServerState>,
    Path(scope): Path<Scope>,
    Json(config_scope): Json<ConfigScope>,
) -> ServerResult<()> {
    if config_scope.to_scope() != scope {
        return Err(Error::Scope(scope));
    }

    state
        .supervisor
        .call(message::SetConfigScope::new(config_scope))
        .await?;
    Ok(())
}

/// Patches the configuration for the given scope.
///
/// It only chagnes the specified values, keeping the rest as they are.
#[utoipa::path(
    patch,
    path = "/config/{scope}",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "The configuration scope was patched. Other operations can be running in background."),
        (status = 400, description = "Not possible to patch the configuration scope.")
    ),
    params(
        ("config" = InstallSettings, description = "Changes in the configuration scope."),
        ("scope" = String, Path, description = "Configuration scope (e.g., 'storage', 'l10n', etc).")
    )
)]
async fn patch_config_scope(
    State(state): State<ServerState>,
    Path(scope): Path<Scope>,
    Json(config_scope): Json<ConfigScope>,
) -> ServerResult<()> {
    if config_scope.to_scope() != scope {
        return Err(Error::Scope(scope));
    }

    state
        .supervisor
        .call(message::UpdateConfigScope::new(config_scope))
        .await?;
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
    let proposal = state.supervisor.call(message::GetProposal).await?;
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
    let issues = state.supervisor.call(message::GetIssues).await?;
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
    state
        .supervisor
        .call(message::RunAction::new(action))
        .await?;
    Ok(())
}
