//! This module implements the web API for the iSCSI handling of the storage service.
//!
//! The module offers two public functions:
//!
//! * `iscsi_service` which returns the Axum service.
//! * `iscsi_stream` which offers an stream that emits the iSCSI-related events coming from D-Bus.

use agama_lib::{
    error::ServiceError,
    storage::{
        client::iscsi::{ISCSIAuth, ISCSINode, Initiator, LoginResult},
        ISCSIClient,
    },
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::error::Error;

#[derive(Clone)]
struct ISCSIState<'a> {
    client: ISCSIClient<'a>,
}

pub async fn iscsi_service<T>(dbus: &zbus::Connection) -> Result<Router<T>, ServiceError> {
    let client = ISCSIClient::new(dbus.clone()).await?;
    let state = ISCSIState { client };
    let router = Router::new()
        .route("/initiator", get(initiator))
        .route("/nodes", get(nodes))
        .route("/nodes/:id", delete(delete_node))
        .route("/nodes/:id/login", post(login_node))
        .route("/nodes/:id/logout", post(logout_node))
        .route("/discover", post(discover))
        .with_state(state);
    Ok(router)
}

async fn initiator(State(state): State<ISCSIState<'_>>) -> Result<Json<Initiator>, Error> {
    let initiator = state.client.get_initiator().await?;
    Ok(Json(initiator))
}

async fn nodes(State(state): State<ISCSIState<'_>>) -> Result<Json<Vec<ISCSINode>>, Error> {
    let nodes = state.client.get_nodes().await?;
    Ok(Json(nodes))
}

#[derive(Deserialize)]
struct DiscoverParams {
    address: String,
    port: u32,
    #[serde(default)]
    options: ISCSIAuth,
}

async fn discover(
    State(state): State<ISCSIState<'_>>,
    Json(params): Json<DiscoverParams>,
) -> Result<impl IntoResponse, Error> {
    let result = state
        .client
        .discover(&params.address, params.port, params.options)
        .await?;
    if result {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Ok(StatusCode::BAD_REQUEST)
    }
}

async fn delete_node(
    State(state): State<ISCSIState<'_>>,
    Path(id): Path<u32>,
) -> Result<impl IntoResponse, Error> {
    state.client.delete_node(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct LoginParams {
    #[serde(flatten)]
    auth: ISCSIAuth,
    startup: String,
}

#[derive(Serialize)]
struct LoginError {
    code: LoginResult,
}

async fn login_node(
    State(state): State<ISCSIState<'_>>,
    Path(id): Path<u32>,
    Json(params): Json<LoginParams>,
) -> Result<impl IntoResponse, Error> {
    let result = state.client.login(id, params.auth, params.startup).await?;
    match result {
        LoginResult::Success => Ok((StatusCode::NO_CONTENT, ().into_response())),
        error => Ok((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(error).into_response(),
        )),
    }
}

async fn logout_node(
    State(state): State<ISCSIState<'_>>,
    Path(id): Path<u32>,
) -> Result<impl IntoResponse, Error> {
    if state.client.logout(id).await? {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Ok(StatusCode::UNPROCESSABLE_ENTITY)
    }
}
