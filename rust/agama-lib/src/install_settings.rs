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

//! Configuration settings handling
//!
//! This module implements the mechanisms to load and store the installation settings.
use crate::context::InstallationContext;
use crate::hostname::model::HostnameSettings;
use crate::storage::settings::zfcp::ZFCPConfig;
use crate::{network::NetworkSettings, storage::settings::dasd::DASDConfig};
use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;
use std::default::Default;
use std::path::Path;

#[derive(Debug, thiserror::Error)]
pub enum InstallSettingsError {
    #[error("I/O error: {0}")]
    InputOuputError(#[from] std::io::Error),
    #[error("Could not parse the settings: {0}")]
    ParseError(#[from] serde_json::Error),
}

/// Installation settings
///
/// This struct represents installation settings. It serves as an entry point and it is composed of
/// other structs which hold the settings for each area ("software", etc.).
#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct InstallSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dasd: Option<DASDConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<HostnameSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub iscsi: Option<Box<RawValue>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub storage: Option<Box<RawValue>>,
    #[serde(rename = "legacyAutoyastStorage")]
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub storage_autoyast: Option<Box<RawValue>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network: Option<NetworkSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub zfcp: Option<ZFCPConfig>,
}

impl InstallSettings {
    /// Returns install settings from a file.
    pub fn from_file<P: AsRef<Path>>(
        path: P,
        context: &InstallationContext,
    ) -> Result<Self, InstallSettingsError> {
        let content = std::fs::read_to_string(path)?;
        Ok(Self::from_json(&content, context)?)
    }

    /// Reads install settings from a JSON string,
    /// also resolving relative URLs in the contents.
    ///
    /// - `json`: JSON string.
    /// - `context`: Store context.
    pub fn from_json(
        json: &str,
        _context: &InstallationContext,
    ) -> Result<Self, InstallSettingsError> {
        let settings: InstallSettings = serde_json::from_str(json)?;
        Ok(settings)
    }
}
