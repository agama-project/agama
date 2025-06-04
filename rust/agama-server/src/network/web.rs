// Copyright (c) [2024] SUSE LLC
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

//! This module implements the web API for the network module.

use crate::{error::Error, web::EventsSender};
use agama_lib::http::Event;
use anyhow::Context;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use uuid::Uuid;

use agama_lib::{
    error::ServiceError,
    network::{
        error::NetworkStateError,
        model::{AccessPoint, Connection, Device, GeneralState},
        settings::NetworkConnection,
        types::NetworkConnectionWithState,
        Adapter, NetworkSystem, NetworkSystemClient, NetworkSystemError,
    },
};

use serde_json::json;
use thiserror::Error;

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
struct NetworkServiceState {
    network: NetworkSystemClient,
}

/// Sets up and returns the axum service for the network module.
/// * `adapter`: networking configuration adapter.
/// * `events`: sending-half of the broadcast channel.
pub async fn network_service<T: Adapter + Send + Sync + 'static>(
    adapter: T,
    events: EventsSender,
) -> Result<Router, ServiceError> {
    let network = NetworkSystem::new(adapter);
    // FIXME: we are somehow abusing ServiceError. The HTTP/JSON API should have its own
    // error type.
    let client = network
        .start()
        .await
        .context("Could not start the network configuration service.")?;

    let mut changes = client.subscribe();
    tokio::spawn(async move {
        loop {
            match changes.recv().await {
                Ok(message) => {
                    if let Err(e) = events.send(Event::NetworkChange { change: message }) {
                        eprintln!("Could not send the event: {}", e);
                    }
                }
                Err(e) => {
                    eprintln!("Could not send the event: {}", e);
                }
            }
        }
    });

    let state = NetworkServiceState { network: client };

    Ok(Router::new()
        .route("/state", get(general_state).put(update_general_state))
        .route("/connections", get(connections).post(add_connection))
        .route(
            "/connections/:id",
            delete(delete_connection)
                .put(update_connection)
                .get(connection),
        )
        .route("/connections/:id/connect", post(connect))
        .route("/connections/:id/disconnect", post(disconnect))
        .route("/connections/:id/keep", post(keep))
        .route("/connections/:id/unkeep", post(unkeep))
        .route("/devices", get(devices))
        .route("/system/apply", post(apply))
        .route("/wifi", get(wifi_networks))
        .with_state(state))
}

#[utoipa::path(
    get,
    path = "/state",
    context_path = "/api/network",
    responses(
      (status = 200, description = "Get general network config", body = GeneralState)
    )
)]
async fn general_state(
    State(state): State<NetworkServiceState>,
) -> Result<Json<GeneralState>, NetworkError> {
    let general_state = state.network.get_state().await?;
    Ok(Json(general_state))
}

#[utoipa::path(
    put,
    path = "/state",
    context_path = "/api/network",
    responses(
      (status = 200, description = "Update general network config", body = GeneralState)
    )
)]
async fn update_general_state(
    State(state): State<NetworkServiceState>,
    Json(value): Json<GeneralState>,
) -> Result<Json<GeneralState>, NetworkError> {
    state.network.update_state(value)?;
    let state = state.network.get_state().await?;
    Ok(Json(state))
}

#[utoipa::path(
    get,
    path = "/wifi",
    context_path = "/api/network",
    responses(
      (status = 200, description = "List of wireless networks", body = Vec<AccessPoint>)
    )
)]
async fn wifi_networks(
    State(state): State<NetworkServiceState>,
) -> Result<Json<Vec<AccessPoint>>, NetworkError> {
    state.network.wifi_scan().await?;
    let access_points = state.network.get_access_points().await?;

    let mut networks = vec![];
    for ap in access_points {
        if !ap.ssid.to_string().is_empty() {
            networks.push(ap);
        }
    }

    Ok(Json(networks))
}

#[utoipa::path(
    get,
    path = "/devices",
    context_path = "/api/network",
    responses(
      (status = 200, description = "List of devices", body = Vec<Device>)
    )
)]
async fn devices(
    State(state): State<NetworkServiceState>,
) -> Result<Json<Vec<Device>>, NetworkError> {
    Ok(Json(state.network.get_devices().await?))
}

#[utoipa::path(
    get,
    path = "/connections",
    context_path = "/api/network",
    responses(
      (status = 200, description = "List of known connections", body = Vec<NetworkConnection>)
    )
)]
async fn connections(
    State(state): State<NetworkServiceState>,
) -> Result<Json<Vec<NetworkConnectionWithState>>, NetworkError> {
    let connections = state.network.get_connections().await?;

    let network_connections = connections
        .iter()
        .filter(|c| c.controller.is_none())
        .map(|c| {
            let state = c.state;
            let mut conn = NetworkConnection::try_from(c.clone()).unwrap();
            if let Some(ref mut bond) = conn.bond {
                bond.ports = ports_for(connections.to_owned(), c.uuid);
            }
            if let Some(ref mut bridge) = conn.bridge {
                bridge.ports = ports_for(connections.to_owned(), c.uuid);
            };
            NetworkConnectionWithState {
                connection: conn,
                state,
            }
        })
        .collect();

    Ok(Json(network_connections))
}

fn ports_for(connections: Vec<Connection>, uuid: Uuid) -> Vec<String> {
    return connections
        .iter()
        .filter(|c| c.controller == Some(uuid))
        .map(|c| {
            if let Some(interface) = c.interface.to_owned() {
                interface
            } else {
                c.clone().id
            }
        })
        .collect();
}

