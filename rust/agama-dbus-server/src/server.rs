use crate::http::ping;
use crate::ws::ws_handler;
use axum::{routing::get, Router};
use tower_http::trace::TraceLayer;
use tracing_subscriber::prelude::*;

pub struct AgamaServer {
    address: String,
    state: ServerState,
}

impl AgamaServer {
    pub fn new(address: &str, dbus_connection: zbus::Connection) -> Self {
        Self {
            address: address.to_string(),
            state: ServerState { dbus_connection },
        }
    }

    pub async fn run(&self) {
        let journald = tracing_journald::layer().expect("could not connect to journald");
        tracing_subscriber::registry().with(journald).init();

        let app = Router::new()
            .route("/ping", get(ping))
            .route("/ws", get(ws_handler))
            .layer(TraceLayer::new_for_http())
            .with_state(self.state.clone());

        let listener = tokio::net::TcpListener::bind(&self.address)
            .await
            .unwrap_or_else(|_| panic!("could not listen on {}", &self.address));

        axum::serve(listener, app)
            .await
            .expect("could not mount app on listener");
    }
}

#[derive(Clone)]
pub struct ServerState {
    pub dbus_connection: zbus::Connection,
}
