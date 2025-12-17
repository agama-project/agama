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

use agama_lib::monitor::MonitorClient;
use agama_utils::api;
use console::style;
use indicatif::{ProgressBar, ProgressStyle};
use std::time::Duration;

/// Displays the progress on the terminal.
pub struct ProgressMonitor {
    monitor: MonitorClient,
    bar: Option<ProgressBar>,
    current_step: u32,
    running: bool,
    stop_on_idle: bool,
}

impl ProgressMonitor {
    /// Builds a new instance.
    ///
    /// * `MonitorClient`: client to access the Agama monitor.
    pub fn new(monitor: MonitorClient) -> Self {
        Self {
            monitor,
            bar: None,
            current_step: 0,
            running: true,
            stop_on_idle: true,
        }
    }

    /// Determines whether the progress should stop when the service becomes idle.
    pub fn stop_on_idle(mut self, stop_on_idle: bool) -> Self {
        self.stop_on_idle = stop_on_idle;
        self
    }

    /// Starts the UI representing the progress.
    pub async fn run(&mut self) -> anyhow::Result<()> {
        let mut updates = self.monitor.subscribe();
        let status = self.monitor.get_status().await?;
        self.update(status).await;
        if !self.running {
            return Ok(());
        }

        loop {
            if let Ok(status) = updates.recv().await {
                if !self.update(status).await {
                    return Ok(());
                }
            }
        }
    }

    /// Updates the progress.
    ///
    /// It returns true if the monitor should continue.
    async fn update(&mut self, status: api::Status) -> bool {
        if status.progresses.is_empty() && self.running {
            self.finish();
            if self.stop_on_idle {
                return false;
            }
        }

        
        // TODO: adapt to multi progresses

        true
    }

    /// Stops the representation.
    fn finish(&mut self) {
        self.running = false;
        if let Some(bar) = self.bar.take() {
            bar.finish_with_message("Done");
        }
    }
}
