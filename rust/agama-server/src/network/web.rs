//! This module implements the web API for the network module.

use crate::error::Error;
use anyhow::Context;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{delete, get, put},
    Json, Router,
};

use super::{
    error::NetworkStateError,
    model::{AccessPoint, GeneralState},
    system::{NetworkSystemClient, NetworkSystemError},
    Action, Adapter,
};

use crate::network::{model::Connection, model::Device, NetworkSystem};
use agama_lib::{error::ServiceError, network::settings::NetworkConnection};

use serde_json::json;
use thiserror::Error;
use tokio::sync::oneshot;

#[derive(Error, Debug)]
pub enum NetworkError {
    #[error("Unknown connection id: {0}")]
    UnknownConnection(String),
    #[error("Cannot translate: {0}")]
    CannotTranslate(#[from] Error),
    #[error("Cannot add new connection: {0}")]
    CannotAddConnection(String),
    #[error("Cannot update configuration: {0}")]
    CannotUpdate(String),
    #[error("Cannot apply configuration")]
    CannotApplyConfig,
    // TODO: to be removed after adapting to the NetworkSystemServer API
    #[error("Network state error: {0}")]
    Error(#[from] NetworkStateError),
    #[error("Network system error: {0}")]
    SystemError(#[from] NetworkSystemError),
}

impl IntoResponse for NetworkError {
    fn into_response(self) -> Response {
        let body = json!({
            "error": self.to_string()
        });
        (StatusCode::BAD_REQUEST, Json(body)).into_response()
    }
}

#[derive(Clone)]
struct NetworkState {
    network: NetworkSystemClient,
}

/// Sets up and returns the axum service for the network module.
///
/// * `dbus`: zbus Connection.
pub async fn network_service<T: Adapter + std::marker::Send + 'static>(
    dbus: zbus::Connection,
    adapter: T,
) -> Result<Router, ServiceError> {
    let network = NetworkSystem::new(dbus.clone(), adapter);
    // FIXME: we are somehow abusing ServiceError. The HTTP/JSON API should have its own
    // error type.
    let client = network
        .start()
        .await
        .context("Could not start the network configuration service.")?;
    let state = NetworkState { network: client };

    Ok(Router::new()
        .route("/state", get(general_state).put(update_general_state))
        .route("/connections", get(connections).post(add_connection))
        .route(
            "/connections/:id",
            delete(delete_connection).put(update_connection),
        )
        .route("/connections/:id/connect", get(connect))
        .route("/connections/:id/disconnect", get(disconnect))
        .route("/devices", get(devices))
        .route("/system/apply", put(apply))
        .route("/wifi", get(wifi_networks))
        .with_state(state))
}

#[utoipa::path(get, path = "/network/state", responses(
  (status = 200, description = "Get general network config", body = GenereralState)
))]
async fn general_state(State(state): State<NetworkState>) -> Json<GeneralState> {
    let (tx, rx) = oneshot::channel();
    state
        .network
        .actions
        .send(Action::GetGeneralState(tx))
        .unwrap();

    let state = rx.await.unwrap();

    Json(state)
}

#[utoipa::path(put, path = "/network/state", responses(
  (status = 200, description = "Update general network config", body = GenereralState)
))]
async fn update_general_state(
    State(state): State<NetworkState>,
    Json(value): Json<GeneralState>,
) -> Result<Json<GeneralState>, NetworkError> {
    state.network.update_state(value)?;
    let state = state.network.get_state().await?;
    Ok(Json(state))
}

#[utoipa::path(get, path = "/network/wifi", responses(
  (status = 200, description = "List of wireless networks", body = Vec<AccessPoint>)
))]
async fn wifi_networks(State(state): State<NetworkState>) -> Json<Vec<AccessPoint>> {
    let (tx, rx) = oneshot::channel();
    state.network.actions.send(Action::RefreshScan(tx)).unwrap();
    let _ = rx.await.unwrap();
    let (tx, rx) = oneshot::channel();
    state
        .network
        .actions
        .send(Action::GetAccessPoints(tx))
        .unwrap();

    let access_points = rx.await.unwrap();

    let mut networks = vec![];

    for ap in access_points {
        if !ap.ssid.to_string().is_empty() {
            networks.push(ap);
        }
    }

    Json(networks)
}

