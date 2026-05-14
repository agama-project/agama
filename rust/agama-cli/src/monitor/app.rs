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
    monitor::{InstallationStatus, Monitor, MonitorClient},
};
use anyhow::{anyhow, Result};
use crossterm::event::{Event, KeyCode, KeyEvent, KeyEventKind};
use gettextrs::gettext;
use ratatui::{backend::CrosstermBackend, buffer::Buffer, layout::Rect, widgets::Widget, Terminal};
use serde::Deserialize;
use std::{collections::HashMap, io, time::Duration};
use tokio::sync::mpsc;

use super::{theme::Theme, ui};

/// Application messages.
enum Message {
    /// Agama status update.
    Update(InstallationStatus),
    /// Terminal event.
    TerminalEvent(Event),
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
        let (monitor, status) = Monitor::connect(self.websocket_client, &self.http_client).await?;

        Ok(MonitorApp {
            monitor,
            status,
            theme: self.theme,
            stop_on_idle: self.stop_on_idle,
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
    /// Current installation status (includes system info)
    status: InstallationStatus,
    /// Product names
    product_names: HashMap<String, String>,
    /// UI color theme
    theme: Theme,
    /// Exit in the next iteration
    exit: bool,
    /// Stop on idle
    stop_on_idle: bool,
    /// Monitor client
    monitor: MonitorClient,
}

impl MonitorApp {
    /// Updates the installation status.
    pub fn update_status(&mut self, new_status: InstallationStatus) {
        if self.stop_on_idle && new_status.is_idle() {
            self.exit = true;
        }
        self.status = new_status;
    }

    /// Runs the monitor TUI event loop.
    ///
    /// This method spawns two tokio tasks to read the events coming from the
    /// MonitorClient and the console events from crossterm. This approach
    /// helps to improve the responsiveness of the application.
    ///
    /// * `terminal` - The terminal to draw on
    /// * `monitor` - The monitor client to receive updates from
    pub async fn run(
        &mut self,
        terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    ) -> Result<()> {
        let (tx, mut rx) = mpsc::channel(16);
        let tx_clone = tx.clone();
        let mut updates = self.monitor.subscribe();

        tokio::task::spawn(async move {
            while let Ok(new_status) = updates.recv().await {
                _ = tx_clone.send(Message::Update(new_status)).await;
            }
        });

        let handle = tokio::task::spawn(async move {
            loop {
                match crossterm::event::poll(Duration::from_millis(100)) {
                    Ok(true) => {
                        if let Ok(event) = crossterm::event::read() {
                            _ = tx.send(Message::TerminalEvent(event)).await;
                        }
                    }
                    Err(_) => break,
                    _ => {}
                }
            }
        });

        while !self.exit {
            terminal.draw(|f| f.render_widget(&mut *self, f.area()))?;

            let message = rx
                .recv()
                .await
                .ok_or(anyhow!(gettext("Lost the connection with the server.")))?;

            match message {
                Message::Update(update) => self.update_status(update),
                Message::TerminalEvent(event) => {
                    if let Event::Key(key_event) = event {
                        self.handle_key_event(key_event);
                    }
                }
            }
        }

        handle.abort();
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
