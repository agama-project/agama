//! This module implements the web API for the handling of DASD storage service.
//!
//! The module offers two public functions:
//!
//! * `dasd_service` which returns the Axum service.
//! * `dasd_stream` which offers an stream that emits the DASD-related events coming from D-Bus.

use agama_lib::{
    error::ServiceError,
    storage::{client::dasd::DASDClient, model::dasd::DASDDevice},
};
use axum::{
    extract::State,
    routing::{get, post, put},
    Json, Router,
};
use serde::Deserialize;

use crate::{error::Error, web::common::EventStreams};

use self::stream::{DASDDeviceStream, DASDFormatJobStream};

mod stream;

/// Returns the stream of DASD-related events.
///
/// The stream combines the following events:
///
/// * Changes on the DASD devices collection.
///
/// * `dbus`: D-Bus connection to use.
pub async fn dasd_stream(dbus: &zbus::Connection) -> Result<EventStreams, Error> {
    let stream: EventStreams = vec![
        ("dasd_devices", Box::pin(DASDDeviceStream::new(dbus).await?)),
        (
            "format_jobs",
            Box::pin(DASDFormatJobStream::new(dbus).await?),
        ),
    ];
    Ok(stream)
}

#[derive(Clone)]
struct DASDState<'a> {
    client: DASDClient<'a>,
}

pub async fn dasd_service<T>(dbus: &zbus::Connection) -> Result<Router<T>, ServiceError> {
    let client = DASDClient::new(dbus.clone()).await?;
    let state = DASDState { client };
    let router = Router::new()
        .route("/devices", get(devices))
        .route("/probe", post(probe))
        .route("/format", post(format))
        .route("/enable", post(enable))
        .route("/disable", post(disable))
        .route("/diag", put(set_diag))
        .with_state(state);
    Ok(router)
}

/// Returns the list of known DASD devices.
#[utoipa::path(
    get,
    path="/devices",
    context_path="/api/storage/dasd",
    responses(
        (status = OK, description = "List of DASD devices", body = Vec<DASDDevice>)
    )
)]
async fn devices(State(state): State<DASDState<'_>>) -> Result<Json<Vec<DASDDevice>>, Error> {
    let devices = state
        .client
        .devices()
        .await?
        .into_iter()
        .map(|(_path, device)| device)
        .collect();
    Ok(Json(devices))
}

/// Find DASD devices in the system.
#[utoipa::path(
    post,
    path="/probe",
    context_path="/api/storage/dasd",
    responses(
        (status = OK, description = "The probing process ran successfully")
    )
)]
async fn probe(State(state): State<DASDState<'_>>) -> Result<Json<()>, Error> {
    Ok(Json(state.client.probe().await?))
}

/// Formats a set of devices.
#[utoipa::path(
    post,
    path="/format",
    context_path="/api/storage/dasd",
    responses(
        (status = OK, description = "The formatting process started.")
    )
)]
async fn format(
    State(state): State<DASDState<'_>>,
    Json(devices): Json<DevicesList>,
) -> Result<Json<()>, Error> {
    state.client.format(&devices.as_references()).await?;
    Ok(Json(()))
}

/// Enables a set of devices.
#[utoipa::path(
    post,
    path="/enable",
    context_path="/api/storage/dasd",
    responses(
        (status = OK, description = "The formatting process started.")
    )
)]
async fn enable(
    State(state): State<DASDState<'_>>,
    Json(devices): Json<DevicesList>,
) -> Result<Json<()>, Error> {
    state.client.enable(&devices.as_references()).await?;
    Ok(Json(()))
}

/// Disables a set of devices.
#[utoipa::path(
    post,
    path="/disable",
    context_path="/api/storage/dasd",
    responses(
        (status = OK, description = "The formatting process started.")
    )
)]
async fn disable(
    State(state): State<DASDState<'_>>,
    Json(devices): Json<DevicesList>,
) -> Result<Json<()>, Error> {
    state.client.disable(&devices.as_references()).await?;
    Ok(Json(()))
}

/// Sets the diag property for a set of devices.
#[utoipa::path(
     put,
     path="/diag",
     context_path="/api/storage/dasd",
     responses(
         (status = OK, description = "The formatting process started.")
     )
 )]
async fn set_diag(
    State(state): State<DASDState<'_>>,
    Json(params): Json<SetDiagParams>,
) -> Result<Json<()>, Error> {
    state
        .client
        .set_diag(&params.devices.as_references(), params.diag)
        .await?;
    Ok(Json(()))
}

#[derive(Deserialize)]
struct SetDiagParams {
    #[serde(flatten)]
    pub devices: DevicesList,
    pub diag: bool,
}

#[derive(Deserialize)]
struct DevicesList {
    devices: Vec<String>,
}

impl DevicesList {
    pub fn as_references(&self) -> Vec<&str> {
        self.devices.iter().map(AsRef::as_ref).collect()
    }
}
