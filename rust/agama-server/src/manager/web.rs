//! This module implements the web API for the manager service.
//!
//! The module offers two public functions:
//!
//! * `manager_service` which returns the Axum service.
//! * `manager_stream` which offers an stream that emits the manager events coming from D-Bus.

use agama_lib::{
    error::ServiceError,
    manager::{InstallationPhase, ManagerClient},
    proxies::ManagerProxy,
};
use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use serde_json::json;
use thiserror::Error;
use tokio_stream::{Stream, StreamExt};

use crate::{error::Error, web::Event};

#[derive(Clone)]
pub struct ManagerState<'a> {
    manager: ManagerClient<'a>,
}

#[derive(Error, Debug)]
pub enum ManagerError {
    #[error("Manager service error: {0}")]
    Error(#[from] ServiceError),
}

impl IntoResponse for ManagerError {
    fn into_response(self) -> Response {
        let body = json!({});
        (StatusCode::BAD_REQUEST, Json(body)).into_response()
    }
}

/// Holds information about the manager's status.
#[derive(Clone, Serialize, utoipa::ToSchema)]
pub struct ManagerStatus {
    /// Current installation phase.
    phase: InstallationPhase,
    /// List of busy services.
    busy: Vec<String>,
}

/// Returns a stream that emits manager related events coming from D-Bus.
///
/// It emits the Event::BusyServicesChanged and Event::InstallationPhaseChanged events.
///
/// * `connection`: D-Bus connection to listen for events.
pub async fn manager_stream(dbus: zbus::Connection) -> Result<impl Stream<Item = Event>, Error> {
    Ok(StreamExt::merge(
        busy_services_changed_stream(dbus.clone()).await?,
        installation_phase_changed_stream(dbus.clone()).await?,
    ))
}

pub async fn busy_services_changed_stream(
    dbus: zbus::Connection,
) -> Result<impl Stream<Item = Event>, Error> {
    let proxy = ManagerProxy::new(&dbus).await?;
    let stream = proxy
        .receive_busy_services_changed()
        .await
        .then(|change| async move {
            if let Ok(busy_services) = change.get().await {
                Some(Event::BusyServicesChanged {
                    services: busy_services,
                })
            } else {
                None
            }
        })
        .filter_map(|e| e);
    Ok(stream)
}

pub async fn installation_phase_changed_stream(
    dbus: zbus::Connection,
) -> Result<impl Stream<Item = Event>, Error> {
    let proxy = ManagerProxy::new(&dbus).await?;
    let stream = proxy
        .receive_current_installation_phase_changed()
        .await
        .then(|change| async move {
            if let Ok(phase) = change.get().await {
                match InstallationPhase::try_from(phase) {
                    Ok(phase) => Some(Event::InstallationPhaseChanged { phase }),
                    Err(error) => {
                        log::warn!("Ignoring the installation phase change. Error: {}", error);
                        None
                    }
                }
            } else {
                None
            }
        })
        .filter_map(|e| e);
    Ok(stream)
}

/// Sets up and returns the axum service for the manager module
pub async fn manager_service(dbus: zbus::Connection) -> Result<Router, ServiceError> {
    let manager = ManagerClient::new(dbus).await?;
    let state = ManagerState { manager };
    Ok(Router::new()
        .route("/probe", post(probe_action))
        .route("/install", post(install_action))
        .route("/finish", post(finish_action))
        .route("/status", get(status))
        .with_state(state))
}

/// Starts the probing process.
#[utoipa::path(get, path = "/api/manager/probe", responses(
  (status = 200, description = "The probing process was started.")
))]
async fn probe_action(State(state): State<ManagerState<'_>>) -> Result<(), ManagerError> {
    state.manager.probe().await?;
    Ok(())
}

/// Starts the probing process.
#[utoipa::path(get, path = "/api/manager/install", responses(
  (status = 200, description = "The installation process was started.")
))]
async fn install_action(State(state): State<ManagerState<'_>>) -> Result<(), ManagerError> {
    state.manager.install().await?;
    Ok(())
}

/// Executes the post installation tasks (e.g., rebooting the system).
#[utoipa::path(get, path = "/api/manager/install", responses(
  (status = 200, description = "The installation tasks are executed.")
))]
async fn finish_action(State(state): State<ManagerState<'_>>) -> Result<(), ManagerError> {
    state.manager.finish().await?;
    Ok(())
}

/// Returns the manager status.
#[utoipa::path(get, path = "/api/manager/status", responses(
  (status = 200, description = "Manager status.", body = ManagerStatus)
))]
async fn status(
    State(state): State<ManagerState<'_>>,
) -> Result<Json<ManagerStatus>, ManagerError> {
    let status = ManagerStatus {
        phase: state.manager.current_installation_phase().await?,
        busy: state.manager.busy_services().await?,
    };
    Ok(Json(status))
}
