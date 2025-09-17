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

// use agama_l10n::L10nModel;
use agama_lib::{error::ServiceError, install_settings::InstallSettings};
// use agama_locale_data::LocaleId;
use axum::{
    extract::{Path, State},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use hyper::StatusCode;
use serde::Serialize;

use crate::supervisor::{self, Action};

use super::{Scope, ScopeConfig, ServerError, SystemInfo};

#[derive(Clone)]
pub struct ServerState {
    supervisor: supervisor::Handler,
}

type ServerResult<T> = Result<T, ServerError>;

/// Sets up and returns the axum service for the manager module
pub async fn server_service() -> Result<Router, ServiceError> {
    // let l10n = L10nModel::new_with_locale(&LocaleId::default()).unwrap();
    // let l10n = L10nAgent::new(l10n);
    let supervisor = supervisor::Handler::start().await.unwrap();
    let state = ServerState { supervisor };

    Ok(Router::new()
        .route(
            "/config/user/:scope",
            get(get_scope_user_config)
                .put(set_scope_config)
                .patch(set_scope_config),
        )
        .route(
            "/config/user",
            get(get_user_config).patch(set_config).put(set_config),
        )
        .route("/config/:scope", get(get_scope_full_config))
        .route("/config", get(get_full_config))
        .route("/system", get(get_system))
        .route("/proposal", get(get_proposal))
        .route("/actions", post(run_action))
        .with_state(state))
}

#[axum::debug_handler]
async fn get_full_config(State(state): State<ServerState>) -> ServerResult<Json<InstallSettings>> {
    Ok(Json(state.supervisor.get_config().await?))
}

async fn get_scope_full_config(
    State(state): State<ServerState>,
    Path(scope): Path<Scope>,
) -> ServerResult<Response> {
    let config = state.supervisor.get_scope_config(scope).await?;
    Ok(to_option_response(config))
}

async fn get_user_config(State(state): State<ServerState>) -> ServerResult<Json<InstallSettings>> {
    Ok(Json(state.supervisor.get_user_config().await?))
}

async fn get_scope_user_config(
    State(state): State<ServerState>,
    Path(scope): Path<Scope>,
) -> ServerResult<Response> {
    let user_config = state.supervisor.get_user_config().await?;

    let result = match scope {
        Scope::L10n => &user_config.localization,
    };

    Ok(to_option_response(result.clone()))
}

async fn set_config(
    State(state): State<ServerState>,
    method: axum::http::Method,
    Json(config): Json<InstallSettings>,
) -> ServerResult<()> {
    if method.as_str() == "PATCH" {
        state.supervisor.patch_config(&config)?;
    } else {
        state.supervisor.update_config(&config)?;
    }

    Ok(())
}

async fn set_scope_config(
    State(state): State<ServerState>,
    method: axum::http::Method,
    Path(scope): Path<Scope>,
    Json(user_config): Json<ScopeConfig>,
) -> Result<(), ServerError> {
    if user_config.to_scope() != scope {
        return Err(ServerError::NoMatchingScope(scope));
    }

    if method.as_str() == "PATCH" {
        state.supervisor.patch_scope_config(user_config)?;
    } else {
        state.supervisor.update_scope_config(user_config)?;
    }
    Ok(())
}

async fn run_action(
    State(state): State<ServerState>,
    Json(action): Json<Action>,
) -> Result<(), ServerError> {
    // state.dispatch_action(action).await;
    Ok(())
}

async fn get_proposal(State(state): State<ServerState>) -> ServerResult<Response> {
    if let Some(proposal) = state.supervisor.get_proposal().await? {
        Ok(Json(proposal).into_response())
    } else {
        Ok(StatusCode::NOT_FOUND.into_response())
    }
}

async fn get_system(State(state): State<ServerState>) -> ServerResult<Json<SystemInfo>> {
    Ok(Json(state.supervisor.get_system().await?))
}

fn to_option_response<T: Serialize>(value: Option<T>) -> Response {
    match value {
        Some(inner) => Json(inner).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}
