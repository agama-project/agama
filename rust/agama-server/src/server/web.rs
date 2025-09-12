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
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::{supervisor::Action, supervisor::Supervisor};

use super::{Scope, ScopeConfig, ServerError, SystemInfo};

#[derive(Clone)]
pub struct ServerState {
    supervisor: Arc<Mutex<Supervisor>>,
}

/// Sets up and returns the axum service for the manager module
pub async fn server_service() -> Result<Router, ServiceError> {
    // let l10n = L10nModel::new_with_locale(&LocaleId::default()).unwrap();
    // let l10n = L10nAgent::new(l10n);
    let supervisor = Supervisor::new();
    let state = ServerState {
        supervisor: Arc::new(Mutex::new(supervisor)),
    };

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

async fn get_full_config(State(state): State<ServerState>) -> Json<InstallSettings> {
    let state = state.supervisor.lock().await;
    Json(state.get_config().await.clone())
}

async fn get_scope_full_config(
    State(state): State<ServerState>,
    Path(scope): Path<Scope>,
) -> Result<Response, ServerError> {
    let state = state.supervisor.lock().await;
    let config = state.get_scope_config(scope).await;
    Ok(to_option_response(config))
}

async fn get_user_config(State(state): State<ServerState>) -> Json<InstallSettings> {
    let state = state.supervisor.lock().await;
    Json(state.get_user_config().await.clone())
}

async fn get_scope_user_config(
    State(state): State<ServerState>,
    Path(scope): Path<Scope>,
) -> Response {
    let state = state.supervisor.lock().await;
    let user_config = state.get_user_config().await;

    let result = match scope {
        Scope::L10n => &user_config.localization,
    };

    to_option_response(result.clone())
}

async fn set_config(
    State(state): State<ServerState>,
    method: axum::http::Method,
    Json(config): Json<InstallSettings>,
) -> Result<(), ServerError> {
    let mut state = state.supervisor.lock().await;
    if method.as_str() == "PATCH" {
        state.patch_config(config).await?;
    } else {
        state.update_config(config).await?;
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

    let mut state = state.supervisor.lock().await;
    if method.as_str() == "PATCH" {
        state.patch_scope_config(user_config).await?;
    } else {
        state.update_scope_config(user_config).await?;
    }
    Ok(())
}

async fn run_action(
    State(state): State<ServerState>,
    Json(action): Json<Action>,
) -> Result<(), ServerError> {
    let mut state = state.supervisor.lock().await;
    state.dispatch_action(action).await;
    Ok(())
}

async fn get_proposal(State(state): State<ServerState>) -> Response {
    let state = state.supervisor.lock().await;
    if let Some(proposal) = state.get_proposal().await {
        Json(proposal).into_response()
    } else {
        StatusCode::NOT_FOUND.into_response()
    }
}

async fn get_system(State(state): State<ServerState>) -> Json<SystemInfo> {
    let state = state.supervisor.lock().await;
    Json(state.get_system().await)
}

fn to_option_response<T: Serialize>(value: Option<T>) -> Response {
    match value {
        Some(inner) => Json(inner).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}
