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

use agama_utils::api;
use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage: Option<Box<RawValue>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legacy_autoyast_storage: Option<Box<RawValue>>,
}

impl Config {
    pub fn is_some(&self) -> bool {
        self.storage.is_some() || self.legacy_autoyast_storage.is_some()
    }
}

impl TryFrom<&api::Config> for Config {
    type Error = ();

    fn try_from(config: &api::Config) -> Result<Self, Self::Error> {
        if config.storage.is_none() && config.legacy_autoyast_storage.is_none() {
            Err(())
        } else {
            Ok(Config {
                storage: config.storage.clone(),
                legacy_autoyast_storage: config.legacy_autoyast_storage.clone(),
            })
        }
    }
}
