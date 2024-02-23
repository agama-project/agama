use super::{auth::TokenClaims, config::ServiceConfig, state::ServiceState};
use crate::l10n::web::l10n_service;
use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use tokio::sync::broadcast::channel;
use tower_http::trace::TraceLayer;

/// Returns a service that implements the web-based Agama API.
pub fn service(config: ServiceConfig, dbus_connection: zbus::Connection) -> Router {
    let (tx, _) = channel(16);
    let state = ServiceState {
        config,
        dbus_connection,
        events: tx.clone(),
    };

    Router::new()
        .route("/protected", get(super::http::protected))
        .route("/ws", get(super::ws::ws_handler))
        .nest_service("/l10n", l10n_service(tx))
        .route_layer(middleware::from_extractor_with_state::<TokenClaims, _>(
            state.clone(),
        ))
        .route("/ping", get(super::http::ping))
        .route("/authenticate", post(super::http::authenticate))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
