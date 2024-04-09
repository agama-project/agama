//! This module implements the web API for the network module.

use crate::error::Error;
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
    Action, Adapter,
};

use crate::network::{model::Connection, model::Device, NetworkSystem};
use agama_lib::error::ServiceError;
use agama_lib::network::settings::NetworkConnection;

use serde_json::json;
use thiserror::Error;
use tokio::sync::{mpsc::UnboundedSender, oneshot};

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
    #[error("Network state error: {0}")]
    Error(#[from] NetworkStateError),
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
    actions: UnboundedSender<Action>,
}

/// Sets up and returns the axum service for the network module.
///
/// * `dbus`: zbus Connection.
pub async fn network_service<T: Adapter + std::marker::Send + 'static>(
    dbus: zbus::Connection,
    adapter: T,
) -> Result<Router, ServiceError> {
    let mut network = NetworkSystem::new(dbus.clone(), adapter);

    let state = NetworkState {
        actions: network.actions_tx(),
    };

    tokio::spawn(async move {
        network
            .setup()
            .await
            .expect("Could not set up the D-Bus tree");

        network.listen().await;
    });

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
    state.actions.send(Action::GetGeneralState(tx)).unwrap();

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
    state
        .actions
        .send(Action::UpdateGeneralState(value.clone()))
        .unwrap();

    let (tx, rx) = oneshot::channel();
    state.actions.send(Action::GetGeneralState(tx)).unwrap();
    let state = rx.await.unwrap();

    Ok(Json(state))
}

#[utoipa::path(get, path = "/network/wifi", responses(
  (status = 200, description = "List of wireless networks", body = Vec<AccessPoint>)
))]
async fn wifi_networks(State(state): State<NetworkState>) -> Json<Vec<AccessPoint>> {
    let (tx, rx) = oneshot::channel();
    state.actions.send(Action::RefreshScan(tx)).unwrap();
    let _ = rx.await.unwrap();
    let (tx, rx) = oneshot::channel();
    state.actions.send(Action::GetAccessPoints(tx)).unwrap();

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
async fn devices(State(state): State<NetworkState>) -> Json<Vec<Device>> {
    let (tx, rx) = oneshot::channel();
    state.actions.send(Action::GetDevices(tx)).unwrap();

    Json(rx.await.unwrap())
}

#[utoipa::path(get, path = "/network/connections", responses(
  (status = 200, description = "List of known connections", body = Vec<NetworkConnection>)
))]
async fn connections(State(state): State<NetworkState>) -> Json<Vec<NetworkConnection>> {
    let (tx, rx) = oneshot::channel();
    state.actions.send(Action::GetConnections(tx)).unwrap();
    let connections = rx.await.unwrap();
    let connections = connections
        .iter()
        .map(|c| NetworkConnection::try_from(c.clone()).unwrap())
        .collect();

    Json(connections)
}

#[utoipa::path(post, path = "/network/connections", responses(
  (status = 200, description = "Add a new connection", body = Connection)
))]
async fn add_connection(
    State(state): State<NetworkState>,
    Json(conn): Json<NetworkConnection>,
) -> Result<Json<Connection>, NetworkError> {
    let (tx, rx) = oneshot::channel();

    let conn = Connection::try_from(conn)?;
    let id = conn.id.clone();

    state
        .actions
        .send(Action::NewConnection(Box::new(conn.clone()), tx))
        .unwrap();
    let _ = rx.await.unwrap();

    let (tx, rx) = oneshot::channel();
    state
        .actions
        .send(Action::GetConnection(id.clone(), tx))
        .unwrap();

    match rx.await.unwrap() {
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
    let (tx, rx) = oneshot::channel();
    state
        .actions
        .send(Action::RemoveConnection(id, tx))
        .unwrap();
    if rx.await.unwrap().is_ok() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

#[utoipa::path(put, path = "/network/connections/:id", responses(
  (status = 200, description = "Update connection", body = Connection)
))]
async fn update_connection(
    State(state): State<NetworkState>,
    Path(id): Path<String>,
    Json(conn): Json<NetworkConnection>,
) -> Result<Json<()>, NetworkError> {
    let (tx, rx) = oneshot::channel();
    state
        .actions
        .send(Action::GetConnection(id.clone(), tx))
        .unwrap();
    let orig_conn = rx.await.unwrap();
    let mut conn = Connection::try_from(conn)?;
    let orig_conn = orig_conn.ok_or_else(|| NetworkError::UnknownConnection(id.clone()))?;
    if orig_conn.id != id {
        return Err(NetworkError::UnknownConnection(id));
    } else {
        conn.uuid = orig_conn.uuid;
    }

    let (tx, rx) = oneshot::channel();
    state
        .actions
        .send(Action::UpdateConnection(Box::new(conn), tx))
        .unwrap();

    Ok(Json(rx.await.unwrap()?))
}

#[utoipa::path(get, path = "/network/connections/:id/connect", responses(
  (status = 200, description = "Connect to the given connection", body = String)
))]
async fn connect(
    State(state): State<NetworkState>,
    Path(id): Path<String>,
) -> Result<Json<()>, NetworkError> {
    let (tx, rx) = oneshot::channel();
    state
        .actions
        .send(Action::GetConnection(id.clone(), tx))
        .unwrap();

    let Some(mut conn) = rx.await.unwrap() else {
        return Err(NetworkError::UnknownConnection(id));
    };
    conn.set_up();

    let (tx, rx) = oneshot::channel();
    state
        .actions
        .send(Action::UpdateConnection(Box::new(conn), tx))
        .unwrap();

    rx.await
        .unwrap()
        .map_err(|_| NetworkError::CannotApplyConfig)?;

    Ok(Json(()))
}

#[utoipa::path(get, path = "/network/connections/:id/disconnect", responses(
  (status = 200, description = "Connect to the given connection", body = String)
))]
async fn disconnect(
    State(state): State<NetworkState>,
    Path(id): Path<String>,
) -> Result<Json<()>, NetworkError> {
    let (tx, rx) = oneshot::channel();
    state
        .actions
        .send(Action::GetConnection(id.clone(), tx))
        .unwrap();

    let Some(mut current_conn) = rx.await.unwrap() else {
        return Err(NetworkError::UnknownConnection(id));
    };

    current_conn.set_down();

    let (tx, rx) = oneshot::channel();
    state
        .actions
        .send(Action::UpdateConnection(Box::new(current_conn), tx))
        .unwrap();

    rx.await
        .unwrap()
        .map_err(|_| NetworkError::CannotApplyConfig)?;

    Ok(Json(()))
}

#[utoipa::path(put, path = "/network/system/apply", responses(
  (status = 200, description = "Apply configuration")
))]
async fn apply(State(state): State<NetworkState>) -> Result<Json<()>, NetworkError> {
    let (tx, rx) = oneshot::channel();
    state.actions.send(Action::Apply(tx)).unwrap();

    rx.await
        .unwrap()
        .map_err(|_| NetworkError::CannotApplyConfig)?;

    Ok(Json(()))
}
