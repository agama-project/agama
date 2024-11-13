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

//! Representation of the storage settings

use crate::install_settings::InstallSettings;
use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;

/// Storage settings for installation
#[derive(Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StorageSettings {
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = String)]
    pub storage: Option<Box<RawValue>>,
    #[serde(default, rename = "legacyAutoyastStorage")]
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = String)]
    pub storage_autoyast: Option<Box<RawValue>>,
}

impl From<&InstallSettings> for StorageSettings {
    fn from(install_settings: &InstallSettings) -> Self {
        StorageSettings {
            storage: install_settings.storage.clone(),
            storage_autoyast: install_settings.storage_autoyast.clone(),
        }
    }
}
