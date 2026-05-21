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

use agama_lib::{
    http::{BaseHTTPClient, WebSocketClient},
    monitor::{InstallationStatus, Monitor, MonitorUpdate},
};
use anyhow::{anyhow, Result};
use crossterm::event::{Event, EventStream, KeyCode, KeyEvent, KeyEventKind, KeyModifiers};
use futures_util::StreamExt;
use ratatui::{backend::CrosstermBackend, buffer::Buffer, layout::Rect, widgets::Widget, Terminal};
use serde::Deserialize;
use std::{collections::HashMap, io};
use tokio::sync::mpsc;

use super::ui;

/// Application messages (internal).
#[derive(Clone, Debug)]
enum Message {
    /// Status update from monitor
    StatusUpdate(InstallationStatus),
    /// Monitor finished (installation became idle)
    Finished,
    /// Monitor disconnected (connection lost)
    Disconnected,
    /// Monitor stopped with error
    Error(String),
    /// Terminal event.
    Terminal(Event),
}

/// Errors that can occur while running the monitor.
#[derive(Debug, thiserror::Error)]
pub enum MonitorError {
    /// Connection to the server was closed.
    #[error("Connection to the server was closed")]
    Disconnected,
    /// An error occurred during monitoring.
    #[error("{0}")]
    MonitoringError(String),
    /// I/O error.
    #[error(transparent)]
    Io(#[from] std::io::Error),
    /// Other error.
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

// FIXME: find a better place
/// Minimal struct to deserialize product information from /system
#[derive(Debug, Deserialize)]
struct ProductInfo {
    id: String,
    name: String,
}

#[derive(Debug, Deserialize)]
struct MinimalSystemInfo {
    products: Vec<ProductInfo>,
}

pub struct MonitorAppBuilder {
    pub http_client: BaseHTTPClient,
    pub websocket_client: WebSocketClient,
    pub stop_on_idle: bool,
}

impl MonitorAppBuilder {
    pub fn new(http_client: BaseHTTPClient, websocket_client: WebSocketClient) -> Self {
        Self {
            http_client,
            websocket_client,
            stop_on_idle: false,
        }
    }

    /// Sets the monitor to stop after going idle (no running progress).
    pub fn with_stop_on_idle(mut self, stop: bool) -> Self {
        self.stop_on_idle = stop;
        self
    }

    pub async fn build(self) -> Result<MonitorApp> {
        let product_names = self.get_product_names().await?;
        let (updates, status) =
            Monitor::connect(self.websocket_client, &self.http_client, self.stop_on_idle).await?;

        Ok(MonitorApp {
            updates: Some(updates),
            status,
            product_names,
        })
    }

    async fn get_product_names(&self) -> Result<HashMap<String, String>> {
        let info: MinimalSystemInfo = self.http_client.get("/system").await?;
        let product_names = info
            .products
            .iter()
            .map(|i| (i.id.clone(), i.name.clone()))
            .collect();
        Ok(product_names)
    }
}

/// Application state for the monitor TUI
pub struct MonitorApp {
    /// Monitor updates receiver (taken when run() is called)
    updates: Option<mpsc::Receiver<MonitorUpdate>>,
    /// Current installation status
    status: InstallationStatus,
    /// Product names
    product_names: HashMap<String, String>,
}

impl MonitorApp {
    /// Updates the installation status.
    fn update_status(&mut self, new_status: InstallationStatus) {
        self.status = new_status;
    }

    /// Runs the monitor TUI event loop.
    ///
    /// This method spawns two tasks:
    /// 1. The monitor event forwarding task
    /// 2. A terminal event polling task
    ///
    /// The main loop reacts to events from both sources.
    ///
    /// Returns `Ok(())` when monitoring finishes normally (idle or user quit).
    /// Returns `Err(MonitorError)` when an error occurs (disconnection or monitoring error).
    ///
    /// * `terminal` - The terminal to draw on
    pub async fn run(
        &mut self,
        terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    ) -> Result<(), MonitorError> {
        let (tx, mut rx) = mpsc::channel(16);

        // Take ownership of the monitor updates receiver
        let mut status_updates = self
            .updates
            .take()
            .ok_or(anyhow!("Monitor receiver already taken"))?;

        // Spawn task to forward monitor updates
        let tx_monitor = tx.clone();
        tokio::task::spawn(async move {
            while let Some(update) = status_updates.recv().await {
                let message = match update {
                    MonitorUpdate::Status(status) => Message::StatusUpdate(status),
                    MonitorUpdate::Finished => Message::Finished,
                    MonitorUpdate::Disconnected => Message::Disconnected,
                    MonitorUpdate::Error(e) => Message::Error(e),
                };
                if tx_monitor.send(message).await.is_err() {
                    break;
                }
            }
        });

        // Spawn task to read terminal events
        let tx_terminal = tx.clone();
        let terminal_handle = tokio::task::spawn(async move {
            let mut event_stream = EventStream::new();
            while let Some(event) = event_stream.next().await {
                match event {
                    Ok(event) => {
                        if tx_terminal.send(Message::Terminal(event)).await.is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        // Main event loop
        loop {
            terminal.draw(|f| f.render_widget(&mut *self, f.area()))?;

            let message = rx.recv().await.ok_or(MonitorError::Disconnected)?;

            match message {
                Message::StatusUpdate(status) => self.update_status(status),
                Message::Finished => {
                    terminal_handle.abort();
                    return Ok(());
                }
                Message::Disconnected => {
                    terminal_handle.abort();
                    return Err(MonitorError::Disconnected);
                }
                Message::Error(e) => {
                    terminal_handle.abort();
                    return Err(MonitorError::MonitoringError(e));
                }
                Message::Terminal(event) => {
                    if let Event::Key(key_event) = event {
                        if self.handle_key_event(key_event) {
                            terminal_handle.abort();
                            return Ok(());
                        }
                    }
                }
            }
        }
    }

    /// Handle terminal key events.
    /// Returns true if the application should exit.
    fn handle_key_event(&mut self, key_event: KeyEvent) -> bool {
        if key_event.kind != KeyEventKind::Press {
            return false;
        }

        matches!(
            (key_event.code, key_event.modifiers),
            (KeyCode::Char('q'), _)
                | (KeyCode::Esc, _)
                | (KeyCode::Char('c'), KeyModifiers::CONTROL)
        )
    }
}

/// Implement the Widget trait for MonitorApp
/// This allows rendering using ratatui's widget system
impl Widget for &mut MonitorApp {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let product_name = self
            .status
            .system_info
            .product_id
            .as_ref()
            .and_then(|id| self.product_names.get(id));

        let summary = ui::Summary::new(&self.status, product_name.cloned());
        let layout = ui::create_layout(area, summary.indentation);

        summary.render(layout.summary, buf);
        ui::Content::new(&self.status).render(layout.content, buf);
    }
}
