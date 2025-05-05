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

//! This module implements the web API for the handling of DASD storage service.
//!
//! The module offers two public functions:
//!
//! * `dasd_service` which returns the Axum service.
//! * `dasd_stream` which offers an stream that emits the DASD-related events coming from D-Bus.

use agama_lib::{
    error::ServiceError,
    storage::{client::dasd::DASDClient, model::dasd::DASDDevice, settings::dasd::DASDConfig},
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
        .route("/supported", get(supported))
        .route("/config", get(get_config).put(set_config))
        .route("/devices", get(devices))
        .route("/probe", post(probe))
        .route("/format", post(format))
        .route("/enable", post(enable))
        .route("/disable", post(disable))
        .route("/diag", put(set_diag))
        .with_state(state);
    Ok(router)
}

/// Returns whether DASD technology is supported or not
#[utoipa::path(
    get,
    path="/supported",
    context_path="/api/storage/dasd",
    operation_id = "dasd_supported",
    responses(
        (status = OK, description = "Returns whether DASD technology is supported")
    )
)]
async fn supported(State(state): State<DASDState<'_>>) -> Result<Json<bool>, Error> {
    Ok(Json(state.client.supported().await?))
}

/// Returns DASD config
#[utoipa::path(
    get,
    path="/config",
    context_path="/api/storage/dasd",
    operation_id = "dasd_get_config",
    responses(
        (status = OK, description = "Returns DASD config", body=DASDConfig)
    )
)]
async fn get_config(State(state): State<DASDState<'_>>) -> Result<Json<DASDConfig>, Error> {
    Ok(Json(state.client.get_config().await?))
}

/// Returns DASD config
#[utoipa::path(
    put,
    path="/config",
    context_path="/api/storage/dasd",
    operation_id = "dasd_set_config",
    responses(
        (status = OK, description = "Sets DASD config")
    )
)]
async fn set_config(
    State(state): State<DASDState<'_>>,
    Json(config): Json<DASDConfig>,
) -> Result<(), Error> {
    Ok(state.client.set_config(config).await?)
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
    operation_id = "dasd_probe",
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
        (status = OK, description = "The formatting process started. The id of format job is in response.")
    )
)]
async fn format(
    State(state): State<DASDState<'_>>,
    Json(devices): Json<DevicesList>,
) -> Result<Json<String>, Error> {
    let path = state.client.format(&devices.as_references()).await?;
    Ok(Json(path))
}

/// Enables a set of devices.
#[utoipa::path(
    post,
    path="/enable",
    context_path="/api/storage/dasd",
    responses(
        (status = OK, description = "The DASD devices are enabled.")
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
        (status = OK, description = "The DASD devices are disabled.")
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
         (status = OK, description = "The DIAG properties are set.")
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

#[derive(Deserialize, utoipa::ToSchema)]
struct SetDiagParams {
    #[serde(flatten)]
    pub devices: DevicesList,
    pub diag: bool,
}

#[derive(Deserialize, utoipa::ToSchema)]
struct DevicesList {
    devices: Vec<String>,
}

impl DevicesList {
    pub fn as_references(&self) -> Vec<&str> {
        self.devices.iter().map(AsRef::as_ref).collect()
    }
}
