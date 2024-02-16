use axum::{
    routing::{get, post},
    Router,
};
use config::{Config, ConfigError, File};
use rand::distributions::{Alphanumeric, DistString};
use serde::Deserialize;
use tower_http::trace::TraceLayer;

/// Returns a service that implements the web-based Agama API.
pub fn service(dbus_connection: zbus::Connection) -> Router {
    let config = ServiceConfig::load().unwrap();
    let state = ServiceState {
        config,
        dbus_connection,
    };
    Router::new()
        .route("/ping", get(super::http::ping))
        .route("/ws", get(super::ws::ws_handler))
        .route("/authenticate", post(super::http::authenticate))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// Web service state.
///
/// It holds the service configuration and the current D-Bus connection.
#[derive(Clone)]
pub struct ServiceState {
    pub config: ServiceConfig,
    pub dbus_connection: zbus::Connection,
}

/// Web service configuration.
#[derive(Clone, Debug, Deserialize)]
pub struct ServiceConfig {
    /// Key to sign the JSON Web Tokens.
    pub jwt_key: String,
}

impl ServiceConfig {
    pub fn load() -> Result<Self, ConfigError> {
        const JWT_SIZE: usize = 30;
        let jwt_key: String = Alphanumeric.sample_string(&mut rand::thread_rng(), JWT_SIZE);

        let config = Config::builder()
            .set_default("jwt_key", jwt_key)?
            .add_source(File::with_name("/usr/etc/agama.d/server").required(false))
            .add_source(File::with_name("/etc/agama.d/server").required(false))
            .add_source(File::with_name("agama-dbus-server/share/server.yaml").required(false))
            .build()?;
        config.try_deserialize()
    }
}
