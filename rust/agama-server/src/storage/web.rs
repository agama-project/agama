// Copyright (c) [2024-2025] SUSE LLC
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

//! This module implements the web API for the storage service.
//!
//! The module offers two public functions:
//!
//! * `storage_service` which returns the Axum service.
//! * `storage_stream` which offers an stream that emits the storage events coming from D-Bus.

use std::sync::Arc;

use agama_lib::{
    auth::ClientId,
    error::ServiceError,
    event,
    http::OldEvent,
    storage::{
        model::{Action, Device, DeviceSid, ProposalSettings, ProposalSettingsPatch, Volume},
        proxies::Storage1Proxy,
        StorageClient, StorageSettings,
    },
};
use anyhow::Context;
use axum::{
    extract::{Query, State},
    routing::{get, post, put},
    Extension, Json, Router,
};
use iscsi::storage_iscsi_service;
use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;
use tokio_stream::{Stream, StreamExt};
use uuid::Uuid;
use zfcp::{zfcp_service, zfcp_stream};

pub mod dasd;
pub mod iscsi;
pub mod zfcp;

use crate::{
    error::Error,
    storage::web::{
        dasd::{dasd_service, dasd_stream},
        iscsi::iscsi_stream,
    },
    web::common::{
        jobs_service, service_status_router, EventStreams, ProgressClient, ProgressRouterBuilder,
    },
};

pub async fn storage_streams(dbus: zbus::Connection) -> Result<EventStreams, Error> {
    let mut result: EventStreams = vec![
        (
            "devices_dirty",
            Box::pin(devices_dirty_stream(dbus.clone()).await?),
        ),
        (
            "configured",
            Box::pin(configured_stream(dbus.clone()).await?),
        ),
    ];
    let mut iscsi = iscsi_stream(&dbus).await?;
    let mut dasd = dasd_stream(&dbus).await?;
    let mut zfcp = zfcp_stream(&dbus).await?;

    result.append(&mut iscsi);
    result.append(&mut dasd);
    result.append(&mut zfcp);
    Ok(result)
}

async fn devices_dirty_stream(
    dbus: zbus::Connection,
) -> Result<impl Stream<Item = OldEvent>, Error> {
    let proxy = Storage1Proxy::new(&dbus).await?;
    let stream = proxy
        .receive_deprecated_system_changed()
        .await
        .then(|change| async move {
            if let Ok(value) = change.get().await {
                return Some(event!(DevicesDirty { dirty: value }));
            }
            None
        })
        .filter_map(|e| e);
    Ok(stream)
}

async fn configured_stream(dbus: zbus::Connection) -> Result<impl Stream<Item = OldEvent>, Error> {
    let proxy = Storage1Proxy::new(&dbus).await?;
    let stream = proxy.receive_configured().await?.filter_map(|signal| {
        if let Ok(args) = signal.args() {
            if let Ok(uuid) = Uuid::parse_str(args.client_id) {
                return Some(event!(StorageChanged, &ClientId::new_from_uuid(uuid)));
            }
        }
        None
    });
    Ok(stream)
}

#[derive(Clone)]
struct StorageState<'a> {
    client: StorageClient<'a>,
}

