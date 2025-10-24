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
use crate::bootloader::model::BootloaderSettings;
use crate::context::InstallationContext;
use crate::file_source::{FileSourceError, WithFileSource};
use crate::files::model::UserFile;
use crate::hostname::model::HostnameSettings;
use crate::questions::config::QuestionsConfig;
use crate::security::settings::SecuritySettings;
use crate::storage::settings::zfcp::ZFCPConfig;
use crate::{
    localization::LocalizationSettings, network::NetworkSettings, product::ProductSettings,
    scripts::ScriptsConfig, software::SoftwareSettings, storage::settings::dasd::DASDConfig,
    users::UserSettings,
};
use fluent_uri::Uri;
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
    #[error(transparent)]
    FileSourceError(#[from] FileSourceError),
}

/// Installation settings
///
/// This struct represents installation settings. It serves as an entry point and it is composed of
/// other structs which hold the settings for each area ("users", "software", etc.).
#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bootloader: Option<BootloaderSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dasd: Option<DASDConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub files: Option<Vec<UserFile>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<HostnameSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iscsi: Option<Box<RawValue>>,
    #[serde(flatten)]
    pub user: Option<UserSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub security: Option<SecuritySettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub software: Option<SoftwareSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub product: Option<ProductSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage: Option<Box<RawValue>>,
    #[serde(rename = "legacyAutoyastStorage")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage_autoyast: Option<Box<RawValue>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network: Option<NetworkSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub localization: Option<LocalizationSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scripts: Option<ScriptsConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub zfcp: Option<ZFCPConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub questions: Option<QuestionsConfig>,
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
        context: &InstallationContext,
    ) -> Result<Self, InstallSettingsError> {
        let mut settings: InstallSettings = serde_json::from_str(json)?;
        settings.resolve_urls(&context.source).unwrap();
        Ok(settings)
    }

    /// Resolves URLs in the settings.
    ///
    // Ideally, the context could be ready when deserializing the settings so
    // the URLs can be resolved. One possible solution would be to use
    // [DeserializeSeed](https://docs.rs/serde/1.0.219/serde/de/trait.DeserializeSeed.html).
    fn resolve_urls(&mut self, source_uri: &Uri<String>) -> Result<(), InstallSettingsError> {
        if let Some(ref mut scripts) = self.scripts {
            scripts.resolve_urls(source_uri)?;
        }

        if let Some(ref mut files) = self.files {
            for file in files.iter_mut() {
                file.resolve_url(source_uri)?;
            }
        }
        Ok(())
    }
}
