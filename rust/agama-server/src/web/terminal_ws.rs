use axum::{extract::{ws::{Message, WebSocket}, WebSocketUpgrade}, response::IntoResponse};
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
            Some(Ok(Message::Text(s))) => {
                println!("websocket text {:?}", s);
                socket.send(Message::Binary(s.into_bytes())).await; // TODO: error handling
                continue;
            },
            Some(Ok(Message::Close(_))) => {
                println!("websocket close {:?}", message);
                break;  
            },
            _ => {
                println!("websocket other {:?}", message);
                continue
            },
        }
    }

    info!("Terminal disconnected.");
}