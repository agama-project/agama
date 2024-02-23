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

pub use auth::generate_token;
pub use config::ServiceConfig;
pub use docs::ApiDoc;
pub use event::{Event, EventsReceiver, EventsSender};

use crate::l10n::web::l10n_service;
use axum::Router;
use service::MainServiceBuilder;
use tokio::sync::broadcast::channel;

/// Returns a service that implements the web-based Agama API.
///
/// * `config`: service configuration.
/// * `dbus`: D-Bus connection.
pub fn service(config: ServiceConfig, _dbus: zbus::Connection) -> Router {
    let (tx, _) = channel(16);
    MainServiceBuilder::new(tx.clone())
        .add_service("/l10n", l10n_service(tx.clone()))
        .with_config(config)
        .build()
}
