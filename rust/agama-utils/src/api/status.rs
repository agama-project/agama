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

use crate::api::progress::Progress;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

// Information about the status of the installation.
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    /// Stage of the installation
    pub stage: Stage,
    /// Active progresses
    pub progresses: Vec<Progress>,
}

/// Represents the current state of the installation process.
#[derive(
    Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, strum::Display, JsonSchema,
)]
#[serde(rename_all = "camelCase")]
pub enum Stage {
    #[default]
    /// Configuring the installation
    Configuring,
    /// Installing the system
    Installing,
    /// Installation finished
    Finished,
    /// Installation failed
    Failed,
}

impl Stage {
    pub fn is_last(&self) -> bool {
        matches!(self, Stage::Finished | Stage::Failed)
    }
}
