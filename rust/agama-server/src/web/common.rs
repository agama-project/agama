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

//! This module defines functions to be used accross all services.

use std::{pin::Pin, task::Poll};

use agama_lib::{
    error::ServiceError,
    progress::Progress,
    proxies::{IssuesProxy, ProgressProxy, ServiceStatusProxy},
};
use axum::{extract::State, routing::get, Json, Router};
use pin_project::pin_project;
use serde::Serialize;
use tokio_stream::{Stream, StreamExt};
use zbus::proxy::PropertyStream;

use crate::error::Error;

mod jobs;
pub use jobs::{jobs_service, jobs_stream};

use super::Event;

pub type EventStreams = Vec<(&'static str, Pin<Box<dyn Stream<Item = Event> + Send>>)>;

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
) -> Result<Pin<Box<dyn Stream<Item = Event> + Send>>, Error> {
    let proxy = build_service_status_proxy(&dbus, destination, path).await?;
    let stream = proxy
        .receive_current_changed()
        .await
        .then(move |change| async move {
            if let Ok(status) = change.get().await {
                Some(Event::ServiceStatusChanged {
                    service: destination.to_string(),
                    status,
                })
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

/// Builds a router to the `org.opensuse.Agama1.Progress`
/// interface of the given D-Bus object.
///
/// ```no_run
/// # use axum::{extract::State, routing::get, Json, Router};
/// # use agama_lib::connection;
/// # use agama_server::web::common::progress_router;
/// # use tokio_test;
///
/// # tokio_test::block_on(async {
/// async fn hello(state: State<HelloWorldState>) {};
///
/// #[derive(Clone)]
/// struct HelloWorldState {};
///
/// let dbus = connection().await.unwrap();
/// let progress_router = progress_router(
///   &dbus, "org.opensuse.HelloWorld", "/org/opensuse/hello"
/// ).await.unwrap();
/// let router: Router<HelloWorldState> = Router::new()
///   .route("/hello", get(hello))
///   .merge(progress_router)
///   .with_state(HelloWorldState {});
/// });
/// ```
///
/// * `dbus`: D-Bus connection.
/// * `destination`: D-Bus service name.
/// * `path`: D-Bus object path.
pub async fn progress_router<T>(
    dbus: &zbus::Connection,
    destination: &str,
    path: &str,
) -> Result<Router<T>, ServiceError> {
    let proxy = build_progress_proxy(dbus, destination, path).await?;
    let state = ProgressState { proxy };
    Ok(Router::new()
        .route("/progress", get(progress))
        .with_state(state))
}

#[derive(Clone)]
struct ProgressState<'a> {
    proxy: ProgressProxy<'a>,
}

/// Information about the current progress sequence.
#[derive(Clone, Default, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProgressSequence {
    /// Sequence steps if known in advance
    steps: Vec<String>,
    #[serde(flatten)]
    progress: Progress,
}

async fn progress(State(state): State<ProgressState<'_>>) -> Result<Json<ProgressSequence>, Error> {
    let proxy = state.proxy;
    let progress = Progress::from_proxy(&proxy).await?;
    let steps = proxy.steps().await?;
    let sequence = ProgressSequence { steps, progress };
    Ok(Json(sequence))
}

#[pin_project]
pub struct ProgressStream<'a> {
    #[pin]
    inner: PropertyStream<'a, (u32, String)>,
    proxy: ProgressProxy<'a>,
}

pub async fn progress_stream<'a>(
    dbus: zbus::Connection,
    destination: &'static str,
    path: &'static str,
) -> Result<Pin<Box<impl Stream<Item = Event> + Send>>, zbus::Error> {
    let proxy = build_progress_proxy(&dbus, destination, path).await?;
    Ok(Box::pin(ProgressStream::new(proxy).await))
}

impl<'a> ProgressStream<'a> {
    pub async fn new(proxy: ProgressProxy<'a>) -> Self {
        let stream = proxy.receive_current_step_changed().await;
        ProgressStream {
            inner: stream,
            proxy,
        }
    }
}

impl<'a> Stream for ProgressStream<'a> {
    type Item = Event;

