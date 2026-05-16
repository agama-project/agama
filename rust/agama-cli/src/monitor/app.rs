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
    monitor::{InstallationStatus, Monitor},
};
use anyhow::{anyhow, Result};
use crossterm::event::{Event, KeyCode, KeyEvent, KeyEventKind};
use gettextrs::gettext;
use ratatui::{backend::CrosstermBackend, buffer::Buffer, layout::Rect, widgets::Widget, Terminal};
use serde::Deserialize;
use std::{collections::HashMap, io, time::Duration};
use tokio::sync::broadcast;
use tokio::sync::mpsc;

use super::{theme::Theme, ui};

/// Application messages.
enum Message {
    /// Status update from monitor
    StatusUpdate(InstallationStatus),
    /// Monitor has finished (channel closed)
    MonitorFinished,
    /// Terminal event.
    Terminal(Event),
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
    pub theme: Theme,
    pub stop_on_idle: bool,
}

impl MonitorAppBuilder {
    pub fn new(http_client: BaseHTTPClient, websocket_client: WebSocketClient) -> Self {
        Self {
            http_client,
            websocket_client,
            theme: Theme::default(),
            stop_on_idle: false,
        }
    }
    /// Creates a new MonitorApp with a specific theme.
    pub fn with_theme(mut self, theme: Theme) -> Self {
        self.theme = theme;
        self
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
            updates,
            status,
            theme: self.theme,
            exit: false,
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
    /// Status updates receiver
    updates: broadcast::Receiver<InstallationStatus>,
    /// Current installation status
    status: InstallationStatus,
    /// Product names
    product_names: HashMap<String, String>,
    /// UI color theme
    theme: Theme,
    /// Exit in the next iteration
    exit: bool,
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
    /// * `terminal` - The terminal to draw on
    pub async fn run(
        &mut self,
        terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    ) -> Result<()> {
        let (tx, mut rx) = mpsc::channel(16);

        // Resubscribe to get a new receiver for the task
        let mut status_updates = self.updates.resubscribe();

        // Spawn task to forward status updates
        let tx_monitor = tx.clone();
        tokio::task::spawn(async move {
            loop {
                match status_updates.recv().await {
                    Ok(status) => {
                        if tx_monitor
                            .send(Message::StatusUpdate(status))
                            .await
                            .is_err()
                        {
                            break;
                        }
                    }
                    Err(_) => {
                        // Channel closed - monitoring finished
                        _ = tx_monitor.send(Message::MonitorFinished).await;
                        break;
                    }
                }
            }
        });

        // Spawn task to read terminal events
        let tx_terminal = tx.clone();
        let terminal_handle = tokio::task::spawn(async move {
            loop {
                match crossterm::event::poll(Duration::from_millis(100)) {
                    Ok(true) => {
                        if let Ok(event) = crossterm::event::read() {
                            if tx_terminal.send(Message::Terminal(event)).await.is_err() {
                                break;
                            }
                        }
                    }
                    Err(_) => break,
                    _ => {}
                }
            }
        });

        // Main event loop
        while !self.exit {
            terminal.draw(|f| f.render_widget(&mut *self, f.area()))?;

            let message = rx
                .recv()
                .await
                .ok_or(anyhow!(gettext("Lost the connection with the server.")))?;

            match message {
                Message::StatusUpdate(status) => self.update_status(status),
                Message::MonitorFinished => self.exit = true,
                Message::Terminal(event) => {
                    if let Event::Key(key_event) = event {
                        self.handle_key_event(key_event);
                    }
                }
            }
        }

        terminal_handle.abort();
        Ok(())
    }

    /// Handle terminal key events.
    fn handle_key_event(&mut self, key_event: KeyEvent) {
        if key_event.kind != KeyEventKind::Press {
            return;
        }

        match (key_event.code, key_event.modifiers) {
            (KeyCode::Char('q'), _) | (KeyCode::Esc, _) => {
                self.exit = true;
            }
            _ => {}
        }
    }
}

/// Implement the Widget trait for MonitorApp
/// This allows rendering using ratatui's widget system
impl Widget for &mut MonitorApp {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let layout = ui::create_layout(area);

        // Render each section using widget structs
        ui::StatusBar::new(&self.status, &self.theme).render(layout.status_bar, buf);
        if let Some(product_id) = &self.status.system_info.product_id {
            if let Some(name) = self.product_names.get(product_id) {
                ui::Product::new(name).render(layout.product, buf);
            }
        }
        ui::Separator.render(layout.separator, buf);
        ui::Content::new(&self.status, &self.theme).render(layout.content, buf);
        ui::Separator.render(layout.hints_separator, buf);
        ui::Hints.render(layout.hints, buf);
    }
}
