//! This module implements the web API for the storage service.
//!
//! The module offers two public functions:
//!
//! * `storage_service` which returns the Axum service.
//! * `storage_stream` which offers an stream that emits the storage events coming from D-Bus.

use std::collections::HashMap;

use agama_lib::{
    error::ServiceError,
    storage::{
        model::{Action, Device, ProposalSettings, ProposalSettingsPatch, Volume}, proxies::Storage1Proxy, StorageClient
    },
};
use anyhow::anyhow;
use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use tokio_stream::{Stream, StreamExt};
use serde::Serialize;

use crate::{
    error::Error,
    web::{
        common::{issues_router, progress_router, service_status_router, EventStreams},
        Event,
    },
};

pub async fn storage_streams(dbus: zbus::Connection) -> Result<EventStreams, Error> {
    let result: EventStreams = vec![
        (
            "devices_dirty",
            Box::pin(devices_dirty_stream(dbus.clone()).await?),
        ),
    ]; // TODO:
    Ok(result)
}

async fn devices_dirty_stream(
    dbus: zbus::Connection,
) -> Result<impl Stream<Item = Event>, Error> {
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

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProductParams {
    /// List of mount points defined in product
    mount_points: Vec<String>,
    /// list of encryption methods defined in product
    encryption_methods: Vec<String>,
}

/// Sets up and returns the axum service for the software module.
pub async fn storage_service(dbus: zbus::Connection) -> Result<Router, ServiceError> {
    const DBUS_SERVICE: &str = "org.opensuse.Agama.Storage1";
    const DBUS_PATH: &str = "/org/opensuse/Agama/Storage1";

    let status_router = service_status_router(&dbus, DBUS_SERVICE, DBUS_PATH).await?;
    let progress_router = progress_router(&dbus, DBUS_SERVICE, DBUS_PATH).await?;
    let issues_router = issues_router(&dbus, DBUS_SERVICE, DBUS_PATH).await?;

    let client = StorageClient::new(dbus.clone()).await?;
    let state = StorageState { client };
    let router = Router::new()
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
        .nest("/issues", issues_router)
        .with_state(state);
    Ok(router)
}

async fn devices_dirty(State(state): State<StorageState<'_>>) -> Result<Json<bool>, Error> {
    Ok(Json(state.client.devices_dirty_bit().await?))
}

async fn system_devices(State(state): State<StorageState<'_>>) -> Result<Json<Vec<Device>>, Error> {
    Ok(Json(state.client.system_devices().await?))
}

async fn staging_devices(
    State(state): State<StorageState<'_>>,
) -> Result<Json<Vec<Device>>, Error> {
    Ok(Json(state.client.staging_devices().await?))
}

async fn actions(State(state): State<StorageState<'_>>) -> Result<Json<Vec<Action>>, Error> {
    Ok(Json(state.client.actions().await?))
}

async fn volume_for(
    State(state): State<StorageState<'_>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Volume>, Error> {
    let mount_path = params
        .get("mount_path")
        .ok_or(anyhow!("Missing mount_path parameter"))?;
    Ok(Json(state.client.volume_for(mount_path).await?))
}

async fn product_params(
    State(state): State<StorageState<'_>>,
) -> Result<Json<ProductParams>, Error> {
    let params = ProductParams {
        mount_points: state.client.product_mount_points().await?,
        encryption_methods: state.client.encryption_methods().await?,
    };
    Ok(Json(params))
}

async fn usable_devices(State(state): State<StorageState<'_>>) -> Result<Json<String>, Error> {
    let devices = state.client.available_devices().await?;
    let devices_names = devices.into_iter().map(|d| d.name).collect();

    Ok(Json(devices_names))
}

async fn get_proposal_settings(
    State(state): State<StorageState<'_>>,
) -> Result<Json<ProposalSettings>, Error> {
    Ok(Json(state.client.proposal_settings().await?))
}

async fn set_proposal_settings(
    State(state): State<StorageState<'_>>,
    Json(config): Json<ProposalSettingsPatch>,
) -> Result<(), Error> {
    state.client.calculate2(config).await?;

    Ok(())
}