    fn poll_next(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Option<Self::Item>> {
        let pinned = self.project();
        match pinned.inner.poll_next(cx) {
            Poll::Pending => Poll::Pending,
            Poll::Ready(_change) => match Progress::from_cached_proxy(pinned.proxy) {
                Some(progress) => {
                    let event = Event::Progress {
                        progress,
                        service: pinned.proxy.inner().destination().to_string(),
                    };
                    Poll::Ready(Some(event))
                }
                _ => Poll::Pending,
            },
        }
    }
}

async fn build_progress_proxy<'a>(
    dbus: &zbus::Connection,
    destination: &str,
    path: &str,
) -> Result<ProgressProxy<'a>, zbus::Error> {
    let proxy = ProgressProxy::builder(dbus)
        .destination(destination.to_string())?
        .path(path.to_string())?
        .build()
        .await?;
    Ok(proxy)
}

/// Builds a router to the `org.opensuse.Agama1.Issues` interface of a given
/// D-Bus object.
///
/// ```no_run
/// # use axum::{extract::State, routing::get, Json, Router};
/// # use agama_lib::connection;
/// # use agama_server::web::common::{issues_router, service_status_router};
/// # use tokio_test;
///
/// # tokio_test::block_on(async {
/// async fn hello(state: State<HelloWorldState>) {};
///
/// #[derive(Clone)]
/// struct HelloWorldState {};
///
/// let dbus = connection().await.unwrap();
/// let issues_router = issues_router(
///   &dbus, "org.opensuse.HelloWorld", "/org/opensuse/hello"
/// ).await.unwrap();
/// let router: Router<HelloWorldState> = Router::new()
///   .route("/hello", get(hello))
///   .merge(issues_router)
///   .with_state(HelloWorldState {});
/// });
/// ```
///
/// * `dbus`: D-Bus connection.
/// * `destination`: D-Bus service name.
/// * `path`: D-Bus object path.
pub async fn issues_router<T>(
    dbus: &zbus::Connection,
    destination: &str,
    path: &str,
) -> Result<Router<T>, ServiceError> {
    let proxy = build_issues_proxy(dbus, destination, path).await?;
    let state = IssuesState { proxy };
    Ok(Router::new().route("/", get(issues)).with_state(state))
}

async fn issues(State(state): State<IssuesState<'_>>) -> Result<Json<Vec<Issue>>, Error> {
    let issues = state.proxy.all().await?;
    let issues: Vec<Issue> = issues.into_iter().map(Issue::from_tuple).collect();
    Ok(Json(issues))
}

#[derive(Clone)]
struct IssuesState<'a> {
    proxy: IssuesProxy<'a>,
}

#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
pub struct Issue {
    description: String,
    details: Option<String>,
    source: u32,
    severity: u32,
}

impl Issue {
    pub fn from_tuple(
        (description, details, source, severity): (String, String, u32, u32),
    ) -> Self {
        let details = if details.is_empty() {
            None
        } else {
            Some(details)
        };

        Self {
            description,
            details,
            source,
            severity,
        }
    }
}

/// Builds a stream of the changes in the the `org.opensuse.Agama1.Issues`
/// interface of the given D-Bus object.
///
/// * `dbus`: D-Bus connection.
/// * `destination`: D-Bus service name.
/// * `path`: D-Bus object path.
pub async fn issues_stream(
    dbus: zbus::Connection,
    destination: &'static str,
    path: &'static str,
) -> Result<Pin<Box<dyn Stream<Item = Event> + Send>>, Error> {
    let proxy = build_issues_proxy(&dbus, destination, path).await?;
    let stream = proxy
        .receive_all_changed()
        .await
        .then(move |change| async move {
            if let Ok(issues) = change.get().await {
                let issues = issues.into_iter().map(Issue::from_tuple).collect();
                Some(Event::IssuesChanged {
                    service: destination.to_string(),
                    path: path.to_string(),
                    issues,
                })
            } else {
                None
            }
        })
        .filter_map(|e| e);
    Ok(Box::pin(stream))
}

async fn build_issues_proxy<'a>(
    dbus: &zbus::Connection,
    destination: &str,
    path: &str,
) -> Result<IssuesProxy<'a>, zbus::Error> {
    let proxy = IssuesProxy::builder(dbus)
        .destination(destination.to_string())?
        .path(path.to_string())?
        .build()
        .await?;
    Ok(proxy)
}
