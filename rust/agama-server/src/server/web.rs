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

use agama_lib::{error::ServiceError, install_settings::InstallSettings};
use agama_locale_data::LocaleId;
use axum::{
    extract::State,
    response::{IntoResponse, Response},
    routing::{get, patch},
    Json, Router,
};
use hyper::StatusCode;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::{
    error::Error,
    l10n::{L10n, L10nAgent},
    supervisor::Supervisor,
};

#[derive(Clone)]
pub struct ServerState {
    supervisor: Arc<Mutex<Supervisor>>,
}

/// Sets up and returns the axum service for the manager module
pub async fn server_service() -> Result<Router, ServiceError> {
    let l10n = L10n::new_with_locale(&LocaleId::default()).unwrap();
    let l10n = L10nAgent::new(l10n);
    let supervisor = Supervisor::new(l10n);
    let state = ServerState {
        supervisor: Arc::new(Mutex::new(supervisor)),
    };

    Ok(Router::new()
        .route("/config", patch(set_config).get(get_config))
        .route("/proposal", get(get_proposal))
        .with_state(state))
}

async fn get_config(State(state): State<ServerState>) -> Result<Json<InstallSettings>, Error> {
    let state = state.supervisor.lock().await;
    Ok(Json(state.get_config().await.clone()))
}

async fn set_config(
    State(state): State<ServerState>,
    Json(config): Json<InstallSettings>,
) -> Result<(), Error> {
    let mut state = state.supervisor.lock().await;
    state.set_config(config).await;
    Ok(())
}

// async fn get_proposal(State(state): State<ServerState>) -> Result<Json<Proposal>, Error> {
async fn get_proposal(State(state): State<ServerState>) -> Result<Response, Error> {
    let state = state.supervisor.lock().await;
    let response = if let Some(proposal) = state.get_proposal().await {
        Json(proposal).into_response()
    } else {
        StatusCode::NOT_FOUND.into_response()
    };
    Ok(response)
}
