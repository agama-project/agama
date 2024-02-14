use axum::{routing::get, Router};
use tokio;

mod http;

use http::ping;

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/ping", get(ping));


    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000")
        .await
        .expect("could not listen on port 3000");
    axum::serve(listener, app).await.expect("could not mount app on listener");
}
