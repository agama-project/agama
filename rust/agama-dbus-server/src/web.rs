//! This module implements a web-based API for Agama. It is responsible for:
//!
//! * Exposing an HTTP API to interact with Agama.
//! * Emit relevant events via websocket.
//! * Serve the code for the web user interface (not implemented yet).

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

use crate::l10n::web::l10n_service;
use axum::Router;
pub use service::MainServiceBuilder;

use self::progress::EventsProgressPresenter;

/// Returns a service that implements the web-based Agama API.
///
/// * `config`: service configuration.
/// * `events`: D-Bus connection.
pub fn service(config: ServiceConfig, events: EventsSender) -> Router {
    MainServiceBuilder::new(events.clone())
        .add_service("/l10n", l10n_service(events))
        .with_config(config)
        .build()
}

/// Starts monitoring the D-Bus service progress.
///
/// The events are sent to the `events` channel.
///
/// * `events`: channel to send the events to.
pub async fn run_monitor(events: EventsSender) -> Result<(), ServiceError> {
    let presenter = EventsProgressPresenter::new(events);
    let connection = connection().await?;
    let mut monitor = ProgressMonitor::new(connection).await?;
    tokio::spawn(async move {
        if let Err(error) = monitor.run(presenter).await {
            eprintln!("Could not monitor the D-Bus server: {}", error);
        }
    });
    Ok(())
}
