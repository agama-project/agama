//! This module implements a web-based API for Agama. It is responsible for:
//!
//! * Exposing an HTTP API to interact with Agama.
//! * Emit relevant events via websocket.
//! * Serve the code for the web user interface (not implemented yet).

use self::progress::EventsProgressPresenter;
use crate::l10n::web::l10n_service;
use crate::software::web::{software_monitor, software_service};
use axum::Router;

mod auth;
mod config;
mod docs;
mod event;
mod http;
mod progress;
mod service;
mod state;
mod ws;

use agama_lib::{connection, error::ServiceError, progress::ProgressMonitor};
pub use auth::generate_token;
pub use config::ServiceConfig;
pub use docs::ApiDoc;
pub use event::{Event, EventsReceiver, EventsSender};
pub use service::MainServiceBuilder;

/// Returns a service that implements the web-based Agama API.
///
/// * `config`: service configuration.
/// * `events`: D-Bus connection.
pub async fn service(config: ServiceConfig, events: EventsSender) -> Router {
    MainServiceBuilder::new(events.clone())
        .add_service("/l10n", l10n_service(events.clone()))
        .add_service("/software", software_service(events).await)
        .with_config(config)
        .build()
}

/// Starts monitoring the D-Bus service progress.
///
/// The events are sent to the `events` channel.
///
/// * `events`: channel to send the events to.
pub async fn run_monitor(events: EventsSender) -> Result<(), ServiceError> {
    let presenter = EventsProgressPresenter::new(events.clone());
    let connection = connection().await?;
    let mut monitor = ProgressMonitor::new(connection.clone()).await?;
    tokio::spawn(async move {
        if let Err(error) = monitor.run(presenter).await {
            eprintln!("Could not monitor the D-Bus server: {}", error);
        }
    });
    software_monitor(connection, events.clone()).await;
    Ok(())
}
