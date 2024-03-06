//! This module implements the web API for the network module.

use crate::error::Error;
use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};

use super::Action;

use crate::network::{model::Connection, model::Device, nm::NetworkManagerAdapter, NetworkSystem};
use agama_lib::error::ServiceError;

use serde_json::json;
use thiserror::Error;
use tokio::sync::{mpsc::UnboundedSender, oneshot};

#[derive(Error, Debug)]
pub enum NetworkError {
    #[error("Unknown connection id: {0}")]
    UnknownConnection(String),
    #[error("Cannot translate: {0}")]
    CannotTranslate(#[from] Error),
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
pub async fn network_service(dbus: zbus::Connection) -> Result<Router, ServiceError> {
    let adapter = NetworkManagerAdapter::from_system()
        .await
        .expect("Could not connect to NetworkManager to read the configuration.");
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
        .route("/connections", get(connections))
        .route("/devices", get(devices))
        .with_state(state))
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
  (status = 200, description = "List of known connections", body = Vec<Connection>)
))]
async fn connections(State(state): State<NetworkState>) -> Json<Vec<Connection>> {
    let (tx, rx) = oneshot::channel();
    state.actions.send(Action::GetConnections(tx)).unwrap();

    Json(rx.await.unwrap())
}
