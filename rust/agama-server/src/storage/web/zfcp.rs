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

//! This module implements the web API for the handling of zFCP storage service.
//!
//! The module offers two public functions:
//!
//! * `zfcp_service` which returns the Axum service.
//! * `zfcp_stream` which offers an stream that emits the zFCP-related events coming from D-Bus.

use agama_lib::{
    error::ServiceError,
    storage::{
        model::zfcp::{ZFCPController, ZFCPDisk},
        settings::zfcp::ZFCPConfig,
        ZFCPClient,
    },
};

use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use stream::{ZFCPControllerStream, ZFCPDiskStream};

mod stream;

use crate::{error::Error, web::common::EventStreams};

/// Returns the stream of zFCP-related events.
///
/// The stream combines the following events:
///
/// * Changes on the zFCP devices collection.
///
/// * `dbus`: D-Bus connection to use.
pub async fn zfcp_stream(dbus: &zbus::Connection) -> Result<EventStreams, Error> {
    let stream: EventStreams = vec![
        ("zfcp_disks", Box::pin(ZFCPDiskStream::new(dbus).await?)),
        (
            "zfcp_controllers",
            Box::pin(ZFCPControllerStream::new(dbus).await?),
        ),
    ];
    Ok(stream)
}

#[derive(Clone)]
struct ZFCPState<'a> {
    client: ZFCPClient<'a>,
}

pub async fn zfcp_service<T>(dbus: &zbus::Connection) -> Result<Router<T>, ServiceError> {
    let client = ZFCPClient::new(dbus.clone()).await?;
    let state = ZFCPState { client };
    let router = Router::new()
        .route("/supported", get(supported))
        .route("/controllers", get(controllers))
        .route(
            "/controllers/:controller_id/activate",
            post(activate_controller),
        )
        .route("/controllers/:controller_id/wwpns", get(get_wwpns))
        .route(
            "/controllers/:controller_id/wwpns/:wwpn_id/luns",
            get(get_luns),
        )
        .route(
            "/controllers/:controller_id/wwpns/:wwpn_id/luns/:lun_id/activate_disk",
            post(activate_disk),
        )
        .route(
            "/controllers/:controller_id/wwpns/:wwpn_id/luns/:lun_id/deactivate_disk",
            post(deactivate_disk),
        )
        .route("/disks", get(get_disks))
        .route("/probe", post(probe))
        .route("/global_config", get(get_global_config))
        .route("/config", get(get_config).put(set_config))
        .with_state(state);
    Ok(router)
}

/// Returns whether zFCP technology is supported or not
#[utoipa::path(
    get,
    path="/supported",
    context_path="/api/storage/zfcp",
    operation_id = "zfcp_supported",
    responses(
        (status = OK, description = "Returns whether zFCP technology is supported")
    )
)]
async fn supported(State(state): State<ZFCPState<'_>>) -> Result<Json<bool>, Error> {
    Ok(Json(state.client.supported().await?))
}

/// Returns zFCP configuration
#[utoipa::path(
    get,
    path="/config",
    context_path="/api/storage/zfcp",
    responses(
        (status = OK, description = "Returns zFCP configuration", body=ZFCPGlobalConfig)
    )
)]
async fn get_config(State(_state): State<ZFCPState<'_>>) -> Result<Json<ZFCPConfig>, Error> {
    // TODO: not implemented yet
    Ok(Json(ZFCPConfig { devices: vec![] }))
}

/// Sets zFCP configuration. Mainly for unattended installation.
#[utoipa::path(
    put,
    path="/config",
    context_path="/api/storage/zfcp",
    operation_id = "zfcp_set_config",
    responses(
        (status = OK, description = "Sets zFCP configuration")
    )
)]
async fn set_config(
    State(state): State<ZFCPState<'_>>,
    Json(config): Json<ZFCPConfig>,
) -> Result<(), Error> {
    Ok(state.client.set_config(config).await?)
}

/// Represents a zFCP global config (specific to s390x systems).
#[derive(Clone, Debug, Default, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ZFCPGlobalConfig {
    /// flag whenever allow_lun_scan is active
    pub allow_lun_scan: bool,
}

/// Returns global zFCP configuration
#[utoipa::path(
    get,
    path="/global_config",
    context_path="/api/storage/zfcp",
    responses(
        (status = OK, description = "Returns global zFCP configuration", body=ZFCPGlobalConfig)
    )
)]
async fn get_global_config(
    State(state): State<ZFCPState<'_>>,
) -> Result<Json<ZFCPGlobalConfig>, Error> {
    let lun_scan = state.client.is_lun_scan_allowed().await?;
    Ok(Json(ZFCPGlobalConfig {
        allow_lun_scan: lun_scan,
    }))
}