#[utoipa::path(
    post,
    path = "/connections",
    context_path = "/api/network",
    responses(
      (status = 200, description = "Add a new connection", body = Connection)
    )
)]
async fn add_connection(
    State(state): State<NetworkServiceState>,
    Json(net_conn): Json<NetworkConnection>,
) -> Result<Json<Connection>, NetworkError> {
    let bond = net_conn.bond.clone();
    let bridge = net_conn.bridge.clone();
    let conn = Connection::try_from(net_conn)?;
    let id = conn.id.clone();

    state.network.add_connection(conn.clone()).await?;

    match state.network.get_connection(&id).await? {
        None => Err(NetworkError::CannotAddConnection(id.clone())),
        Some(conn) => {
            if let Some(bond) = bond {
                state.network.set_ports(conn.uuid, bond.ports).await?;
            }
            if let Some(bridge) = bridge {
                state.network.set_ports(conn.uuid, bridge.ports).await?;
            }
            Ok(Json(conn))
        }
    }
}

#[utoipa::path(
    get,
    path = "/connections/:id",
    context_path = "/api/network",
    responses(
      (status = 200, description = "Get connection given by its ID", body = NetworkConnection)
  )
)]
async fn connection(
    State(state): State<NetworkServiceState>,
    Path(id): Path<String>,
) -> Result<Json<NetworkConnection>, NetworkError> {
    let conn = state
        .network
        .get_connection(&id)
        .await?
        .ok_or_else(|| NetworkError::UnknownConnection(id.clone()))?;

    let conn = NetworkConnection::try_from(conn)?;

    Ok(Json(conn))
}

#[utoipa::path(
    delete,
    path = "/connections/:id",
    context_path = "/api/network",
    responses(
      (status = 200, description = "Delete connection", body = Connection)
    )
)]
async fn delete_connection(
    State(state): State<NetworkServiceState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if state.network.remove_connection(&id).await.is_ok() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

#[utoipa::path(
    put,
    path = "/connections/:id",
    context_path = "/api/network",
    responses(
      (status = 204, description = "Update connection", body = Connection)
    )
)]
async fn update_connection(
    State(state): State<NetworkServiceState>,
    Path(id): Path<String>,
    Json(conn): Json<NetworkConnection>,
) -> Result<impl IntoResponse, NetworkError> {
    let orig_conn = state
        .network
        .get_connection(&id)
        .await?
        .ok_or_else(|| NetworkError::UnknownConnection(id.clone()))?;
    let bond = conn.bond.clone();
    let bridge = conn.bridge.clone();

    let mut conn = Connection::try_from(conn)?;
    conn.uuid = orig_conn.uuid;

    state.network.update_connection(conn.clone()).await?;

    if let Some(bond) = bond {
        state.network.set_ports(conn.uuid, bond.ports).await?;
    }
    if let Some(bridge) = bridge {
        state.network.set_ports(conn.uuid, bridge.ports).await?;
    }

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/connections/:id/connect",
    context_path = "/api/network",
    responses(
      (status = 204, description = "Connect to the given connection", body = String)
    )
)]
async fn connect(
    State(state): State<NetworkServiceState>,
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

    state
        .network
        .apply()
        .await
        .map_err(|_| NetworkError::CannotApplyConfig)?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/connections/:id/disconnect",
    context_path = "/api/network",
    responses(
      (status = 204, description = "Connect to the given connection", body = String)
    )
)]
async fn disconnect(
    State(state): State<NetworkServiceState>,
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

    state
        .network
        .apply()
        .await
        .map_err(|_| NetworkError::CannotApplyConfig)?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/connections/:id/keep",
    context_path = "/api/network",
    responses(
      (status = 204, description = "Keep the given connection after the installation", body = String)
    )
)]
async fn keep(
    State(state): State<NetworkServiceState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, NetworkError> {
    if id == "all" {
        let mut connections = state.network.get_connections().await?;

        for conn in connections.iter_mut() {
            conn.set_keep(true);

            state
                .network
                .update_connection(conn.to_owned())
                .await
                .map_err(|_| NetworkError::CannotApplyConfig)?;
        }
    } else {
        let Some(mut conn) = state.network.get_connection(&id).await? else {
            return Err(NetworkError::UnknownConnection(id));
        };

        conn.set_keep(true);

        state
            .network
            .update_connection(conn)
            .await
            .map_err(|_| NetworkError::CannotApplyConfig)?;
    }

    state
        .network
        .apply()
        .await
        .map_err(|_| NetworkError::CannotApplyConfig)?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/connections/:id/unkeep",
    context_path = "/api/network",
    responses(
      (status = 204, description = "Do not keep the given connection after the installation", body = String)
    )
)]
async fn unkeep(
    State(state): State<NetworkServiceState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, NetworkError> {
    if id == "all" {
        let mut connections = state.network.get_connections().await?;

        for conn in connections.iter_mut() {
            conn.set_keep(false);

            state
                .network
                .update_connection(conn.to_owned())
                .await
                .map_err(|_| NetworkError::CannotApplyConfig)?;
        }
    } else {
        let Some(mut conn) = state.network.get_connection(&id).await? else {
            return Err(NetworkError::UnknownConnection(id));
        };

        conn.set_keep(false);

        state
            .network
            .update_connection(conn)
            .await
            .map_err(|_| NetworkError::CannotApplyConfig)?;
    }

    state
        .network
        .apply()
        .await
        .map_err(|_| NetworkError::CannotApplyConfig)?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/system/apply",
    context_path = "/api/network",
    responses(
      (status = 204, description = "Apply configuration")
    )
)]
async fn apply(
    State(state): State<NetworkServiceState>,
) -> Result<impl IntoResponse, NetworkError> {
    state
        .network
        .apply()
        .await
        .map_err(|_| NetworkError::CannotApplyConfig)?;

    Ok(StatusCode::NO_CONTENT)
}
