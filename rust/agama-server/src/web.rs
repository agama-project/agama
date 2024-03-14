//! This module implements a web-based API for Agama. It is responsible for:
//!
//! * Exposing an HTTP API to interact with Agama.
//! * Emit relevant events via websocket.
//! * Serve the code for the web user interface (not implemented yet).

use crate::{
    error::Error,
    l10n::web::l10n_service,
    manager::web::{manager_service, manager_stream},
    software::web::{software_service, software_stream},
    web::common::{progress_stream, service_status_stream},
};
use axum::Router;

mod auth;
pub mod common;
mod config;
mod docs;
mod event;
mod http;
mod service;
mod state;
mod ws;

use agama_lib::{connection, error::ServiceError};
pub use auth::generate_token;
pub use config::ServiceConfig;
pub use docs::ApiDoc;
pub use event::{Event, EventsReceiver, EventsSender};
pub use service::MainServiceBuilder;
use std::path::Path;
use tokio_stream::{StreamExt, StreamMap};

/// Returns a service that implements the web-based Agama API.
///
/// * `config`: service configuration.
/// * `events`: channel to send the events through the WebSocket.
/// * `dbus`: D-Bus connection.
/// * `web_ui_dir`: public directory containing the web UI.
pub async fn service<P>(
    config: ServiceConfig,
    events: EventsSender,
    dbus: zbus::Connection,
    web_ui_dir: P,
) -> Result<Router, ServiceError>
where
    P: AsRef<Path>,
{
    let router = MainServiceBuilder::new(events.clone(), web_ui_dir)
        .add_service("/l10n", l10n_service(events.clone()))
        .add_service("/manager", manager_service(dbus.clone()).await?)
        .add_service("/software", software_service(dbus).await?)
        .with_config(config)
        .build();
    Ok(router)
}

/// Starts monitoring the D-Bus service progress.
///
/// The events are sent to the `events` channel.
///
/// * `events`: channel to send the events to.
pub async fn run_monitor(events: EventsSender) -> Result<(), ServiceError> {
    let connection = connection().await?;
    tokio::spawn(run_events_monitor(connection, events.clone()));

    Ok(())
}

/// Emits the events from the system streams through the events channel.
///
/// * `connection`: D-Bus connection.
/// * `events`: channel to send the events to.
async fn run_events_monitor(dbus: zbus::Connection, events: EventsSender) -> Result<(), Error> {
    let mut stream = StreamMap::new();

    stream.insert("manager", manager_stream(dbus.clone()).await?);
    stream.insert(
        "manager-status",
        service_status_stream(
            dbus.clone(),
            "org.opensuse.Agama.Manager1",
            "/org/opensuse/Agama/Manager1",
        )
        .await?,
    );
    stream.insert(
        "manager-progress",
        progress_stream(
            dbus.clone(),
            "org.opensuse.Agama.Manager1",
            "/org/opensuse/Agama/Manager1",
        )
        .await,
    );

    stream.insert("software", software_stream(dbus.clone()).await?);
    stream.insert(
        "software-status",
        service_status_stream(
            dbus.clone(),
            "org.opensuse.Agama.Software1",
            "/org/opensuse/Agama/Software1",
        )
        .await?,
    );
    stream.insert(
        "software-progress",
        progress_stream(
            dbus.clone(),
            "org.opensuse.Agama.Software1",
            "/org/opensuse/Agama/Software1",
        )
        .await,
    );

    tokio::pin!(stream);
    let e = events.clone();
    while let Some((_, event)) = stream.next().await {
        _ = e.send(event);
    }
    Ok(())
}
