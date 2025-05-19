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

use agama_lib::{
    monitor::{MonitorClient, MonitorStatus},
    progress::{Progress, ProgressPresenter},
};
use async_trait::async_trait;
use console::style;
use indicatif::{ProgressBar, ProgressStyle};
use std::time::Duration;

const MANAGER_SERVICE: &str = "org.opensuse.Agama.Manager1";
const SOFTWARE_SERVICE: &str = "org.opensuse.Agama.Software1";

/// Reports the installer progress through the terminal
pub struct InstallerProgress {
    bar: Option<ProgressBar>,
}

impl InstallerProgress {
    pub fn new() -> Self {
        Self { bar: None }
    }

    fn update_bar(&mut self, progress: &Progress) {
        let bar = self.bar.get_or_insert_with(|| {
            let style = ProgressStyle::with_template("{spinner:.green} {msg}").unwrap();
            let bar = ProgressBar::new(0).with_style(style);
            bar.enable_steady_tick(Duration::from_millis(120));
            bar
        });
        bar.set_length(progress.max_steps.into());
        bar.set_position(progress.current_step.into());
        bar.set_message(progress.current_title.to_owned());
    }
}

#[async_trait]
impl ProgressPresenter for InstallerProgress {
    async fn start(&mut self, progress: &Progress) {
        if !progress.finished {
            self.update_main(progress).await;
        }
    }

    async fn update_main(&mut self, progress: &Progress) {
        let counter = format!("[{}/{}]", &progress.current_step, &progress.max_steps);

        println!(
            "{} {}",
            style(&counter).bold().green(),
            &progress.current_title
        );
    }

    async fn update_detail(&mut self, progress: &Progress) {
        if progress.finished {
            if let Some(bar) = self.bar.take() {
                bar.finish_and_clear();
            }
        } else {
            self.update_bar(progress);
        }
    }

    async fn finish(&mut self) {
        if let Some(bar) = self.bar.take() {
            bar.finish_and_clear();
        }
    }
}

/// Represents the progress of the Agama service.
pub struct MonitorProgress {
    monitor: MonitorClient,
    bar: Option<ProgressBar>,
    current_step: u32,
    running: bool,
    stop_on_idle: bool,
}

impl MonitorProgress {
    /// Builds a new instance.
    ///
    /// * `MonitorClient`: client to access the Agama monitor.
    pub fn new(monitor: MonitorClient) -> Self {
        Self {
            monitor,
            bar: None,
            current_step: 0,
            running: false,
            stop_on_idle: true,
        }
    }

    /// Determines whether the progress should stop when the service becomes idle.
    pub fn stop_on_idle(mut self, stop_on_idle: bool) -> Self {
        self.stop_on_idle = stop_on_idle;
        self
    }

    /// Starts the UI representing the progress.
    pub async fn run(&mut self) {
        let mut updates = self.monitor.subscribe();
        let status = self.monitor.get_status().await.unwrap();
        self.update(status).await;

        loop {
            if let Ok(status) = updates.recv().await {
                if !self.update(status).await {
                    return;
                }
            }
        }
    }

    /// Updates the progress.
    ///
    /// It returns true if the monitor should continue.
    async fn update(&mut self, status: MonitorStatus) -> bool {
        if status.progress.get(MANAGER_SERVICE).is_none() && self.running {
            self.finish();
            if self.stop_on_idle {
                return false;
            }
        }

        if let Some(progress) = status.progress.get(MANAGER_SERVICE) {
            self.running = true;
            if self.current_step != progress.current_step {
                self.update_main(&progress).await;
                self.current_step = progress.current_step;
            }
        }

        match status.progress.get(SOFTWARE_SERVICE) {
            Some(progress) => self.update_bar(progress),
            None => self.remove_bar(),
        }

        true
    }

    /// Updates the main bar.
    async fn update_main(&mut self, progress: &Progress) {
        let counter = format!("[{}/{}]", &progress.current_step, &progress.max_steps);

        println!(
            "{} {}",
            style(&counter).bold().green(),
            &progress.current_title
        );
    }

    fn update_bar(&mut self, progress: &Progress) {
        let bar = self.bar.get_or_insert_with(|| {
            let style = ProgressStyle::with_template("{spinner:.green} {msg}").unwrap();
            let bar = ProgressBar::new(0).with_style(style);
            bar.enable_steady_tick(Duration::from_millis(120));
            bar
        });

        bar.set_length(progress.max_steps.into());
        bar.set_position(progress.current_step.into());
        bar.set_message(progress.current_title.to_owned());
    }

    fn remove_bar(&mut self) {
        _ = self.bar.take()
    }

    /// Stops the representation.
    fn finish(&mut self) {
        self.running = false;
        if let Some(bar) = self.bar.take() {
            bar.finish_with_message("Done");
        }
    }
}
