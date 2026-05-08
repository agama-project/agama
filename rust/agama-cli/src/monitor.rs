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

mod app;
mod theme;
mod ui;

use agama_lib::http::{BaseHTTPClient, WebSocketClient};
use anyhow::{anyhow, Result};
use crossterm::{
    event::{DisableMouseCapture, EnableMouseCapture},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};
use std::io;

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

/// Parses a theme name and returns the corresponding Theme
///
/// # Arguments
///
/// * `name` - Theme name ("monochrome", "colored", or "suse_green")
fn parse_theme(name: &str) -> Result<Theme> {
    match name.to_lowercase().as_str() {
        "monochrome" => Ok(Theme::monochrome()),
        "colored" => Ok(Theme::colored()),
        "suse_green" | "suse-green" => Ok(Theme::suse_green()),
        _ => Err(anyhow!(
            "Unknown theme '{}'. Valid options: monochrome, colored, suse_green",
            name
        )),
    }
}

/// Starts the TUI monitor
///
/// # Arguments
///
/// * `http_client` - The HTTP client to communicate with the Agama service
/// * `websocket` - The WebSocket client to listen for events
/// * `stop_on_idle` - Whether to stop monitoring when Agama becomes idle
/// * `theme_name` - Name of the color theme to use
pub async fn run(
    http_client: BaseHTTPClient,
    websocket: WebSocketClient,
    stop_on_idle: bool,
    theme_name: &str,
) -> Result<()> {
    // Parse the theme
    let theme = parse_theme(theme_name)?;

    // // Connect to monitor and get initial status
    // let (monitor, initial_status) = Monitor::connect(websocket, &http_client).await?;

    // Create app state with selected theme
    let mut app = MonitorAppBuilder::new(http_client, websocket)
        .with_theme(theme)
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