/// Returns the list of known zFCP disks.
#[utoipa::path(
    get,
    path="/disks",
    context_path="/api/storage/zfcp",
    responses(
        (status = OK, description = "List of ZFCP disks", body = Vec<ZFCPDisk>)
    )
)]
async fn get_disks(State(state): State<ZFCPState<'_>>) -> Result<Json<Vec<ZFCPDisk>>, Error> {
    let devices = state
        .client
        .get_disks()
        .await?
        .into_iter()
        .map(|(_path, device)| device)
        .collect();
    Ok(Json(devices))
}

/// Returns the list of known zFCP controllers.
#[utoipa::path(
    get,
    path="/controllers",
    context_path="/api/storage/zfcp",
    responses(
        (status = OK, description = "List of zFCP controllers", body = Vec<ZFCPController>)
    )
)]
async fn controllers(
    State(state): State<ZFCPState<'_>>,
) -> Result<Json<Vec<ZFCPController>>, Error> {
    let devices = state
        .client
        .get_controllers()
        .await?
        .into_iter()
        .map(|(_path, device)| device)
        .collect();
    Ok(Json(devices))
}

/// Activate given zFCP controller.
#[utoipa::path(
    post,
    path="/controllers/:controller_id/activate",
    context_path="/api/storage/zfcp",
    responses(
        (status = OK, description = "controller activated")
    )
)]
async fn activate_controller(
    State(state): State<ZFCPState<'_>>,
    Path(controller_id): Path<String>,
) -> Result<Json<()>, Error> {
    state
        .client
        .activate_controller(controller_id.as_str())
        .await?;
    Ok(Json(()))
}

/// List WWPNs for given controller.
#[utoipa::path(
    post,
    path="/controllers/:controller_id/wwpns",
    context_path="/api/storage/zfcp",
    responses(
        (status = OK, description = "List of WWPNs", body=Vec<String>)
    )
)]
async fn get_wwpns(
    State(state): State<ZFCPState<'_>>,
    Path(controller_id): Path<String>,
) -> Result<Json<Vec<String>>, Error> {
    let result = state.client.get_wwpns(controller_id.as_str()).await?;
    Ok(Json(result))
}

/// List LUNS for given controller and wwpn.
#[utoipa::path(
    post,
    path="/controllers/:controller_id/wwpns/:wwpn_id/luns",
    context_path="/api/storage/zfcp",
    responses(
        (status = OK, description = "list of luns", body=Vec<String>)
    )
)]
async fn get_luns(
    State(state): State<ZFCPState<'_>>,
    Path((controller_id, wwpn_id)): Path<(String, String)>,
) -> Result<Json<Vec<String>>, Error> {
    let result = state.client.get_luns(&controller_id, &wwpn_id).await?;
    Ok(Json(result))
}

/// Activates a disk on given controller with given WWPN id and LUN id.
#[utoipa::path(
    post,
    path="/controllers/:controller_id/wwpns/:wwpn_id/luns/:lun_id/activate_disk",
    context_path="/api/storage/zfcp",
    responses(
        (status = OK, description = "The activation was succesful.")
    )
)]
async fn activate_disk(
    State(state): State<ZFCPState<'_>>,
    Path((controller_id, wwpn_id, lun_id)): Path<(String, String, String)>,
) -> Result<Json<()>, Error> {
    state
        .client
        .activate_disk(&controller_id, &wwpn_id, &lun_id)
        .await?;
    Ok(Json(()))
}

/// Deactivates disk on given controller with given WWPN id and LUN id.
#[utoipa::path(
    post,
    path="/controllers/:controller_id/wwpns/:wwpn_id/luns/:lun_id/deactivate_disk",
    context_path="/api/storage/zfcp",
    responses(
        (status = OK, description = "The activation was succesful.")
    )
)]
async fn deactivate_disk(
    State(state): State<ZFCPState<'_>>,
    Path((controller_id, wwpn_id, lun_id)): Path<(String, String, String)>,
) -> Result<Json<()>, Error> {
    state
        .client
        .deactivate_disk(&controller_id, &wwpn_id, &lun_id)
        .await?;
    Ok(Json(()))
}

/// Find zFCP devices in the system.
#[utoipa::path(
    post,
    path="/probe",
    context_path="/api/storage/zfcp",
    operation_id = "zfcp_probe",
    responses(
        (status = OK, description = "The probing process ran successfully")
    )
)]
async fn probe(State(state): State<ZFCPState<'_>>) -> Result<Json<()>, Error> {
    Ok(Json(state.client.probe().await?))
}