/// Sets up and returns the axum service for the storage module.
pub async fn storage_service(
    dbus: zbus::Connection,
    progress: ProgressClient,
) -> Result<Router, ServiceError> {
    const DBUS_SERVICE: &str = "org.opensuse.Agama.Storage1";
    const DBUS_PATH: &str = "/org/opensuse/Agama/Storage1";
    const DBUS_DESTINATION: &str = "org.opensuse.Agama.Storage1";

    let status_router = service_status_router(&dbus, DBUS_SERVICE, DBUS_PATH).await?;
    // FIXME: use anyhow temporarily until we adapt all these methods to return
    // the crate::error::Error instead of ServiceError.
    let progress_router = ProgressRouterBuilder::new(DBUS_SERVICE, DBUS_PATH, progress)
        .build()
        .context("Could not build the progress router")?;
    let iscsi_router = storage_iscsi_service(&dbus).await?;
    let dasd_router = dasd_service(&dbus).await?;
    let zfcp_router = zfcp_service(&dbus).await?;
    let jobs_router = jobs_service(&dbus, DBUS_DESTINATION, DBUS_PATH).await?;

    let client = StorageClient::new(dbus.clone()).await?;
    let state = StorageState { client };
    let router = Router::new()
        .route("/config", put(set_config).get(get_config))
        .route("/config/reset", put(reset_config))
        .route("/config_model", put(set_config_model).get(get_config_model))
        .route("/config_model/solve", get(solve_config_model))
        .route("/probe", post(probe))
        .route("/reprobe", post(reprobe))
        .route("/reactivate", post(reactivate))
        .route("/devices/dirty", get(devices_dirty))
        .route("/devices/system", get(system_devices))
        .route("/devices/result", get(staging_devices))
        .route("/devices/actions", get(actions))
        .route("/devices/available_drives", get(available_drives))
        .route("/devices/candidate_drives", get(candidate_drives))
        .route("/devices/available_md_raids", get(available_md_raids))
        .route("/devices/candidate_md_raids", get(candidate_md_raids))
        .route("/product/volume_for", get(volume_for))
        .route("/product/params", get(product_params))
        .route(
            "/proposal/settings",
            get(get_proposal_settings).put(set_proposal_settings),
        )
        .merge(progress_router)
        .merge(status_router)
        .merge(jobs_router)
        .nest("/iscsi", iscsi_router)
        .nest("/dasd", dasd_router)
        .nest("/zfcp", zfcp_router)
        .with_state(state);
    Ok(router)
}

/// Returns the storage configuration.
///
/// * `state` : service state.
#[utoipa::path(
    get,
    path = "/config",
    context_path = "/api/storage",
    operation_id = "get_storage_config",
    responses(
        (status = 200, description = "storage configuration", body = StorageSettings),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn get_config(
    State(state): State<StorageState<'_>>,
) -> Result<Json<Option<StorageSettings>>, Error> {
    // StorageSettings is just a wrapper over serde_json::value::RawValue
    let settings = state.client.get_config().await.map_err(Error::Service)?;
    Ok(Json(settings))
}

/// Sets the storage configuration.
///
/// * `state`: service state.
/// * `config`: storage configuration.
#[utoipa::path(
    put,
    path = "/config",
    context_path = "/api/storage",
    operation_id = "set_storage_config",
    responses(
        (status = 200, description = "Set the storage configuration"),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn set_config(
    State(state): State<StorageState<'_>>,
    Extension(client_id): Extension<Arc<ClientId>>,
    Json(settings): Json<StorageSettings>,
) -> Result<Json<()>, Error> {
    let _status: u32 = state
        .client
        .set_config(settings, client_id.to_string())
        .await
        .map_err(Error::Service)?;
    Ok(Json(()))
}

/// Returns the storage config model.
///
/// * `state` : service state.
#[utoipa::path(
    get,
    path = "/config_model",
    context_path = "/api/storage",
    operation_id = "get_storage_config_model",
    responses(
        (status = 200, description = "storage config model", body = String),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn get_config_model(
    State(state): State<StorageState<'_>>,
    Extension(client_id): Extension<Arc<ClientId>>,
) -> Result<Json<Box<RawValue>>, Error> {
    tracing::debug!("{client_id:?}");
    let config_model = state
        .client
        .get_config_model()
        .await
        .map_err(Error::Service)?;
    Ok(Json(config_model))
}

/// Resets the storage config to the default value.
///
/// * `state`: service state.
#[utoipa::path(
    put,
    path = "/config/reset",
    context_path = "/api/storage",
    operation_id = "reset_storage_config",
    responses(
        (status = 200, description = "Reset the storage configuration"),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn reset_config(
    State(state): State<StorageState<'_>>,
    Extension(client_id): Extension<Arc<ClientId>>,
) -> Result<Json<()>, Error> {
    let _status: u32 = state
        .client
        .reset_config(client_id.to_string())
        .await
        .map_err(Error::Service)?;
    Ok(Json(()))
}

/// Sets the storage config model.
///
/// * `state`: service state.
/// * `config_model`: storage config model.
#[utoipa::path(
    put,
    request_body = String,
    path = "/config_model",
    context_path = "/api/storage",
    operation_id = "set_storage_config_model",
    responses(
        (status = 200, description = "Set the storage config model"),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn set_config_model(
    State(state): State<StorageState<'_>>,
    Extension(client_id): Extension<Arc<ClientId>>,
    Json(model): Json<Box<RawValue>>,
) -> Result<Json<()>, Error> {
    let _status: u32 = state
        .client
        .set_config_model(model, client_id.to_string())
        .await
        .map_err(Error::Service)?;
    Ok(Json(()))
}

/// Solves a storage config model.
#[utoipa::path(
    get,
    path = "/config_model/solve",
    context_path = "/api/storage",
    params(SolveModelQuery),
    operation_id = "solve_storage_config_model",
    responses(
        (status = 200, description = "Solve the storage config model", body = String),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn solve_config_model(
    State(state): State<StorageState<'_>>,
    query: Query<SolveModelQuery>,
) -> Result<Json<Box<RawValue>>, Error> {
    let solved_model = state
        .client
        .solve_config_model(query.model.as_str())
        .await
        .map_err(Error::Service)?;
    Ok(Json(solved_model))
}

#[derive(Deserialize, utoipa::IntoParams)]
struct SolveModelQuery {
    /// Serialized config model.
    model: String,
}

/// Probes the storage devices.
#[utoipa::path(
    post,
    path = "/probe",
    context_path = "/api/storage",
    responses(
        (status = 200, description = "Devices were probed and an initial proposal was performed"),
        (status = 400, description = "The D-Bus service could not perform the action")
    ),
    operation_id = "storage_probe"
)]
async fn probe(
    State(state): State<StorageState<'_>>,
    Extension(client_id): Extension<Arc<ClientId>>,
) -> Result<Json<()>, Error> {
    Ok(Json(state.client.probe(client_id.to_string()).await?))
}

/// Reprobes the storage devices.
#[utoipa::path(
    post,
    path = "/reprobe",
    context_path = "/api/storage",
    responses(
        (status = 200, description = "Devices were probed and the proposal was recalculated"),
        (status = 400, description = "The D-Bus service could not perform the action")
    ),
    operation_id = "storage_reprobe"
)]
async fn reprobe(
    State(state): State<StorageState<'_>>,
    Extension(client_id): Extension<Arc<ClientId>>,
) -> Result<Json<()>, Error> {
    Ok(Json(state.client.reprobe(client_id.to_string()).await?))
}

/// Reactivate the storage devices.
#[utoipa::path(
    post,
    path = "/reactivate",
    context_path = "/api/reactivate",
    responses(
        (status = 200, description = "Devices were reactivated and probed, and the proposal was recalculated"),
        (status = 400, description = "The D-Bus service could not perform the action")
    ),
    operation_id = "storage_reactivate"
)]
async fn reactivate(
    State(state): State<StorageState<'_>>,
    Extension(client_id): Extension<Arc<ClientId>>,
) -> Result<Json<()>, Error> {
    Ok(Json(state.client.reactivate(client_id.to_string()).await?))
}

