// Copyright (c) [2024-2025] SUSE LLC
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

use agama_lib::monitor::{InstallationStatus, MonitorClient};
use anyhow::Result;
use crossterm::event::{self, Event, KeyCode, KeyModifiers};
use ratatui::{backend::CrosstermBackend, buffer::Buffer, layout::Rect, widgets::Widget, Terminal};
use std::{io, time::Duration};

use super::{theme::Theme, ui};

/// Polling interval for keyboard events (milliseconds)
const EVENT_POLL_INTERVAL_MS: u64 = 100;

/// Application state for the monitor TUI
pub struct MonitorApp {
    /// Current installation status (includes system info)
    pub status: InstallationStatus,
    /// UI color theme
    pub theme: Theme,
}

impl MonitorApp {
    /// Creates a new MonitorApp from the initial status
    pub fn new(status: InstallationStatus) -> Self {
        Self {
            status,
            theme: Theme::default(),
        }
    }

    /// Updates the installation status
    pub fn update_status(&mut self, new_status: InstallationStatus) {
        self.status = new_status;
    }

    /// Runs the monitor TUI event loop
    ///
    /// # Arguments
    ///
    /// * `terminal` - The terminal to draw on
    /// * `monitor` - The monitor client to receive updates from
    /// * `stop_on_idle` - Whether to stop monitoring when installation finishes
    pub async fn run(
        &mut self,
        terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
        monitor: MonitorClient,
        stop_on_idle: bool,
    ) -> Result<()> {
        let mut updates = monitor.subscribe();

        // Initial render
        terminal.draw(|f| f.render_widget(&mut *self, f.area()))?;

        // Main event loop - WebSocket-driven, no timers
        loop {
            tokio::select! {
                // WebSocket status updates - trigger full redraw
                // This includes any changes to: status, issues, questions, progresses, system info
                Ok(new_status) = updates.recv() => {
                    self.update_status(new_status);
                    terminal.draw(|f| f.render_widget(&mut *self, f.area()))?;

                    // Check exit conditions
                    if stop_on_idle && self.should_exit() {
                        break;
                    }
                }

                // Keyboard and terminal events (poll with short timeout)
                _ = tokio::time::sleep(Duration::from_millis(EVENT_POLL_INTERVAL_MS)) => {
                    if event::poll(Duration::from_millis(0))? {
                        match event::read()? {
                            Event::Key(key) => {
                                match (key.code, key.modifiers) {
                                    (KeyCode::Char('q'), _) |
                                    (KeyCode::Esc, _) |
                                    (KeyCode::Char('c'), KeyModifiers::CONTROL) => {
                                        break;
                                    }
                                    _ => {}
                                }
                            }
                            Event::Resize(_, _) => {
                                // Terminal resize - trigger redraw
                                terminal.draw(|f| f.render_widget(&mut *self, f.area()))?;
                            }
                            _ => {}
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Returns true if the app should exit
    pub fn should_exit(&self) -> bool {
        self.status.status.stage.is_last()
    }
}

/// Implement the Widget trait for MonitorApp
/// This allows rendering using ratatui's widget system
impl Widget for &mut MonitorApp {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let layout = ui::create_layout(area);

        // Render each section using widget structs
        ui::StatusBar::new(&self.status, &self.theme).render(layout.status_bar, buf);
        if let Some(product_name) = &self.status.system_info.product_name {
            ui::Product::new(&product_name).render(layout.product, buf);
        }
        ui::Separator.render(layout.separator, buf);
        ui::Content::new(&self.status, &self.theme).render(layout.content, buf);
        ui::Separator.render(layout.hints_separator, buf);
        ui::Hints.render(layout.hints, buf);
    }
}
