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

use super::state::ServiceState;
use agama_lib::auth::ClientId;
use agama_utils::api::event;
use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
    Extension,
};
use std::sync::Arc;
use tokio::sync::broadcast;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Error serializing WebSocket message")]
    Serialize(#[from] serde_json::Error),
    #[error("Could not receive the event")]
    RecvEvent(#[from] broadcast::error::RecvError),
    #[error("Websocket closed")]
    WebSocketClosed(#[from] axum::Error),
}

pub async fn ws_handler(
    State(state): State<ServiceState>,
    Extension(client_id): Extension<Arc<ClientId>>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state.events, client_id))
}

async fn handle_socket(mut socket: WebSocket, events: event::Sender, client_id: Arc<ClientId>) {
    let mut events_rx = events.subscribe();

    loop {
        tokio::select! {
            // Handle messages from the client
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Close(_))) | Some(Err(_)) | None => break,
                    Some(Ok(_)) => {}
                }
            }

            // Emit events from the server
            msg = events_rx.recv() => {
                match msg {
                    Ok(event) => {
                        let Ok(json) = serde_json::to_string(&event) else {
                            tracing::warn!("ws: could not serialize event: {event:?}");
                            continue;
                        };

                        if socket.send(Message::Text(json)).await.is_err() {
                            // Failed to send the message, client probably disconnected.
                            break;
                        }
                    }
                    Err(error) => {
                        tracing::warn!("ws: could not receive the event: {error}");
                        break;
                    }
                }
            }
        }
    }
}
