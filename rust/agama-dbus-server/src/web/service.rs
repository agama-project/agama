use axum::{routing::get, Router};
use tower_http::trace::TraceLayer;

/// Returns a service that implements the web-based Agama API.
pub fn service(dbus_connection: zbus::Connection) -> Router {
    let state = ServiceState { dbus_connection };
    Router::new()
        .route("/ping", get(super::http::ping))
        .route("/ws", get(super::ws::ws_handler))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

#[derive(Clone)]
pub struct ServiceState {
    pub dbus_connection: zbus::Connection,
}
