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

//! Terminal UI monitor using ratatui
//!
//! This module provides a full-screen terminal UI for monitoring Agama installation progress.
//! It uses ratatui for rendering and is driven by WebSocket updates from the backend.

mod app;
mod ui;

use agama_lib::{
    http::{BaseHTTPClient, WebSocketClient},
    monitor::Monitor,
};
use anyhow::Result;
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};
use std::{io, time::Duration};

use app::MonitorApp;

/// Sets up the terminal for fullscreen TUI mode
fn setup_terminal() -> Result<Terminal<CrosstermBackend<io::Stdout>>> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    Ok(Terminal::new(backend)?)
}

/// Restores the terminal to normal mode
fn restore_terminal(terminal: &mut Terminal<CrosstermBackend<io::Stdout>>) -> Result<()> {
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;
    Ok(())
}

/// Starts the TUI monitor
///
/// # Arguments
///
/// * `http_client` - The HTTP client to communicate with the Agama service
/// * `websocket` - The WebSocket client to listen for events
/// * `stop_on_idle` - Whether to stop monitoring when Agama becomes idle
pub async fn run(
    http_client: BaseHTTPClient,
    websocket: WebSocketClient,
    stop_on_idle: bool,
) -> Result<()> {
    // Connect to monitor and get initial status
    let (monitor, initial_status) = Monitor::connect(websocket, &http_client).await?;

    // Create app state
    let mut app = MonitorApp::new(&http_client, initial_status).await?;

    // Setup terminal
    let mut terminal = setup_terminal()?;
    let mut updates = monitor.subscribe();

    // Initial render
    terminal.draw(|f| app.draw(f))?;

    // Main event loop - WebSocket-driven, no timers
    let result = loop {
        tokio::select! {
            // WebSocket status updates - trigger full redraw
            // This includes any changes to: status, issues, questions, progresses
            // Also refreshes product name from config
            Ok(new_status) = updates.recv() => {
                app.update_status(new_status).await?;
                terminal.draw(|f| app.draw(f))?;

                // Check exit conditions
                if stop_on_idle && app.should_exit() {
                    break Ok(());
                }
            }

            // Keyboard and terminal events (poll with short timeout)
            _ = tokio::time::sleep(Duration::from_millis(100)) => {
                if event::poll(Duration::from_millis(0))? {
                    match event::read()? {
                        Event::Key(key) => {
                            match (key.code, key.modifiers) {
                                (KeyCode::Char('q'), _) |
                                (KeyCode::Esc, _) |
                                (KeyCode::Char('c'), KeyModifiers::CONTROL) => {
                                    break Ok(());
                                }
                                _ => {}
                            }
                        }
                        Event::Resize(_, _) => {
                            // Terminal resize - trigger redraw
                            terminal.draw(|f| app.draw(f))?;
                        }
                        _ => {}
                    }
                }
            }
        }
    };

    // Cleanup
    restore_terminal(&mut terminal)?;
    result
}
