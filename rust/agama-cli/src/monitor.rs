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
//! This module provides a full-screen terminal UI for monitoring Agama installation progress.
//! It uses ratatui for rendering and is driven by WebSocket updates from the backend.
//! When no terminal is available, it falls back to a simple text-based monitor.

mod app;
mod theme;
mod ui;

use agama_lib::{
    http::{BaseHTTPClient, WebSocketClient},
    monitor::Monitor,
};
use anyhow::Result;
use crossterm::{
    event::{DisableMouseCapture, EnableMouseCapture},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};
use std::io::{self, IsTerminal};

use theme::Theme;

use crate::monitor::app::MonitorAppBuilder;

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

    // Listen to updates until channel closes
    while let Ok(status) = updates.recv().await {
        println!(
            "Stage: {:?}, Active tasks: {}, Issues: {}, Questions: {}",
            status.status.stage,
            status.status.progresses.len(),
            status.issues.len(),
            status.questions.len()
        );
    }

    println!("Monitoring finished");
    Ok(())
}

/// Starts the monitor (TUI or headless mode based on terminal availability)
///
/// When a terminal is available, uses the full-screen TUI.
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
        .with_theme(Theme::monochrome())
        .with_stop_on_idle(stop_on_idle)
        .build()
        .await?;

    // Setup terminal
    let mut terminal = setup_terminal()?;

    // Run the app
    let result = app.run(&mut terminal).await;

    // Cleanup
    restore_terminal(&mut terminal)?;

    if let Err(error) = result {
        eprintln!("Error running the monitor: {error}");
    }

    // Forces crossterm loop to finish.
    std::process::exit(0);
}
