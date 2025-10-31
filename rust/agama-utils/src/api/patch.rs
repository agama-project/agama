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

use crate::api::config::Config;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Json(#[from] serde_json::Error),
}

/// Patch for the config.
#[derive(Deserialize, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Patch {
    /// Update for the current config.
    pub update: Option<Value>,
}

impl Patch {
    pub fn with_update(config: &Config) -> Result<Self, Error> {
        Ok(Self {
            update: Some(serde_json::to_value(config)?),
        })
    }
}
