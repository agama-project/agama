use super::{auth::TokenClaims, config::ServiceConfig, state::ServiceState};
use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use tower_http::trace::TraceLayer;

/// Returns a service that implements the web-based Agama API.
pub fn service(config: ServiceConfig, dbus_connection: zbus::Connection) -> Router {
    let state = ServiceState {
        config,
        dbus_connection,
    };
    Router::new()
        .route("/protected", get(super::http::protected))
        .route("/ws", get(super::ws::ws_handler))
        .route_layer(middleware::from_extractor_with_state::<TokenClaims, _>(
            state.clone(),
        ))
        .route("/ping", get(super::http::ping))
        .route("/authenticate", post(super::http::authenticate))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
