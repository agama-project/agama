// Copyright (c) [2024] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

//! Implements the websocket handling.

use std::sync::Arc;

use super::{state::ServiceState, EventsSender};
use agama_lib::auth::ClientId;
use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
    Extension,
};

pub async fn ws_handler(
    State(state): State<ServiceState>,
    Extension(client_id): Extension<Arc<ClientId>>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state.events, client_id))
}

async fn handle_socket(mut socket: WebSocket, events: EventsSender, client_id: Arc<ClientId>) {
    let mut rx = events.subscribe();

    let conn_event = agama_lib::event!(ClientConnected, client_id.as_ref());
    if let Ok(json) = serde_json::to_string(&conn_event) {
        _ = socket.send(Message::Text(json)).await;
    }

    while let Ok(msg) = rx.recv().await {
        match serde_json::to_string(&msg) {
            Ok(json) => {
                if let Err(e) = socket.send(Message::Text(json)).await {
                    tracing::info!("ws: client disconnected: {e}");
                    return;
                }
            }
            Err(e) => {
                tracing::error!("ws: error serializing message: {e}")
            }
        }
    }
}
