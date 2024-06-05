use axum::{extract::{ws::WebSocket, WebSocketUpgrade}, response::IntoResponse};
use log::info;

pub(crate) async fn handler(
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket))
}

async fn handle_socket(mut socket: WebSocket) {
    info!("Terminal connected");

    loop {
        let message = socket.recv().await;
        match message {
            Some(Ok(message)) => {
                println!("websocket {:?}", message);
                continue;
            }
            _ => continue,
        }
    }

    info!("Terminal disconnected.");
}