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
use agama_lib::{auth::ClientId, http};
use agama_utils::api::event;
use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
    Extension,
};
use serde::Serialize;
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
    ws.on_upgrade(move |socket| handle_socket(socket, state.events, state.old_events, client_id))
}

async fn handle_socket(
    mut socket: WebSocket,
    events: event::Sender,
    old_events: http::event::OldSender,
    client_id: Arc<ClientId>,
) {
    let mut events_rx = events.subscribe();
    let mut old_events_rx = old_events.subscribe();

    let conn_event = agama_lib::event!(ClientConnected, client_id.as_ref());
    if let Ok(json) = serde_json::to_string(&conn_event) {
        _ = socket.send(Message::Text(json)).await;
    }

    loop {
        tokio::select! {
            msg = old_events_rx.recv() => {
                if let Err(e) = send_msg(&mut socket, msg).await {
                    eprintln!("Error sending old event: {e:?}");
                }
            }

            msg = events_rx.recv() => {
                if let Err(e) = send_msg(&mut socket, msg).await {
                    eprintln!("Error sending event: {e:?}");
                }
            }
        }
    }
}

async fn send_msg<T: Serialize>(
    socket: &mut WebSocket,
    msg: Result<T, broadcast::error::RecvError>,
) -> Result<(), Error> {
    let content = msg?;
    let json = serde_json::to_string(&content)?;
    Ok(socket.send(Message::Text(json)).await?)
}
