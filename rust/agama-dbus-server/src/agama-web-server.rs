use agama_lib::connection;
use axum::{routing::get, Router};
use tokio;
use tower_http::trace::TraceLayer;
use tracing_subscriber::prelude::*;
use zbus;

mod http;
mod ws;
use http::ping;
use ws::ws_handler;

#[derive(Clone)]
struct AppState {
    pub connection: zbus::Connection
}

#[tokio::main]
async fn main() {
    let journald = tracing_journald::layer().expect("could not connect to journald");
    tracing_subscriber::registry()
        .with(journald)
        .init();

    let app_state = AppState {
        connection: connection().await.expect("could not connect to the D-Bus server")
    };

    let app = Router::new()
        .route("/ping", get(ping))
        .route("/ws", get(ws_handler))
        .layer(TraceLayer::new_for_http())
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000")
        .await
        .expect("could not listen on port 3000");
    axum::serve(listener, app).await.expect("could not mount app on listener");
}
