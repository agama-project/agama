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

use crate::api::scope::Scope;
use serde::{Deserialize, Serialize};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Next step does not exist for {0}")]
    MissingStep(Scope),
}

#[derive(Clone, Debug, Deserialize, Serialize, utoipa::ToSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    /// Scope of the progress
    pub scope: Scope,
    /// Max number of steps
    pub size: usize,
    /// List of steps
    pub steps: Vec<String>,
    /// Current step
    pub step: String,
    /// Index of the current step
    pub index: usize,
}

impl Progress {
    pub fn new(scope: Scope, size: usize, step: String) -> Self {
        Self {
            scope,
            size,
            steps: Vec::new(),
            step,
            index: 1,
        }
    }

    pub fn new_with_steps(scope: Scope, steps: Vec<String>) -> Self {
        Self {
            scope,
            size: steps.len(),
            steps: steps.clone(),
            step: steps.first().map_or(String::new(), |s| s.clone()),
            index: 1,
        }
    }

    pub fn next(&mut self) -> Result<(), Error> {
        if self.index >= self.size {
            return Err(Error::MissingStep(self.scope));
        }

        self.index += 1;
        self.step = self.get_step(self.index).unwrap_or(String::new());
        Ok(())
    }

    pub fn next_with_step(&mut self, step: String) -> Result<(), Error> {
        self.next()?;
        self.step = step;
        Ok(())
    }

    fn get_step(&self, index: usize) -> Option<String> {
        self.steps.get(index - 1).map(|s| s.clone())
    }
}
