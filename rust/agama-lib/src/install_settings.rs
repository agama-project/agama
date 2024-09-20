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

//! Configuration settings handling
//!
//! This module implements the mechanisms to load and store the installation settings.
use crate::{
    localization::LocalizationSettings, network::NetworkSettings, product::ProductSettings,
    software::SoftwareSettings, users::UserSettings,
};
use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;
use std::default::Default;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

/// Installation settings
///
/// This struct represents installation settings. It serves as an entry point and it is composed of
/// other structs which hold the settings for each area ("users", "software", etc.).
#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallSettings {
    #[serde(default, flatten)]
    pub user: Option<UserSettings>,
    #[serde(default)]
    pub software: Option<SoftwareSettings>,
    #[serde(default)]
    pub product: Option<ProductSettings>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage: Option<Box<RawValue>>,
    #[serde(default, rename = "legacyAutoyastStorage")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage_autoyast: Option<Box<RawValue>>,
    #[serde(default)]
    pub network: Option<NetworkSettings>,
    #[serde(default)]
    pub localization: Option<LocalizationSettings>,
}

impl InstallSettings {
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self, std::io::Error> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);
        let data = serde_json::from_reader(reader)?;
        Ok(data)
    }
}
