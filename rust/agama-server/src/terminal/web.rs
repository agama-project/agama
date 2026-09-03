// Copyright (c) [2026] SUSE LLC
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

//! Implements a WebSocket-backed terminal.
//!
//! Every WebSocket connection to this endpoint starts a new shell attached to a
//! pseudo-terminal (pty). The shell runs as the same user as the server
//! (root). There is no session persistence: closing the WebSocket ends the
//! shell, and a new connection always starts a fresh one.
//!
//! ## Wire protocol
//!
//! The WebSocket carries two kinds of frames:
//!
//! * Binary frames carry raw bytes. From the client, they are keystrokes to
//!   send to the shell. From the server, they are the shell's output.
//! * Text frames carry small JSON control messages. From the client, the only
//!   supported message resizes the terminal: `{"cols": 80, "rows": 24}`. From
//!   the server, a single message announces that the shell exited:
//!   `{"type": "exit", "code": 0}`, right before the socket closes.

use aide::axum::ApiRouter;
use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
};
use pty_process::{OwnedReadPty, OwnedWritePty};
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;
use tokio::process::Child;
use tokio_stream::StreamExt;
use tokio_util::io::ReaderStream;

/// Number of rows the pty is created with, before the client sends its actual
/// size (see [`ResizeMessage`]).
const DEFAULT_ROWS: u16 = 24;
/// Number of columns the pty is created with, before the client sends its
/// actual size (see [`ResizeMessage`]).
const DEFAULT_COLS: u16 = 80;
/// Shell started for every terminal session.
const SHELL: &str = "bash";

/// Control message sent by the client to resize the terminal.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResizeMessage {
    cols: u16,
    rows: u16,
}

/// Control message sent to the client to report that the shell exited.
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum ServerMessage {
    Exit { code: i32 },
}

/// Returns the axum service exposing the terminal WebSocket at `/ws`.
pub fn terminal_service() -> ApiRouter {
    ApiRouter::new().route("/ws", get(ws_handler))
}

async fn ws_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

/// Starts a shell attached to a new pty.
///
/// The pty is created with a default size; the client is expected to send a
/// [`ResizeMessage`] as soon as it knows its actual size.
fn spawn_shell() -> pty_process::Result<(OwnedReadPty, OwnedWritePty, Child)> {
    let (pty, pts) = pty_process::open()?;
    pty.resize(pty_process::Size::new(DEFAULT_ROWS, DEFAULT_COLS))?;

    let mut command = pty_process::Command::new(SHELL).env("TERM", "xterm-256color");
    // Start in the shell owner's home directory (root's, in practice, since
    // the server runs as root). Fall back to the server's own working
    // directory when it is not set.
    if let Some(home) = std::env::var_os("HOME") {
        command = command.current_dir(home);
    }

    let child = command.spawn(pts)?;
    let (pty_read, pty_write) = pty.into_split();
    Ok((pty_read, pty_write, child))
}

/// Drives a single terminal session for the lifetime of the given socket.
async fn handle_socket(mut socket: WebSocket) {
    tracing::info!("terminal: starting a new session");

    let (pty_read, mut pty_write, mut child) = match spawn_shell() {
        Ok(parts) => parts,
        Err(error) => {
            tracing::warn!("terminal: failed to start the shell: {error}");
            let _ = socket.send(Message::Close(None)).await;
            return;
        }
    };

    let mut output = ReaderStream::new(pty_read);

    loop {
        tokio::select! {
            // Messages coming from the browser.
            message = socket.recv() => {
                match message {
                    Some(Ok(Message::Binary(bytes))) => {
                        if let Err(error) = pty_write.write_all(&bytes).await {
                            tracing::warn!("terminal: failed to write to the pty: {error}");
                            break;
                        }
                    }
                    Some(Ok(Message::Text(text))) => {
                        handle_control_message(&text, &pty_write);
                    }
                    Some(Ok(Message::Close(_))) | None => {
                        tracing::info!("terminal: the client closed the connection");
                        break;
                    }
                    Some(Ok(_)) => {
                        // Ping/Pong frames are handled by axum; nothing to do.
                    }
                    Some(Err(error)) => {
                        tracing::warn!("terminal: websocket error: {error}");
                        break;
                    }
                }
            }

            // Output coming from the shell.
            chunk = output.next() => {
                match chunk {
                    Some(Ok(bytes)) => {
                        if socket.send(Message::Binary(bytes)).await.is_err() {
                            // The client is gone; the loop will exit through
                            // recv() on the next iteration too, but there is
                            // no point in waiting for that.
                            break;
                        }
                    }
                    Some(Err(error)) => {
                        tracing::warn!("terminal: failed to read from the pty: {error}");
                        break;
                    }
                    None => {
                        // The pty's read side closed; the shell is about to exit
                        // (handled by the child.wait() branch below).
                    }
                }
            }

            // The shell process itself.
            status = child.wait() => {
                let code = status.map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);
                tracing::info!("terminal: the shell exited with code {code}");
                let message = ServerMessage::Exit { code };
                if let Ok(json) = serde_json::to_string(&message) {
                    let _ = socket.send(Message::Text(json.into())).await;
                }
                let _ = socket.send(Message::Close(None)).await;
                break;
            }
        }
    }

    // Do not leave an orphaned shell behind (e.g., when the client just drops
    // the connection instead of closing it cleanly).
    let _ = child.start_kill();
    let _ = child.wait().await;

    tracing::info!("terminal: session ended");
}

/// Parses and applies a control message received from the client.
///
/// Invalid or unknown messages are logged and ignored: they must not end the
/// session.
fn handle_control_message(text: &str, pty_write: &OwnedWritePty) {
    match serde_json::from_str::<ResizeMessage>(text) {
        Ok(resize) => {
            if let Err(error) =
                pty_write.resize(pty_process::Size::new(resize.rows, resize.cols))
            {
                tracing::warn!("terminal: failed to resize the pty: {error}");
            }
        }
        Err(error) => {
            tracing::warn!("terminal: ignoring an invalid control message: {error}");
        }
    }
}
