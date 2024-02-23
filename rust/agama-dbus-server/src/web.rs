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

use agama_lib::{connection, progress::ProgressMonitor};
pub use auth::generate_token;
pub use config::ServiceConfig;
pub use docs::ApiDoc;
pub use event::{Event, EventsReceiver, EventsSender};

use crate::l10n::web::l10n_service;
use axum::Router;
use service::MainServiceBuilder;

use self::progress::EventsProgressPresenter;

/// Returns a service that implements the web-based Agama API.
///
/// * `config`: service configuration.
/// * `dbus`: D-Bus connection.
pub fn service(config: ServiceConfig, events: EventsSender) -> Router {
    MainServiceBuilder::new(events.clone())
        .add_service("/l10n", l10n_service(events))
        .with_config(config)
        .build()
}

pub async fn run_monitor(events: EventsSender) {
    let presenter = EventsProgressPresenter::new(events);
    let connection = connection().await.unwrap();
    let mut monitor = ProgressMonitor::new(connection).await.unwrap();
    tokio::spawn(async move {
        _ = monitor.run(presenter).await;
    });
}
