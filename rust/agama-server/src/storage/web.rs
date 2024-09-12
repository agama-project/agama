//! This module implements the web API for the storage service.
//!
//! The module offers two public functions:
//!
//! * `storage_service` which returns the Axum service.
//! * `storage_stream` which offers an stream that emits the storage events coming from D-Bus.

use agama_lib::{
    error::ServiceError,
    storage::{
        model::{Action, Device, DeviceSid, ProposalSettings, ProposalSettingsPatch, Volume},
        proxies::Storage1Proxy,
        StorageClient, StorageSettings,
    },
};
use axum::{
    extract::{Query, State},
    routing::{get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tokio_stream::{Stream, StreamExt};

pub mod dasd;
pub mod iscsi;

use crate::{
    error::Error,
    storage::web::{
        dasd::{dasd_service, dasd_stream},
        iscsi::{iscsi_service, iscsi_stream},
    },
    web::{
        common::{
            issues_router, jobs_service, progress_router, service_status_router, EventStreams,
        },
        Event,
    },
};

pub async fn storage_streams(dbus: zbus::Connection) -> Result<EventStreams, Error> {
    let mut result: EventStreams = vec![(
        "devices_dirty",
        Box::pin(devices_dirty_stream(dbus.clone()).await?),
    )];
    let mut iscsi = iscsi_stream(&dbus).await?;
    let mut dasd = dasd_stream(&dbus).await?;

    result.append(&mut iscsi);
    result.append(&mut dasd);
    Ok(result)
}

async fn devices_dirty_stream(dbus: zbus::Connection) -> Result<impl Stream<Item = Event>, Error> {
    let proxy = Storage1Proxy::new(&dbus).await?;
    let stream = proxy
        .receive_deprecated_system_changed()
        .await
        .then(|change| async move {
            if let Ok(value) = change.get().await {
                return Some(Event::DevicesDirty { dirty: value });
            }
            None
        })
        .filter_map(|e| e);
    Ok(stream)
}

#[derive(Clone)]
struct StorageState<'a> {
    client: StorageClient<'a>,
}

/// Sets up and returns the axum service for the storage module.
pub async fn storage_service(dbus: zbus::Connection) -> Result<Router, ServiceError> {
    const DBUS_SERVICE: &str = "org.opensuse.Agama.Storage1";
    const DBUS_PATH: &str = "/org/opensuse/Agama/Storage1";
    const DBUS_DESTINATION: &str = "org.opensuse.Agama.Storage1";

    let status_router = service_status_router(&dbus, DBUS_SERVICE, DBUS_PATH).await?;
    let progress_router = progress_router(&dbus, DBUS_SERVICE, DBUS_PATH).await?;
    let issues_router = issues_router(&dbus, DBUS_SERVICE, DBUS_PATH).await?;
    let iscsi_router = iscsi_service(&dbus).await?;
    let dasd_router = dasd_service(&dbus).await?;
    let jobs_router = jobs_service(&dbus, DBUS_DESTINATION, DBUS_PATH).await?;

    let client = StorageClient::new(dbus.clone()).await?;
    let state = StorageState { client };
    let router = Router::new()
        .route("/config", put(set_config).get(get_config))
        .route("/probe", post(probe))
        .route("/devices/dirty", get(devices_dirty))
        .route("/devices/system", get(system_devices))
        .route("/devices/result", get(staging_devices))
        .route("/product/volume_for", get(volume_for))
        .route("/product/params", get(product_params))
        .route("/proposal/actions", get(actions))
        .route("/proposal/usable_devices", get(usable_devices))
        .route(
            "/proposal/settings",
            get(get_proposal_settings).put(set_proposal_settings),
        )
        .merge(progress_router)
        .merge(status_router)
        .merge(jobs_router)
        .nest("/issues", issues_router)
        .nest("/iscsi", iscsi_router)
        .nest("/dasd", dasd_router)
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
async fn get_config(State(state): State<StorageState<'_>>) -> Result<Json<StorageSettings>, Error> {
    // StorageSettings is just a wrapper over serde_json::value::RawValue
    let settings = state
        .client
        .get_config()
        .await
        .map_err(|e| Error::Service(e))?;
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
    Json(settings): Json<StorageSettings>,
) -> Result<Json<()>, Error> {
    let _status: u32 = state
        .client
        .set_config(settings)
        .await
        .map_err(|e| Error::Service(e))?;
    Ok(Json(()))
}

/// Probes the storage devices.
#[utoipa::path(
    post,
    path = "/probe",
    context_path = "/api/storage",
    responses(
        (status = 200, description = "Devices were probed and an initial proposal were performed"),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn probe(State(state): State<StorageState<'_>>) -> Result<Json<()>, Error> {
    Ok(Json(state.client.probe().await?))
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
    path = "/proposal/actions",
    context_path = "/api/storage",
    responses(
        (status = 200, description = "List of actions", body = Vec<Action>),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn actions(State(state): State<StorageState<'_>>) -> Result<Json<Vec<Action>>, Error> {
    Ok(Json(state.client.actions().await?))
}

/// Gets the SID (Storage ID) of the devices usable for the installation.
///
/// Note that not all the existing devices can be selected as target device for the installation.
#[utoipa::path(
    get,
    path = "/proposal/usable_devices",
    context_path = "/api/storage",
    responses(
        (status = 200, description = "Lis of SIDs", body = Vec<DeviceSid>),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn usable_devices(
    State(state): State<StorageState<'_>>,
) -> Result<Json<Vec<DeviceSid>>, Error> {
    let sids = state.client.available_devices().await?;
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
