//! This module implements the web API for the manager service.
//!
//! The module offers two public functions:
//!
//! * `manager_service` which returns the Axum service.
//! * `manager_stream` which offers an stream that emits the manager events coming from D-Bus.

use agama_lib::{
    error::ServiceError,
    manager::{InstallationPhase, ManagerClient},
    proxies::Manager1Proxy,
};
use axum::{
    extract::{Request, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use rand::distributions::{Alphanumeric, DistString};
use serde::Serialize;
use std::{pin::Pin, process::Command};
use tokio_stream::{Stream, StreamExt};
use tower_http::services::ServeFile;

use crate::{
    error::Error,
    web::{
        common::{progress_router, service_status_router},
        Event,
    },
};

#[derive(Clone)]
pub struct ManagerState<'a> {
    dbus: zbus::Connection,
    manager: ManagerClient<'a>,
}

/// Holds information about the manager's status.
#[derive(Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct InstallerStatus {
    /// Current installation phase.
    phase: InstallationPhase,
    /// Whether the service is busy.
    is_busy: bool,
    /// Whether Agama is running on Iguana.
    use_iguana: bool,
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
    let manager = ManagerClient::new(dbus.clone()).await?;
    let state = ManagerState { manager, dbus };
    Ok(Router::new()
        .route("/probe", post(probe_action))
        .route("/install", post(install_action))
        .route("/finish", post(finish_action))
        .route("/installer", get(installer_status))
        .route("/logs", get(download_logs))
        .merge(status_router)
        .merge(progress_router)
        .with_state(state))
}

/// Starts the probing process.
// The Probe D-Bus method is blocking and will not return until the probing is finished. To avoid a
// long-lived HTTP connection, this method returns immediately (with a 200) and runs the request on
// a separate task.
#[utoipa::path(
    get,
    path = "/probe",
    context_path = "/api/manager",
    responses(
      (
          status = 200,
          description = "The probing was requested but there is no way to know whether it succeeded."
       )
    )
)]
async fn probe_action(State(state): State<ManagerState<'_>>) -> Result<(), Error> {
    let dbus = state.dbus.clone();
    tokio::spawn(async move {
        let result = dbus
            .call_method(
                Some("org.opensuse.Agama.Manager1"),
                "/org/opensuse/Agama/Manager1",
                Some("org.opensuse.Agama.Manager1"),
                "Probe",
                &(),
            )
            .await;
        if let Err(error) = result {
            tracing::error!("Could not start probing: {:?}", error);
        }
    });
    Ok(())
}

/// Starts the probing process.
#[utoipa::path(
    get,
    path = "/install",
    context_path = "/api/manager",
    responses(
      (status = 200, description = "The installation process was started.")
    )
)]
async fn install_action(State(state): State<ManagerState<'_>>) -> Result<(), Error> {
    state.manager.install().await?;
    Ok(())
}

/// Executes the post installation tasks (e.g., rebooting the system).
#[utoipa::path(
    get,
    path = "/install",
    context_path = "/api/manager",
    responses(
      (status = 200, description = "The installation tasks are executed.")
    )
)]
async fn finish_action(State(state): State<ManagerState<'_>>) -> Result<(), Error> {
    state.manager.finish().await?;
    Ok(())
}

/// Returns the manager status.
#[utoipa::path(
    get,
    path = "/installer",
    context_path = "/api/manager",
    responses(
      (status = 200, description = "Installation status.", body = InstallerStatus)
    )
)]
async fn installer_status(
    State(state): State<ManagerState<'_>>,
) -> Result<Json<InstallerStatus>, Error> {
    let phase = state.manager.current_installation_phase().await?;
    // CanInstall gets blocked during installation
    let can_install = match phase {
        InstallationPhase::Install => false,
        _ => state.manager.can_install().await?,
    };
    let status = InstallerStatus {
        phase,
        can_install,
        is_busy: state.manager.is_busy().await,
        use_iguana: state.manager.use_iguana().await?,
    };
    Ok(Json(status))
}

/// Returns agama logs
#[utoipa::path(get, path = "/api/manager/logs", responses(
  (status = 200, description = "Download logs blob.")
))]

pub async fn download_logs() -> impl IntoResponse {
    let path = generate_logs().await;
    let Ok(path) = path else {
        return (StatusCode::INTERNAL_SERVER_ERROR).into_response();
    };

    match ServeFile::new(path)
        .try_call(Request::new(axum::body::Body::empty()))
        .await
    {
        Ok(res) => res.into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR).into_response(),
    }
}

async fn generate_logs() -> Result<String, Error> {
    let random_name: String = Alphanumeric.sample_string(&mut rand::thread_rng(), 8);
    let path = format!("/run/agama/logs_{random_name}");

    Command::new("agama")
        .args(["logs", "store", "-d", path.as_str()])
        .status()
        .map_err(|e| ServiceError::CannotGenerateLogs(e.to_string()))?;

    let full_path = format!("{path}.tar.gz");
    Ok(full_path)
}
