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

//! This module defines functions to be used accross all services.

use std::pin::Pin;

use agama_lib::{error::ServiceError, event, proxies::ServiceStatusProxy};
use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;
use tokio_stream::{Stream, StreamExt};

use crate::error::Error;

use super::OldEvent;

pub type EventStreams = Vec<(&'static str, Pin<Box<dyn Stream<Item = OldEvent> + Send>>)>;

/// Builds a router to the `org.opensuse.Agama1.ServiceStatus` interface of the
/// given D-Bus object.
///
/// ```no_run
/// # use axum::{extract::State, routing::get, Json, Router};
/// # use agama_lib::connection;
/// # use agama_server::web::common::service_status_router;
/// # use tokio_test;
///
/// # tokio_test::block_on(async {
/// async fn hello(state: State<HelloWorldState>) {};
///
/// #[derive(Clone)]
/// struct HelloWorldState {};
///
/// let dbus = connection().await.unwrap();
/// let status_router = service_status_router(
///   &dbus, "org.opensuse.HelloWorld", "/org/opensuse/hello"
/// ).await.unwrap();
/// let router: Router<HelloWorldState> = Router::new()
///   .route("/hello", get(hello))
///   .merge(status_router)
///   .with_state(HelloWorldState {});
/// });
/// ```
///
/// * `dbus`: D-Bus connection.
/// * `destination`: D-Bus service name.
/// * `path`: D-Bus object path.
pub async fn service_status_router<T>(
    dbus: &zbus::Connection,
    destination: &str,
    path: &str,
) -> Result<Router<T>, ServiceError> {
    let proxy = build_service_status_proxy(dbus, destination, path).await?;
    let state = ServiceStatusState { proxy };
    Ok(Router::new()
        .route("/status", get(service_status))
        .with_state(state))
}

async fn service_status(State(state): State<ServiceStatusState<'_>>) -> Json<ServiceStatus> {
    Json(ServiceStatus {
        current: state.proxy.current().await.unwrap(),
    })
}

#[derive(Clone)]
struct ServiceStatusState<'a> {
    proxy: ServiceStatusProxy<'a>,
}

#[derive(Clone, Serialize, utoipa::ToSchema)]
pub struct ServiceStatus {
    /// Current service status (0 = idle, 1 = busy).
    current: u32,
}

/// Builds a stream of the changes in the the `org.opensuse.Agama1.ServiceStatus`
/// interface of the given D-Bus object.
///
/// * `dbus`: D-Bus connection.
/// * `destination`: D-Bus service name.
/// * `path`: D-Bus object path.
pub async fn service_status_stream(
    dbus: zbus::Connection,
    destination: &'static str,
    path: &'static str,
) -> Result<Pin<Box<dyn Stream<Item = OldEvent> + Send>>, Error> {
    let proxy = build_service_status_proxy(&dbus, destination, path).await?;
    let stream = proxy
        .receive_current_changed()
        .await
        .then(move |change| async move {
            if let Ok(status) = change.get().await {
                Some(event!(ServiceStatusChanged {
                    service: destination.to_string(),
                    status,
                }))
            } else {
                None
            }
        })
        .filter_map(|e| e);
    Ok(Box::pin(stream))
}

async fn build_service_status_proxy<'a>(
    dbus: &zbus::Connection,
    destination: &str,
    path: &str,
) -> Result<ServiceStatusProxy<'a>, zbus::Error> {
    let proxy = ServiceStatusProxy::builder(dbus)
        .destination(destination.to_string())?
        .path(path.to_string())?
        .build()
        .await?;
    Ok(proxy)
}
