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

//! This module implements a monitor that listens to Agama events and keeps an updated
//! representation of the installation status, issues, and questions.
//!
//! It provides a broadcast channel receiver to subscribe to status updates.
//!
//! # Example
//!
//! ```no_run
//! use agama_lib::http::{BaseHTTPClient, WebSocketClient};
//! use agama_lib::monitor::Monitor;
//! use agama_lib::auth::AuthToken;
//! use url::Url;
//!
//! # async fn run() -> anyhow::Result<()> {
//! let http_client = BaseHTTPClient::new("http://localhost/api/")?;
//! let url = Url::parse("http://localhost/ws")?;
//! let token = AuthToken::new("token");
//! let ws_client = WebSocketClient::connect(&url, &token, false).await?;
//!
//! // Connect the monitor (this spawns a background task)
//! let stop_on_idle = false;
//! let (mut updates, status) = Monitor::connect(ws_client, &http_client, stop_on_idle).await?;
//! println!("Current stage: {:?}", status.status.stage);
//!
//! // Receive status updates (channel closes when monitoring stops)
//! while let Ok(status) = updates.recv().await {
//!     println!("Status updated! Issues count: {}", status.issues.len());
//! }
//! println!("Monitoring finished");
//! # Ok(())
//! # }
//! ```

use std::fmt;

use agama_utils::api::{self, Config, Event};
use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, Mutex};

use crate::{
    http::{BaseHTTPClient, WebSocketClient},
    manager::{http_client::ManagerHTTPClientError, ManagerHTTPClient},
    questions::{self, http_client::QuestionsHTTPClientError},
};

/// Minimal struct to deserialize hardware info from /system
#[derive(Debug, Deserialize)]
struct HardwareInfo {
    model: Option<String>,
}

/// Minimal struct to deserialize hostname info from /system
#[derive(Debug, Deserialize)]
struct HostnameInfo {
    hostname: String,
}

/// Minimal struct to deserialize /system response
#[derive(Debug, Deserialize)]
struct MinimalSystemInfo {
    /// Hardware information
    hardware: HardwareInfo,
    /// Hostname information
    hostname: HostnameInfo,
}

/// Errors that can occur when interacting with the monitor.
#[derive(thiserror::Error, Debug)]
pub enum MonitorError {
    /// Error connecting to the Manager HTTP API.
    #[error("Error connecting to the Manager HTTP API: {0}")]
    Manager(#[from] ManagerHTTPClientError),
    /// Error connecting to the Questions HTTP API.
    #[error("Error connecting to the Questions HTTP API: {0}")]
    Questions(#[from] QuestionsHTTPClientError),
}

/// Represents an error occurring in the backend while monitoring the status.
#[derive(Debug, Clone, thiserror::Error)]
pub struct MonitorBackendError(String);

impl fmt::Display for MonitorBackendError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Failed to obtain status in StatusMonitor: {}", self.0)
    }
}

/// System information for the monitor
#[derive(Clone, Default, Debug, PartialEq, Serialize)]
pub struct SystemInfo {
    /// System hostname
    pub hostname: String,
    /// Server IP address or hostname
    pub ip: String,
    /// Machine type/model
    pub machine: String,
    /// Product identifier
    pub product_id: Option<String>,
}

/// Extended status information with combination of status, issues and questions
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct InstallationStatus {
    /// Current installation status.
    pub status: api::Status,
    /// List of issues currently blocking or affecting the installation.
    pub issues: Vec<api::IssueWithScope>,
    /// List of unanswered questions.
    pub questions: Vec<api::question::Question>,
    /// System information (hostname, IP, machine, product)
    pub system_info: SystemInfo,
}

impl InstallationStatus {
    pub fn has_product(&self) -> bool {
        self.system_info.product_id.is_some()
    }

    pub fn is_idle(&self) -> bool {
        self.status.progresses.is_empty()
    }

    pub fn has_finished(&self) -> bool {
        self.status.stage.is_last()
    }
}

/// Monitors an Agama websocket and keeps combination of various installation statuses.
///
/// It can be cloned and moved between threads
pub struct Monitor {
    /// WebSocket client to listen for events.
    ws_client: WebSocketClient,
    /// HTTP client to fetch additional data.
    http_client: BaseHTTPClient,
    /// The current installation status.
    ///
    /// A mutex is needed to avoid race conditions.
    status: Mutex<InstallationStatus>,
    /// Channel to broadcast status updates to subscribers.
    updates: broadcast::Sender<InstallationStatus>,
    /// Whether to stop monitoring when the installation goes idle.
    stop_on_idle: bool,
}

impl Monitor {
    pub async fn get_installation_status(
        http_client: &BaseHTTPClient,
    ) -> Result<InstallationStatus, MonitorError> {
        let manager = ManagerHTTPClient::new(http_client.clone());
        let questions = questions::http_client::HTTPClient::new(http_client.clone());
        let questions = questions.get_questions().await?;
        let questions = questions
            .into_iter()
            .filter(|q| q.answer.is_none())
            .collect();

        // Fetch system information
        let system_info = Self::fetch_system_info(http_client).await?;

        let installation_status = InstallationStatus {
            status: manager.status().await?,
            issues: manager.issues().await?,
            questions,
            system_info,
        };
        Ok(installation_status)
    }