/// Gets whether the system is in a deprecated status.
///
/// The system is usually set as deprecated as effect of managing some kind of devices, for example,
/// when iSCSI sessions are created or when a zFCP disk is activated.
///
/// A deprecated system means that the probed system could not match with the current system.
///
/// It is expected that clients probe devices again if the system is deprecated.
#[utoipa::path(
    get,
    path = "/devices/dirty",
    context_path = "/api/storage",
    responses(
        (status = 200, description = "Whether the devices have changed", body = bool),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn devices_dirty(State(state): State<StorageState<'_>>) -> Result<Json<bool>, Error> {
    Ok(Json(state.client.devices_dirty_bit().await?))
}

/// Gets the probed devices.
#[utoipa::path(
    get,
    path = "/devices/system",
    context_path = "/api/storage",
    responses(
        (status = 200, description = "List of devices", body = Vec<Device>),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn system_devices(State(state): State<StorageState<'_>>) -> Result<Json<Vec<Device>>, Error> {
    Ok(Json(state.client.system_devices().await?))
}

/// Gets the resulting devices of applying the requested actions.
#[utoipa::path(
    get,
    path = "/devices/result",
    context_path = "/api/storage",
    responses(
        (status = 200, description = "List of devices", body = Vec<Device>),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn staging_devices(
    State(state): State<StorageState<'_>>,
) -> Result<Json<Vec<Device>>, Error> {
    Ok(Json(state.client.staging_devices().await?))
}

/// Gets the default values for a volume with the given mount path.
#[utoipa::path(
    get,
    path = "/product/volume_for",
    context_path = "/api/storage",
    params(VolumeForQuery),
    responses(
        (status = 200, description = "Volume specification", body = Volume),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn volume_for(
    State(state): State<StorageState<'_>>,
    query: Query<VolumeForQuery>,
) -> Result<Json<Volume>, Error> {
    Ok(Json(
        state.client.volume_for(query.mount_path.as_str()).await?,
    ))
}

#[derive(Deserialize, utoipa::IntoParams)]
struct VolumeForQuery {
    /// Mount path of the volume (empty for an arbitrary volume).
    mount_path: String,
}

/// Gets information about the selected product.
#[utoipa::path(
    get,
    path = "/product/params",
    context_path = "/api/storage",
    responses(
        (status = 200, description = "Product information", body = ProductParams),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn product_params(
    State(state): State<StorageState<'_>>,
) -> Result<Json<ProductParams>, Error> {
    let params = ProductParams {
        mount_points: state.client.product_mount_points().await?,
        encryption_methods: state.client.encryption_methods().await?,
    };
    Ok(Json(params))
}

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProductParams {
    /// Mount points defined by the product.
    mount_points: Vec<String>,
    /// Encryption methods allowed by the product.
    encryption_methods: Vec<String>,
}

/// Gets the actions to perform in the storage devices.
#[utoipa::path(
    get,
    path = "/devices/actions",
    context_path = "/api/storage",
    responses(
        (status = 200, description = "List of actions", body = Vec<Action>),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn actions(State(state): State<StorageState<'_>>) -> Result<Json<Vec<Action>>, Error> {
    Ok(Json(state.client.actions().await?))
}

/// Gets the SID (Storage ID) of the available drives for the installation.
#[utoipa::path(
    get,
    path = "/devices/available_drives",
    context_path = "/api/storage",
    responses(
        (status = 200, description = "Lis of SIDs", body = Vec<DeviceSid>),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn available_drives(
    State(state): State<StorageState<'_>>,
) -> Result<Json<Vec<DeviceSid>>, Error> {
    let sids = state.client.available_drives().await?;
    Ok(Json(sids))
}

/// Gets the SID (Storage ID) of the candidate drives for the installation.
#[utoipa::path(
    get,
    path = "/devices/candidate_drives",
    context_path = "/api/storage",
    responses(
        (status = 200, description = "Lis of SIDs", body = Vec<DeviceSid>),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn candidate_drives(
    State(state): State<StorageState<'_>>,
) -> Result<Json<Vec<DeviceSid>>, Error> {
    let sids = state.client.candidate_drives().await?;
    Ok(Json(sids))
}

/// Gets the SID (Storage ID) of the available MD RAIDs for the installation.
#[utoipa::path(
    get,
    path = "/devices/available_md_raids",
    context_path = "/api/storage",
    responses(
        (status = 200, description = "Lis of SIDs", body = Vec<DeviceSid>),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn available_md_raids(
    State(state): State<StorageState<'_>>,
) -> Result<Json<Vec<DeviceSid>>, Error> {
    let sids = state.client.available_md_raids().await?;
    Ok(Json(sids))
}

/// Gets the SID (Storage ID) of the candidate MD RAIDs for the installation.
#[utoipa::path(
    get,
    path = "/devices/candidate_md_raids",
    context_path = "/api/storage",
    responses(
        (status = 200, description = "Lis of SIDs", body = Vec<DeviceSid>),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn candidate_md_raids(
    State(state): State<StorageState<'_>>,
) -> Result<Json<Vec<DeviceSid>>, Error> {
    let sids = state.client.candidate_md_raids().await?;
    Ok(Json(sids))
}

/// Gets the settings that were used for calculating the current proposal.
#[utoipa::path(
    get,
    path = "/proposal/settings",
    context_path = "/api/storage",
    responses(
        (status = 200, description = "Settings", body = ProposalSettings),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn get_proposal_settings(
    State(state): State<StorageState<'_>>,
) -> Result<Json<ProposalSettings>, Error> {
    Ok(Json(state.client.proposal_settings().await?))
}

/// Tries to calculates a new proposal with the given settings.
#[utoipa::path(
    put,
    path = "/proposal/settings",
    context_path = "/api/storage",
    request_body(content = ProposalSettingsPatch, description = "Proposal settings", content_type = "application/json"),
    responses(
        (status = 200, description = "Whether the proposal was successfully calculated", body = bool),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn set_proposal_settings(
    State(state): State<StorageState<'_>>,
    Json(config): Json<ProposalSettingsPatch>,
) -> Result<Json<bool>, Error> {
    let result = state.client.calculate(config).await?;
    Ok(Json(result == 0))
}
