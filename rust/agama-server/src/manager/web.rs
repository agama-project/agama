//! This module implements the web API for the manager service.
//!
//! The module offers two public functions:
//!
//! * `manager_service` which returns the Axum service.
//! * `manager_stream` which offers an stream that emits the manager events coming from D-Bus.

use std::pin::Pin;

use agama_lib::{
    error::ServiceError,
    manager::{InstallationPhase, ManagerClient},
    proxies::Manager1Proxy,
};
use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use tokio_stream::{Stream, StreamExt};

use crate::{
    error::Error,
    web::{
        common::{progress_router, service_status_router},
        Event,
    },
};

#[derive(Clone)]
pub struct ManagerState<'a> {
    manager: ManagerClient<'a>,
}

/// Holds information about the manager's status.
#[derive(Clone, Serialize, utoipa::ToSchema)]
pub struct InstallerStatus {
    /// Current installation phase.
    phase: InstallationPhase,
    /// List of busy services.
    busy: Vec<String>,
    /// Whether Agama is running on Iguana.
    iguana: bool,
    /// Whether it is possible to start the installation.
    can_install: bool,
}

/// Returns a stream that emits manager related events coming from D-Bus.
///
/// It emits the Event::InstallationPhaseChanged event.
///
/// * `connection`: D-Bus connection to listen for events.
pub async fn manager_stream(
    dbus: zbus::Connection,
) -> Result<Pin<Box<dyn Stream<Item = Event> + Send>>, Error> {
    let proxy = Manager1Proxy::new(&dbus).await?;
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
    Ok(Box::pin(stream))
}

/// Sets up and returns the axum service for the manager module
pub async fn manager_service(dbus: zbus::Connection) -> Result<Router, ServiceError> {
    const DBUS_SERVICE: &str = "org.opensuse.Agama.Manager1";
    const DBUS_PATH: &str = "/org/opensuse/Agama/Manager1";

    let status_router = service_status_router(&dbus, DBUS_SERVICE, DBUS_PATH).await?;
    let progress_router = progress_router(&dbus, DBUS_SERVICE, DBUS_PATH).await?;
    let manager = ManagerClient::new(dbus).await?;
    let state = ManagerState { manager };
    Ok(Router::new()
        .route("/probe", post(probe_action))
        .route("/install", post(install_action))
        .route("/finish", post(finish_action))
        .route("/installer", get(installer_status))
        .merge(status_router)
        .merge(progress_router)
        .with_state(state))
}

/// Starts the probing process.
#[utoipa::path(get, path = "/api/manager/probe", responses(
  (status = 200, description = "The probing process was started.")
))]
async fn probe_action(State(state): State<ManagerState<'_>>) -> Result<(), Error> {
    state.manager.probe().await?;
    Ok(())
}

/// Starts the probing process.
#[utoipa::path(get, path = "/api/manager/install", responses(
  (status = 200, description = "The installation process was started.")
))]
async fn install_action(State(state): State<ManagerState<'_>>) -> Result<(), Error> {
    state.manager.install().await?;
    Ok(())
}

/// Executes the post installation tasks (e.g., rebooting the system).
#[utoipa::path(get, path = "/api/manager/install", responses(
  (status = 200, description = "The installation tasks are executed.")
))]
async fn finish_action(State(state): State<ManagerState<'_>>) -> Result<(), Error> {
    state.manager.finish().await?;
    Ok(())
}

/// Returns the manager status.
#[utoipa::path(get, path = "/api/manager/installer", responses(
  (status = 200, description = "Installation status.", body = ManagerStatus)
))]
async fn installer_status(
    State(state): State<ManagerState<'_>>,
) -> Result<Json<InstallerStatus>, Error> {
    let status = InstallerStatus {
        phase: state.manager.current_installation_phase().await?,
        busy: state.manager.busy_services().await?,
        can_install: state.manager.can_install().await?,
        iguana: state.manager.use_iguana().await?,
    };
    Ok(Json(status))
}