    /// Connects and monitors to an Agama service.
    ///
    /// * `websocket_client`: websocket to listen for events.
    /// * `http_client`: HTTP client to talk to the service.
    /// * `stop_on_idle`: whether to automatically stop monitoring when the installation goes idle.
    ///
    /// Returns a receiver for status updates and the initial status.
    /// The monitor runs on a separate Tokio task and emits InstallationStatus updates.
    /// When stop_on_idle is true, monitoring will stop when the installation becomes idle.
    /// When the monitor stops (connection lost or stop_on_idle), the channel will close.
    pub async fn connect(
        websocket_client: WebSocketClient,
        http_client: &BaseHTTPClient,
        stop_on_idle: bool,
    ) -> Result<(broadcast::Receiver<InstallationStatus>, InstallationStatus), MonitorError> {
        let (tx, rx) = broadcast::channel(100);

        let initial_status = Self::get_installation_status(http_client).await?;

        let mut monitor = Monitor {
            ws_client: websocket_client,
            http_client: http_client.clone(),
            status: Mutex::new(initial_status.clone()),
            updates: tx,
            stop_on_idle,
        };

        tokio::spawn(async move { monitor.run().await });
        Ok((rx, initial_status))
    }

    /// Fetches system information from the API
    /// Returns (SystemInfo, products list) tuple
    async fn fetch_system_info(http_client: &BaseHTTPClient) -> Result<SystemInfo, MonitorError> {
        // Extract IP from HTTP client base URL
        let ip = http_client
            .base_url
            .host_str()
            .unwrap_or("localhost")
            .to_string();

        // Fetch system info from API
        let system_info: MinimalSystemInfo = http_client
            .get("/system")
            .await
            .map_err(|e| MonitorError::Manager(ManagerHTTPClientError::HTTP(e)))?;

        // Extract hostname
        let hostname = system_info.hostname.hostname;

        // Extract machine model
        let machine = system_info
            .hardware
            .model
            .unwrap_or_else(|| "Unknown Machine".to_string());

        let product_id = Self::fetch_product_id(http_client).await?;

        let system = SystemInfo {
            hostname,
            ip,
            machine,
            product_id,
        };

        Ok(system)
    }

    async fn fetch_product_id(
        http_client: &BaseHTTPClient,
    ) -> Result<Option<String>, MonitorError> {
        let config: Config = http_client
            .get("/config")
            .await
            .map_err(|e| MonitorError::Manager(ManagerHTTPClientError::HTTP(e)))?;

        let product_id = config
            .software
            .as_ref()
            .and_then(|p| p.product.as_ref())
            .and_then(|p| p.id.clone());

        Ok(product_id)
    }

    /// Runs the monitor.
    ///
    /// The monitor loop exits when:
    /// - A critical error occurs
    /// - stop_on_idle is true and the installation becomes idle
    ///
    /// When the loop exits, the broadcast sender is dropped, closing the channel.
    async fn run(&mut self) {
        loop {
            let event = self.ws_client.receive().await;
            match self.handle_event(event).await {
                Ok(should_exit) => {
                    if should_exit {
                        break;
                    }
                }
                Err(err) => {
                    tracing::error!("Critical error happen during event handling: {:?}", err);
                    break;
                }
            }
        }
        // Channel closes automatically when self.updates is dropped
    }

    /// Handle events from Agama.
    ///
    /// Given an event, updates the internal state. Once updated, it emits
    /// sends the updated state to its subscribers.
    ///
    /// * `event`: Agama event.
    ///
    /// Returns `Ok(true)` if the monitor should exit, `Ok(false)` to continue.
    async fn handle_event(
        &mut self,
        event: Result<Event, crate::http::WebSocketError>,
    ) -> Result<bool, crate::http::WebSocketError> {
        let event = event?;

        let mut g = self.status.lock().await;
        let status = &mut *g;

        // store only events that are important for monitor
        match event {
            Event::StageChanged { stage } => {
                status.status.stage = stage;
            }
            Event::IssuesChanged { .. } => {
                //TODO: we need better params when issues changed to be able to depend only on websocket
                let manager = ManagerHTTPClient::new(self.http_client.clone());
                let issues = manager.issues().await;
                let Ok(issues) = issues else {
                    tracing::error!("Failed to get list of issues: {:?}", issues);
                    return Ok(false);
                };
                status.issues = issues;

                // Refresh product ID as it might have changed
                // (e.g., when a product is selected, it triggers IssuesChanged)
                match Self::fetch_product_id(&self.http_client).await {
                    Ok(product_id) => status.system_info.product_id = product_id,
                    Err(e) => tracing::error!("Failed to refresh product name: {:?}", e),
                }
            }
            Event::QuestionAdded { .. } => {
                //TODO: we need better params when question is added to be able to depend only on websocket
                let questions = questions::http_client::HTTPClient::new(self.http_client.clone());
                let questions = questions.get_questions().await;
                let Ok(questions) = questions else {
                    tracing::error!("Failed to get list of questions: {:?}", questions);
                    return Ok(false);
                };
                let questions = questions
                    .into_iter()
                    .filter(|q| q.answer.is_none())
                    .collect();
                status.questions = questions;
            }
            Event::QuestionAnswered { id } => {
                status.questions.retain(|q| q.id != id);
            }
            Event::ProgressChanged { progress } => {
                let index = status
                    .status
                    .progresses
                    .iter()
                    .position(|p| p.scope == progress.scope);
                if let Some(index) = index {
                    status.status.progresses[index] = progress;
                } else {
                    status.status.progresses.push(progress);
                }
            }
            Event::ProgressFinished { scope } => {
                status.status.progresses.retain(|p| p.scope != scope);
            }
            _ => {
                // other events are not interesting for monitor
                return Ok(false);
            }
        }

        // Send update (ignore if send failed to avoid flooding logs)
        let _ = self.updates.send(g.clone());

        // Check if we should exit
        let should_exit = self.stop_on_idle && g.is_idle();
        Ok(should_exit)
    }
}
