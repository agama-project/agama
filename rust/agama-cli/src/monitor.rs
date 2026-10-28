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

//! Terminal UI monitor using ratatui
//!
//! This module provides an inline terminal UI for monitoring Agama installation progress.
//! It uses ratatui for rendering and is driven by WebSocket updates from the backend.
//! When no terminal is available, it falls back to a simple text-based monitor.

mod app;
mod ui;

use agama_lib::{
    http::{BaseHTTPClient, WebSocketClient},
    monitor::{Monitor, MonitorUpdate},
};
use anyhow::Result;
use crossterm::terminal::{disable_raw_mode, enable_raw_mode};
use ratatui::{backend::CrosstermBackend, Terminal, TerminalOptions, Viewport};
use std::io::{self, IsTerminal};

use crate::{monitor::app::MonitorAppBuilder, status::StatusReport};

const MONITOR_HEIGHT: u16 = 20;

/// Sets up the terminal for inline TUI mode
fn setup_terminal() -> Result<Terminal<CrosstermBackend<io::Stdout>>> {
    enable_raw_mode()?;
    let stdout = io::stdout();
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::with_options(
        backend,
        TerminalOptions {
            viewport: Viewport::Inline(MONITOR_HEIGHT),
        },
    )?;
    terminal.hide_cursor()?;
    Ok(terminal)
}

/// Restores the terminal to normal mode
fn restore_terminal(terminal: &mut Terminal<CrosstermBackend<io::Stdout>>) -> Result<()> {
    terminal.show_cursor()?;
    terminal.clear()?;
    disable_raw_mode()?;
    Ok(())
}

/// Runs the monitor in headless (text-only) mode
///
/// This mode is used when no terminal is available (e.g., systemd service, automation).
/// It prints status updates as plain text instead of using the TUI.
///
/// # Arguments
///
/// * `http_client` - The HTTP client to communicate with the Agama service
/// * `websocket` - The WebSocket client to listen for events
/// * `stop_on_idle` - Whether to stop monitoring when Agama becomes idle
async fn run_headless(
    http_client: BaseHTTPClient,
    websocket: WebSocketClient,
    stop_on_idle: bool,
) -> Result<()> {
    let (mut updates, status) = Monitor::connect(websocket, &http_client, stop_on_idle).await?;

    println!("Agama monitor started (headless mode)");
    println!("Initial stage: {:?}", status.status.stage);

    // Listen to updates
    while let Some(update) = updates.recv().await {
        match update {
            MonitorUpdate::Status(status) => {
                println!(
                    "stage: {:?}, active tasks: {}, progresses: {}, issues: {}, questions: {}",
                    status.status.stage,
                    status.status.tasks.len(),
                    status.status.progresses.len(),
                    status.issues.len(),
                    status.questions.len()
                );
            }
            MonitorUpdate::Finished => {
                break;
            }
            MonitorUpdate::Disconnected => {
                eprintln!("Connection to the server was closed.");
                break;
            }
            MonitorUpdate::Error(e) => {
                eprintln!("{e}");
                break;
            }
        }
    }

    Ok(())
}

/// Starts the monitor (TUI or headless mode based on terminal availability)
///
/// When a terminal is available, uses the inline TUI.
/// Otherwise, falls back to simple text output.
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
    // Check if stdout is connected to a terminal
    if !io::stdout().is_terminal() {
        return run_headless(http_client, websocket, stop_on_idle).await;
    }

    // Create app state with selected theme
    let mut app = MonitorAppBuilder::new(http_client, websocket)
        .with_stop_on_idle(stop_on_idle)
        .build()
        .await?;

    // Setup terminal
    let mut terminal = setup_terminal()?;

    // Run the app
    let result = app.run(&mut terminal).await;

    // Cleanup
    restore_terminal(&mut terminal)?;

    // Handle result
    match result {
        Ok(status) => {
            let report = StatusReport::new(status);
            println!("{}", report);
        }
        Err(e) => {
            eprintln!("{e}");
        }
    }

    // Forces crossterm loop to finish.
    std::process::exit(0);
}
