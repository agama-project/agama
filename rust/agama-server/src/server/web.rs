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
    supervisor::{self, l10n, message, ConfigScope, Scope, Service, SystemInfo},
    web::EventsSender,
};
use agama_lib::{error::ServiceError, install_settings::InstallSettings};
use agama_utils::actor::Handler;
use axum::{
    extract::{Path, State},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use hyper::StatusCode;
use serde::Serialize;
use serde_json::json;

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
    supervisor: Handler<Service<l10n::Model>>,
}

type ServerResult<T> = Result<T, Error>;

/// Sets up and returns the axum service for the manager module
pub async fn server_service(events: EventsSender) -> Result<Router, ServiceError> {
    let supervisor = supervisor::start(events).await.unwrap();
    let state = ServerState { supervisor };

    Ok(Router::new()
        .route(
            "/config/user/:scope",
            get(get_config_scope)
                .put(put_config_scope)
                .patch(patch_config_scope),
        )
        .route(
            "/config/user",
            get(get_config).put(put_config).patch(patch_config),
        )
        .route("/config/:scope", get(get_full_config_scope))
        .route("/config", get(get_full_config))
        .route("/system", get(get_system))
        .route("/proposal", get(get_proposal))
        .route("/actions", post(run_action))
        .with_state(state))
}

async fn get_system(State(state): State<ServerState>) -> ServerResult<Json<SystemInfo>> {
    let system = state.supervisor.call(message::GetSystem).await?;
    Ok(Json(system))
}

/// Returns the current configuration.
#[utoipa::path(
    get,
    path = "/config",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Agama configuration"),
        (status = 400, description = "Not possible to retrieve the configuration")
    )
)]
async fn get_full_config(State(state): State<ServerState>) -> ServerResult<Json<InstallSettings>> {
    let config = state.supervisor.call(message::GetFullConfig).await?;
    Ok(Json(config))
}

/// Returns the current configuration for the given scope.
#[utoipa::path(
    get,
    path = "/config/{scope}",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Agama configuration for the given scope"),
        (status = 400, description = "Not possible to retrieve the configuration")
    ),
    params(
        ("scope" = String, Path, description = "Configuration scope (e.g., 'storage', 'l10n', etc.")
    )
)]
async fn get_full_config_scope(
    State(state): State<ServerState>,
    Path(scope): Path<Scope>,
) -> ServerResult<Response> {
    let config = state
        .supervisor
        .call(message::GetFullConfigScope::new(scope))
        .await?;
    Ok(to_option_response(config))
}

/// Returns the user specified configuration for the given scope.
#[utoipa::path(
    get,
    path = "/config/user",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "User specified configuration"),
        (status = 400, description = "Not possible to retrieve the configuration")
    )
)]
async fn get_config(State(state): State<ServerState>) -> ServerResult<Json<InstallSettings>> {
    let config = state.supervisor.call(message::GetConfig).await?;
    Ok(Json(config))
}

/// Returns the user specified configuration for the given scope.
#[utoipa::path(
    get,
    path = "/config/user/{scope}",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "User specified configuration for the given scope"),
        (status = 400, description = "Not possible to retrieve the configuration")
    ),
    params(
        ("scope" = String, Path, description = "Configuration scope (e.g., 'storage', 'l10n', etc.")
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
/// Replaces the whole configuration. If some value is missing, it will be
/// removed.
#[utoipa::path(
    put,
    path = "/config",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "The configuration was saved. Other operations can be running in background."),
        (status = 400, description = "Not possible to retrieve the configuration")
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
/// It only chagnes to the specified values, keeping the rest as they were.
#[utoipa::path(
    patch,
    path = "/config",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "The configuration was saved. Other operations can be running in background."),
        (status = 400, description = "Not possible to retrieve the configuration")
    ),
    params(
        ("config" = InstallSettings, description = "Changes in the configuration")
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
/// Replaces the whole configuration. If some value is missing, it will be
/// removed.
#[utoipa::path(
    put,
    path = "/config/{scope}",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "The configuration was saved. Other operations can be running in background."),
        (status = 400, description = "Not possible to retrieve the configuration")
    ),
    params(
        ("config" = InstallSettings, description = "Changes in the configuration"),
        ("scope" = String, Path, description = "Configuration scope (e.g., 'storage', 'localization', etc.")
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
/// It only chagnes to the specified values, keeping the rest as they were.
#[utoipa::path(
    patch,
    path = "/config/{scope}",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "The configuration was saved. Other operations can be running in background."),
        (status = 400, description = "Not possible to retrieve the configuration")
    ),
    params(
        ("config" = InstallSettings, description = "Changes in the configuration"),
        ("scope" = String, Path, description = "Configuration scope (e.g., 'storage', 'l10n', etc.")
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

async fn get_proposal(State(state): State<ServerState>) -> ServerResult<Response> {
    let proposal = state.supervisor.call(message::GetProposal).await?;
    Ok(to_option_response(proposal))
}

#[utoipa::path(
    post,
    path = "/actions",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "The action run successfully."),
        (status = 400, description = "It was not possible to run the action.", body = Object)
    ),
    params(
        ("action" = message::Action, description = "Description of the action to run"),
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
