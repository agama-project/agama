// Copyright (c) [2024] SUSE LLC
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

//! This module includes the struct that represent a service progress step.

use serde::{Deserialize, Serialize};

/// Represents the progress for an Agama service.
#[derive(Clone, Default, Debug, Deserialize, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    /// Current step
    pub current_step: u32,
    /// Number of steps
    pub max_steps: u32,
    /// Title of the current step
    pub current_title: String,
    /// Whether the progress reporting is finished
    pub finished: bool,
}

impl Progress {
    pub async fn from_proxy(proxy: &crate::proxies::ProgressProxy<'_>) -> zbus::Result<Progress> {
        let (current_step, max_steps, finished) =
            tokio::join!(proxy.current_step(), proxy.total_steps(), proxy.finished());

        let (current_step, current_title) = current_step?;
        Ok(Self {
            current_step,
            current_title,
            max_steps: max_steps?,
            finished: finished?,
        })
    }

    pub fn from_cached_proxy(proxy: &crate::proxies::ProgressProxy<'_>) -> Option<Progress> {
        let (current_step, current_title) = proxy.cached_current_step().ok()??;
        let max_steps = proxy.cached_total_steps().ok()??;
        let finished = proxy.cached_finished().ok()??;

        Some(Progress {
            current_step,
            current_title,
            max_steps,
            finished,
        })
    }
}

/// Information about the current progress sequence.
#[derive(Clone, Debug, Default, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProgressSequence {
    /// Sequence steps if known in advance
    pub steps: Vec<String>,
    #[serde(flatten)]
    pub progress: Progress,
}

#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProgressSummary {
    pub steps: Vec<String>,
    pub current_step: u32,
    pub max_steps: u32,
    pub current_title: String,
    pub finished: bool,
}

impl ProgressSummary {
    pub fn finished() -> Self {
        Self {
            steps: vec![],
            current_step: 0,
            max_steps: 0,
            current_title: "".to_string(),
            finished: true,
        }
    }
}

/// A sequence of progress steps.
/// FIXME: find a better name to distinguish from agama-server::web::common::ProgressSequence.
#[derive(Debug)]
pub struct ProgressSequence {
    pub steps: Vec<String>,
    current: usize,
}

impl ProgressSequence {
    /// Create a new progress sequence with the given steps.
    ///
    /// * `steps`: The steps to create the sequence from.
    pub fn new(steps: Vec<String>) -> Self {
        Self { steps, current: 0 }
    }

    /// Move to the next step in the sequence and return the progress for it.
    ///
    /// It returns `None` if the sequence is finished.
    pub fn next_step(&mut self) -> Option<Progress> {
        if self.is_finished() {
            return None;
        }
        self.current += 1;
        self.step()
    }

    /// The progres has finished.
    pub fn is_finished(&self) -> bool {
        self.current == self.steps.len()
    }

    /// Return the progress for the current step.
    pub fn step(&self) -> Option<Progress> {
        if self.is_finished() {
            return None;
        }

        let current_title = self.steps.get(self.current).unwrap().clone();
        Some(Progress {
            current_step: (self.current + 1) as u32,
            max_steps: self.steps.len() as u32,
            current_title,
            finished: (self.current + 1) == self.steps.len(),
        })
    }
}
