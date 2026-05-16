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

use agama_lib::monitor::{InstallationStatus, MonitorClient};
use tokio::sync::mpsc;

/// Events emitted by the MonitorRunner
#[derive(Clone, Debug)]
pub enum MonitorEvent {
    /// A new status update is available
    Update(InstallationStatus),
    /// The monitor has finished (either because stop_on_idle triggered or connection lost)
    Finished,
}

/// Core monitoring logic shared between TUI and headless modes.
///
/// This struct encapsulates the monitoring state and exit conditions,
/// allowing different frontends (TUI, headless) to share the same logic.
/// It runs autonomously and emits events.
pub struct MonitorRunner {
    /// Monitor client to subscribe to updates
    monitor: MonitorClient,
    /// Current installation status
    status: InstallationStatus,
    /// Whether to stop when the installation goes idle
    stop_on_idle: bool,
}

impl MonitorRunner {
    /// Creates a new MonitorRunner.
    ///
    /// # Arguments
    ///
    /// * `monitor` - The monitor client to receive updates from
    /// * `status` - The initial installation status
    /// * `stop_on_idle` - Whether to exit when the installation goes idle
    pub fn new(
        monitor: MonitorClient,
        status: InstallationStatus,
        stop_on_idle: bool,
    ) -> Self {
        Self {
            monitor,
            status,
            stop_on_idle,
        }
    }

    /// Checks if the monitor should exit based on current conditions.
    ///
    /// Returns true if stop_on_idle is enabled and the installation is idle.
    fn should_exit(&self) -> bool {
        self.stop_on_idle && self.status.is_idle()
    }

    /// Starts the monitor and returns a receiver for events.
    ///
    /// This method spawns an autonomous task that listens to status updates
    /// and emits MonitorEvent messages. It will emit:
    /// - `MonitorEvent::Update(status)` for each status change
    /// - `MonitorEvent::Finished` when the monitor should exit
    ///
    /// The task runs until:
    /// - The connection is lost
    /// - `stop_on_idle` is true and the installation becomes idle
    ///
    /// # Returns
    ///
    /// A receiver that will receive all MonitorEvent messages.
    ///
    /// # Example
    ///
    /// ```no_run
    /// let mut events = runner.start();
    /// while let Some(event) = events.recv().await {
    ///     match event {
    ///         MonitorEvent::Update(status) => println!("Stage: {:?}", status.status.stage),
    ///         MonitorEvent::Finished => break,
    ///     }
    /// }
    /// ```
    pub fn start(mut self) -> mpsc::Receiver<MonitorEvent> {
        let (tx, rx) = mpsc::channel(16);

        tokio::spawn(async move {
            // Check if we should exit immediately
            if self.should_exit() {
                _ = tx.send(MonitorEvent::Finished).await;
                return;
            }

            let mut updates = self.monitor.subscribe();

            while let Ok(new_status) = updates.recv().await {
                // Send the update event
                if tx.send(MonitorEvent::Update(new_status.clone())).await.is_err() {
                    // Receiver dropped, stop monitoring
                    break;
                }

                // Update internal state
                self.status = new_status;

                // Check if we should exit
                if self.should_exit() {
                    _ = tx.send(MonitorEvent::Finished).await;
                    break;
                }
            }

            // Connection lost or loop ended
            _ = tx.send(MonitorEvent::Finished).await;
        });

        rx
    }
}