#[utoipa::path(get, path = "/network/devices", responses(
  (status = 200, description = "List of devices", body = Vec<Device>)
))]
async fn devices(State(state): State<NetworkState>) -> Result<Json<Vec<Device>>, NetworkError> {
    Ok(Json(state.network.get_devices().await?))
}

#[utoipa::path(get, path = "/network/connections", responses(
  (status = 200, description = "List of known connections", body = Vec<NetworkConnection>)
))]
async fn connections(
    State(state): State<NetworkState>,
) -> Result<Json<Vec<NetworkConnection>>, NetworkError> {
    let connections = state.network.get_connections().await?;
    let connections = connections
        .iter()
        .map(|c| NetworkConnection::try_from(c.clone()).unwrap())
        .collect();
    Ok(Json(connections))
}

#[utoipa::path(post, path = "/network/connections", responses(
  (status = 200, description = "Add a new connection", body = Connection)
))]
async fn add_connection(
    State(state): State<NetworkState>,
    Json(conn): Json<NetworkConnection>,
) -> Result<Json<Connection>, NetworkError> {
    let conn = Connection::try_from(conn)?;
    let id = conn.id.clone();

    state.network.add_connection(conn).await?;
    match state.network.get_connection(&id).await? {
        None => Err(NetworkError::CannotAddConnection(id.clone())),
        Some(conn) => Ok(Json(conn)),
    }
}

#[utoipa::path(delete, path = "/network/connections/:id", responses(
  (status = 200, description = "Delete connection", body = Connection)
))]
async fn delete_connection(
    State(state): State<NetworkState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if state.network.remove_connection(&id).await.is_ok() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

#[utoipa::path(put, path = "/network/connections/:id", responses(
  (status = 204, description = "Update connection", body = Connection)
))]
async fn update_connection(
    State(state): State<NetworkState>,
    Path(id): Path<String>,
    Json(conn): Json<NetworkConnection>,
) -> Result<impl IntoResponse, NetworkError> {
    let orig_conn = state
        .network
        .get_connection(&id)
        .await?
        .ok_or_else(|| NetworkError::UnknownConnection(id.clone()))?;
    let mut conn = Connection::try_from(conn)?;
    if orig_conn.id != id {
        // FIXME: why?
        return Err(NetworkError::UnknownConnection(id));
    } else {
        conn.uuid = orig_conn.uuid;
    }

    state.network.update_connection(conn).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(get, path = "/network/connections/:id/connect", responses(
  (status = 204, description = "Connect to the given connection", body = String)
))]
async fn connect(
    State(state): State<NetworkState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, NetworkError> {
    let Some(mut conn) = state.network.get_connection(&id).await? else {
        return Err(NetworkError::UnknownConnection(id));
    };
    conn.set_up();

    state
        .network
        .update_connection(conn)
        .await
        .map_err(|_| NetworkError::CannotApplyConfig)?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(get, path = "/network/connections/:id/disconnect", responses(
  (status = 204, description = "Connect to the given connection", body = String)
))]
async fn disconnect(
    State(state): State<NetworkState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, NetworkError> {
    let Some(mut conn) = state.network.get_connection(&id).await? else {
        return Err(NetworkError::UnknownConnection(id));
    };
    conn.set_down();

    state
        .network
        .update_connection(conn)
        .await
        .map_err(|_| NetworkError::CannotApplyConfig)?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(put, path = "/network/system/apply", responses(
  (status = 204, description = "Apply configuration")
))]
async fn apply(State(state): State<NetworkState>) -> Result<impl IntoResponse, NetworkError> {
    state
        .network
        .apply()
        .await
        .map_err(|_| NetworkError::CannotApplyConfig)?;

    Ok(StatusCode::NO_CONTENT)
}
