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
//! It provides a [`MonitorClient`] that can be used to query the current status or subscribe
//! to updates via a broadcast channel.
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
//! // Connect the monitor (this spawns a background task) also receive initial status
//! let (monitor_client, status) = Monitor::connect(ws_client, &http_client).await?;
//! println!("Current stage: {:?}", status.status.stage);
//!
//! // Subscribe to future updates
//! let mut rx = monitor_client.subscribe();
//! while let Ok(new_status) = rx.recv().await {
//!     println!("Status updated! Issues count: {}", new_status.issues.len());
//! }
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

/// It allows connecting to the Agama monitor to get the status or listen for changes.
///
/// It can be cloned and moved between threads.
#[derive(Clone, Debug)]
pub struct MonitorClient {
    /// Channel to subscribe to status updates.
    updates: broadcast::Sender<InstallationStatus>,
}

impl MonitorClient {
    /// Subscribe to status updates from the monitor.
    ///
    /// It uses a regular broadcast channel from the Tokio library.
    pub fn subscribe(&self) -> broadcast::Receiver<InstallationStatus> {
        self.updates.subscribe()
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
    /// * `http_client`: HTTP client to talk to the service.
    /// * `websocket_client`: websocket to listen for events.
    ///
    /// The monitor runs on a separate Tokio task.
    pub async fn connect(
        websocket_client: WebSocketClient,
        http_client: &BaseHTTPClient,
    ) -> Result<(MonitorClient, InstallationStatus), MonitorError> {
        // Channel to send/receive commands from the client.
        let (updates, _rx) = broadcast::channel(100);
        let client = MonitorClient {
            updates: updates.clone(),
        };

        let initial_status = Self::get_installation_status(http_client).await?;

        let mut monitor = Monitor {
            ws_client: websocket_client,
            http_client: http_client.clone(),
            status: Mutex::new(initial_status.clone()),
            updates,
        };

        tokio::spawn(async move { monitor.run().await });
        Ok((client, initial_status))
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
    async fn run(&mut self) {
        loop {
            let event = self.ws_client.receive().await;
            if let Err(err) = self.handle_event(event).await {
                tracing::error!("Critical error happen during event handling: {:?}", err);
                break;
            };
        }
    }

    /// Handle events from Agama.
    ///
    /// Given an event, updates the internal state. Once updated, it emits
    /// sends the updated state to its subscribers.
    ///
    /// * `event`: Agama event.
    async fn handle_event(
        &mut self,
        event: Result<Event, crate::http::WebSocketError>,
    ) -> Result<(), crate::http::WebSocketError> {
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
                    return Ok(());
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
                    return Ok(());
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
                return Ok(());
            }
        }

        // lets ignore if send failed, otherwise with progress updates we will have logs full quickly
        let _ = self.updates.send(g.clone());
        Ok(())
    }
}
