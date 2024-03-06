//! Implements the websocket handling.

use super::{state::ServiceState, EventsSender};
use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
};

pub async fn ws_handler(
    State(state): State<ServiceState>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state.events))
}

async fn handle_socket(mut socket: WebSocket, events: EventsSender) {
    let mut rx = events.subscribe();
    while let Ok(msg) = rx.recv().await {
        if let Ok(json) = serde_json::to_string(&msg) {
            _ = socket.send(Message::Text(json)).await;
        }
    }
}
