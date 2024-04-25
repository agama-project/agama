//! This module implements the web API for the storage service.
//!
//! The module offers two public functions:
//!
//! * `storage_service` which returns the Axum service.
//! * `storage_stream` which offers an stream that emits the storage events coming from D-Bus.

use agama_lib::{error::ServiceError, storage::device::Device, storage::StorageClient};
use axum::{extract::State, routing::get, Json, Router};

use crate::{
    error::Error,
    web::{
        common::{issues_router, progress_router, service_status_router, EventStreams},
        Event,
    },
};

pub async fn storage_streams(dbus: zbus::Connection) -> Result<EventStreams, Error> {
    let result: EventStreams = vec![]; // TODO:
    Ok(result)
}

#[derive(Clone)]
struct StorageState<'a> {
    client: StorageClient<'a>,
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
        .merge(status_router)
        .merge(progress_router)
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
