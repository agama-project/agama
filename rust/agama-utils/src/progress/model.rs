// Copyright (c) [2025] SUSE LLC
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

use crate::progress::service::Error;
use serde::Serialize;

#[derive(Clone, Default, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    /// Scope of the progress
    pub scope: String,
    /// Max number of steps
    pub size: usize,
    /// List of steps
    pub steps: Option<Vec<String>>,
    /// Current step
    pub step: Option<String>,
    /// Index of the current step
    pub index: Option<usize>,
}

impl Progress {
    pub fn new(scope: String, size: usize) -> Self {
        Self {
            scope,
            size,
            ..Default::default()
        }
    }

    pub fn new_with_steps(scope: String, steps: Vec<String>) -> Self {
        Self {
            scope,
            size: steps.len(),
            steps: Some(steps),
            ..Default::default()
        }
    }

    pub fn next(&mut self) -> Result<(), Error> {
        match self.index {
            Some(index) if index >= self.size => Err(Error::NextStep(self.scope.clone())),
            Some(index) => {
                let next_index = index + 1;
                self.index = Some(next_index);
                self.step = self.get_step(next_index);
                Ok(())
            }
            None => {
                let first_index = 1;
                self.index = Some(first_index);
                self.step = self.get_step(first_index);
                Ok(())
            }
        }
    }

    pub fn next_step(&mut self, step: String) -> Result<(), Error> {
        self.next().and_then(|_| {
            self.step = Some(step);
            Ok(())
        })
    }

    fn get_step(&self, index: usize) -> Option<String> {
        self.steps
            .as_ref()
            .and_then(|n| n.get(index - 1))
            .and_then(|n| Some(n.clone()))
    }
}
