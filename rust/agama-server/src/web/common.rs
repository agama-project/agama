//! This module defines functions to be used accross all services.

use agama_lib::{error::ServiceError, proxies::ServiceStatusProxy};
use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;
use tokio_stream::{Stream, StreamExt};

use crate::error::Error;

use super::Event;

/// Builds a router to the `org.opensuse.Agama1.ServiceStatus`
/// interface of the given D-Bus object.
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

#[derive(Clone, Serialize)]
struct ServiceStatus {
    /// Current service status.
    current: u32,
}

/// Builds a stream of the changes in the the `org.opensuse.Agama1.ServiceStatus`
/// interface of the given D-Bus object.
pub async fn service_status_stream(
    dbus: zbus::Connection,
    destination: &str,
    path: &str,
) -> Result<impl Stream<Item = Event>, Error> {
    let proxy = build_service_status_proxy(&dbus, destination, path).await?;
    let stream = proxy
        .receive_current_changed()
        .await
        .then(|change| async move {
            if let Ok(status) = change.get().await {
                Some(Event::StatusChanged { status })
            } else {
                None
            }
        })
        .filter_map(|e| e);
    Ok(stream)
}

async fn build_service_status_proxy<'a>(
    dbus: &zbus::Connection,
    destination: &str,
    path: &str,
) -> Result<ServiceStatusProxy<'a>, zbus::Error> {
    let proxy = ServiceStatusProxy::builder(&dbus)
        .destination(destination.to_string())?
        .path(path.to_string())?
        .build()
        .await?;
    Ok(proxy)
}
