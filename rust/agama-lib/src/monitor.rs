// Copyright (c) [2025] SUSE LLC
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

//! This module implements a monitor that keeps track of Agama service status.
//!
//! The monitor tracks:
//!
//! * Changes in the installer status (see [api::Status]).
//!
//! Each time the installer status changes, it sends the new status using the
//! [api::Status] struct.
//!
//!
//! ```no_run
//!   # use agama_lib::{monitor::Monitor, auth::AuthToken, http::{BaseHTTPClient, WebSocketClient}};
//!
//!   async fn print_status(http_url: url::Url, ws_url: url::Url, token: AuthToken) -> anyhow::Result<()> {
//!     let http_client = BaseHTTPClient::new(http_url)?
//!       .authenticated(&token)?;
//!     let ws_client = WebSocketClient::connect(&ws_url, &token, false)
//!       .await?;
//!     let monitor = Monitor::connect(http_client, ws_client).await.unwrap();
//!     let mut updates = monitor.subscribe();
//!
//!     loop {
//!       if let Ok(status) = updates.recv().await {
//!           println!("Status: {:?}", &status.stage);
//!       }
//!     }
//!  }
//! ```
//!

use agama_utils::api::{self, Event};
use tokio::sync::{broadcast, mpsc, oneshot};

use crate::http::{BaseHTTPClient, BaseHTTPClientError, WebSocketClient, WebSocketError};

#[derive(thiserror::Error, Debug)]
pub enum MonitorError {
    #[error("Error connecting to the HTTP API: {0}")]
    HTTP(#[from] BaseHTTPClientError),
    #[error("WebSocket error: {0}")]
    WebSocket(#[from] WebSocketError),
    #[error(transparent)]
    Url(#[from] url::ParseError),
    #[error("Error receiving the monitor message: {0}")]
    Recv(#[from] oneshot::error::RecvError),
}

/// It allows connecting to the Agama monitor to get the status or listen for changes.
///
/// It can be cloned and moved between threads.
#[derive(Clone)]
pub struct MonitorClient {
    commands: mpsc::Sender<MonitorCommand>,
    pub updates: broadcast::Sender<api::Status>,
}

impl MonitorClient {
    /// Returns the installer status.
    pub async fn get_status(&self) -> Result<api::Status, MonitorError> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        _ = self.commands.send(MonitorCommand::GetStatus(tx)).await;
        Ok(rx.await?)
    }

    /// Subscribe to status updates from the monitor.
    ///
    /// It uses a regular broadcast channel from the Tokio library.
    pub fn subscribe(&self) -> broadcast::Receiver<api::Status> {
        self.updates.subscribe()
    }
}

/// Monitors an Agama service and keeps track of the status, listens for
/// events, etc.
pub struct Monitor {
    // Channel to receive commands.
    commands: mpsc::Receiver<MonitorCommand>,
    // Channel to send updates.
    updates: broadcast::Sender<api::Status>,
    status: api::Status,
    ws_client: WebSocketClient,
    status_reader: MonitorStatusReader,
}

#[derive(Debug)]
enum MonitorCommand {
    GetStatus(tokio::sync::oneshot::Sender<api::Status>),
}

impl Monitor {
    /// Connects and monitors to an Agama service.
    ///
    /// * `http_client`: HTTP client to talk to the service.
    /// * `websocket_client`: websocket to listen for events.
    ///
    /// The monitor runs on a separate Tokio task.
    pub async fn connect(
        http_client: BaseHTTPClient,
        websocket_client: WebSocketClient,
    ) -> Result<MonitorClient, MonitorError> {
        // Channel to send/receive updates from the monitor.
        let (updates, _rx) = broadcast::channel(16);
        // Channel to send/receive commands from the client.
        let (commands_tx, commands_rx) = mpsc::channel(16);
        let client = MonitorClient {
            commands: commands_tx,
            updates: updates.clone(),
        };

        let status_reader = MonitorStatusReader::with_client(http_client);
        let status = status_reader.read().await?;

        let mut monitor = Monitor {
            status,
            updates,
            commands: commands_rx,
            ws_client: websocket_client,
            status_reader,
        };

        tokio::spawn(async move { monitor.run().await });
        Ok(client)
    }

    /// Runs the monitor.
    async fn run(&mut self) {
        loop {
            tokio::select! {
                Some(cmd) = self.commands.recv() => {
                    self.handle_command(cmd);
                }
                Ok(event) = self.ws_client.receive() => {
                    self.handle_event(event).await;
                }
            }
        }
    }

    /// Handle commands from the client.
    ///
    /// * `command`: command to execute.
    fn handle_command(&mut self, command: MonitorCommand) {
        match command {
            MonitorCommand::GetStatus(channel) => {
                let _ = channel.send(self.status.clone());
            }
        }
    }

    /// Handle events from Agama.
    ///
    /// Given an event, updates the internal state. Once updated, it emits
    /// sends the updated state to its subscribers.
    ///
    /// * `event`: Agama event.
    async fn handle_event(&mut self, event: Event) {
        match event {
            // status related events is used here.
            Event::ProgressFinished { scope: _ } => {}
            Event::StageChanged => {}
            Event::ProgressChanged { progress: _ } => {}
            _ => {
                return;
            }
        }
        self.reread_status().await;
        let _ = self.updates.send(self.status.clone());
    }

    async fn reread_status(&mut self) {
        let status_result = self.status_reader.read().await;

        let Ok(new_status) = status_result else {
            tracing::warn!("Failed to read status {:?}", status_result);
            return;
        };
        self.status = new_status;
    }
}

/// Ancillary struct to read the status from the API.
struct MonitorStatusReader {
    http: BaseHTTPClient,
}

impl MonitorStatusReader {
    pub fn with_client(http: BaseHTTPClient) -> Self {
        Self { http }
    }

    pub async fn read(&self) -> Result<api::Status, MonitorError> {
        let status: api::Status = self.http.get("/v2/status").await?;
        Ok(status)
    }
}
