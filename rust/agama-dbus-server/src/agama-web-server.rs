use axum::{routing::get, Router};
use tokio;
use tower_http::trace::TraceLayer;
use tracing_subscriber::prelude::*;

mod http;
use http::ping;

#[tokio::main]
async fn main() {
    let journald = tracing_journald::layer().expect("could not connect to journald");
    tracing_subscriber::registry()
        .with(journald)
        .init();

    let app = Router::new()
        .route("/ping", get(ping))
        .layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000")
        .await
        .expect("could not listen on port 3000");
    axum::serve(listener, app).await.expect("could not mount app on listener");
}
