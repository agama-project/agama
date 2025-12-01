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
//! * Changes in the installer status (see InstallerStatus).
//! * Progress changes in any service.
//!
//! Each time the installer status changes, it sends the new status using the
//! MonitorStatus struct.
//!
//! Note: in the future we might send only the changes, but at this point
//! the monitor sends the full status.
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
//!           println!("Status: {:?}", &status.installer_status);
//!       }
//!     }
//!  }
//! ```
//!

use std::collections::HashMap;
use tokio::sync::{broadcast, mpsc, oneshot};

use crate::{
    http::{
        BaseHTTPClient, BaseHTTPClientError, EventPayload, OldEvent, WebSocketClient,
        WebSocketError,
    },
    manager::{InstallationPhase, InstallerStatus},
    progress::Progress,
};

const MANAGER_PROGRESS_OBJECT_PATH: &str = "/org/opensuse/Agama/Manager1";
const SOFTWARE_PROGRESS_OBJECT_PATH: &str = "/org/opensuse/Agama/Software1";

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

/// Represents the current status of the installer.
#[derive(Clone, Debug, Default)]
pub struct MonitorStatus {
    /// The general installer status.
    ///
    /// FIXME: do not hold the full status (some elements are not updated)
    pub installer_status: InstallerStatus,
    /// Progress for each service using the D-Bus object path as the key. If the progress is
    /// finished, the entry is removed from the map.
    pub progress: HashMap<String, Progress>,
}

impl MonitorStatus {
    /// Updates the progress for the given service.
    ///
    /// The entry is removed if the progress is finished.
    ///
    /// * `service`: D-Bus object path.
    /// * `progress`: updated progress.
    fn update_progress(&mut self, path: String, progress: Progress) {
        if progress.finished {
            _ = self.progress.remove_entry(&path);
        } else {
            _ = self.progress.insert(path, progress);
        }
    }

    /// Sets whether the installer is busy or not.
    ///
    /// * `is_busy`: whether the installer is busy.
    fn set_is_busy(&mut self, is_busy: bool) {
        self.installer_status.is_busy = is_busy;
    }

    /// Sets the service phase.
    ///
    /// * `phase`: installation phase.
    fn set_phase(&mut self, phase: InstallationPhase) {
        self.installer_status.phase = phase;
    }
}

/// It allows connecting to the Agama monitor to get the status or listen for changes.
///
/// It can be cloned and moved between threads.
#[derive(Clone)]
pub struct MonitorClient {
    commands: mpsc::Sender<MonitorCommand>,
    pub updates: broadcast::Sender<MonitorStatus>,
}

impl MonitorClient {
    /// Returns the installer status.
    pub async fn get_status(&self) -> Result<MonitorStatus, MonitorError> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        _ = self.commands.send(MonitorCommand::GetStatus(tx)).await;
        Ok(rx.await?)
    }

    /// Subscribe to status updates from the monitor.
    ///
    /// It uses a regular broadcast channel from the Tokio library.
    pub fn subscribe(&self) -> broadcast::Receiver<MonitorStatus> {
        self.updates.subscribe()
    }
}

/// Monitors an Agama service and keeps track of the status, listens for
/// events, etc.
pub struct Monitor {
    // Channel to receive commands.
    commands: mpsc::Receiver<MonitorCommand>,
    // Channel to send updates.
    updates: broadcast::Sender<MonitorStatus>,
    status: MonitorStatus,
    ws_client: WebSocketClient,
}

#[derive(Debug)]
enum MonitorCommand {
    GetStatus(tokio::sync::oneshot::Sender<MonitorStatus>),
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

        let status = MonitorStatusReader::with_client(http_client).read().await?;

        let mut monitor = Monitor {
            status,
            updates,
            commands: commands_rx,
            ws_client: websocket_client,
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
                Ok(event) = self.ws_client.receive_old_events() => {
                    self.handle_event(event);
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
    fn handle_event(&mut self, event: OldEvent) {
        match event.payload {
            EventPayload::ProgressChanged { path, progress } => {
                self.status.update_progress(path, progress);
            }
            EventPayload::ServiceStatusChanged { service, status } => {
                if service.as_str() == MANAGER_PROGRESS_OBJECT_PATH {
                    self.status.set_is_busy(status == 1);
                }
            }
            EventPayload::InstallationPhaseChanged { phase } => {
                self.status.set_phase(phase);
            }
            _ => {}
        }
        let _ = self.updates.send(self.status.clone());
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

    pub async fn read(self) -> Result<MonitorStatus, MonitorError> {
        let installer_status: InstallerStatus = self.http.get("/manager/installer").await?;
        let mut status = MonitorStatus {
            installer_status,
            ..Default::default()
        };

        self.add_service_progress(
            &mut status,
            MANAGER_PROGRESS_OBJECT_PATH,
            "/manager/progress",
        )
        .await?;
        self.add_service_progress(
            &mut status,
            SOFTWARE_PROGRESS_OBJECT_PATH,
            "/software/progress",
        )
        .await?;
        Ok(status)
    }

    async fn add_service_progress(
        &self,
        status: &mut MonitorStatus,
        dbus_path: &str,
        path: &str,
    ) -> Result<(), MonitorError> {
        let progress: Progress = self.http.get(path).await?;
        if progress.finished {
            return Ok(());
        }
        status.progress.insert(dbus_path.to_string(), progress);
        Ok(())
    }
}
