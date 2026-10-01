// Copyright (c) [2025-2026] SUSE LLC
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

use crate::api::{
    access, bootloader,
    files::{self, FileSourceError},
    hostname, iscsi, l10n, network, ntp, proxy, question, s390, security,
    software::{self, ProductConfig},
    storage, users,
};
use fluent_uri::Uri;
use merge::Merge;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_with::skip_serializing_none;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Failed to resolve relative URLs")]
    ResolveURL(#[from] FileSourceError),
    #[error("Failed to parse the configuration")]
    JSON(#[from] serde_json::Error),
}

/// Profile definition for automated installation.
#[skip_serializing_none]
#[derive(Clone, Debug, Default, Deserialize, Serialize, Merge, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(deny_unknown_fields, title = "Profile")]
#[merge(strategy = merge::option::recurse)]
pub struct Config {
    /// Bootloader configuration.
    pub bootloader: Option<bootloader::Config>,
    /// Hostname configuration.
    pub hostname: Option<hostname::Config>,
    /// Localization configuration (keyboard, language, timezone).
    #[serde(alias = "localization")]
    pub l10n: Option<l10n::Config>,
    /// Network proxy configuration.
    pub proxy: Option<proxy::Config>,
    /// Security configuration (e.g. SSL certificate fingerprints).
    pub security: Option<security::Config>,
    /// Software and product configuration.
    #[serde(flatten)]
    pub software: Option<software::Config>,
    /// Network configuration (interfaces, connections, state).
    pub network: Option<network::Config>,
    /// NTP time synchronization configuration.
    pub ntp: Option<ntp::Config>,
    /// Automated question answering rules and policy.
    pub questions: Option<question::Config>,
    /// Remote access configuration (SSH, Web Console).
    pub access: Option<access::Config>,
    /// Storage configuration (drives, partitions, LVM, encryption).
    #[serde(flatten)]
    pub storage: Option<storage::Config>,
    /// iSCSI initiator and target configuration.
    pub iscsi: Option<iscsi::Config>,
    /// User-defined files and scripts.
    #[serde(flatten)]
    pub files: Option<files::Config>,
    /// User and root accounts configuration.
    #[serde(flatten)]
    pub users: Option<users::Config>,
    /// s390 architecture configuration (DASD and zFCP devices).
    #[serde(flatten)]
    pub s390: Option<s390::Config>,
}

impl Config {
    /// Reads install settings from a JSON string, resolving relative URLs in the contents.
    ///
    /// - `json`: JSON string.
    /// - `base_uri`: base URI.
    pub fn from_json(json: &str, base_uri: &Uri<String>) -> Result<Self, Error> {
        let mut config: Self = serde_json::from_str(json)?;
        if let Some(files) = &mut config.files {
            files.resolve_urls(base_uri)?;
        }
        Ok(config)
    }

    /// Creates a default configuration for the given product.
    pub fn with_product(product_id: String) -> Self {
        Self {
            software: Some(software::Config {
                product: Some(ProductConfig {
                    id: Some(product_id),
                    ..Default::default()
                }),
                ..Default::default()
            }),
            ..Default::default()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_deserialize_config_full() {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let full_example = manifest_dir.join("../share/examples/config_full.json");
        let contents = std::fs::read_to_string(&full_example).expect("read config_full.json");
        let base_uri = Uri::try_from("file:///".to_string()).unwrap();
        let config = Config::from_json(&contents, &base_uri).expect("deserialize Config");

        assert!(config.bootloader.is_some());
        assert!(config.hostname.is_some());
        assert!(config.l10n.is_some());
        assert!(config.proxy.is_some());
        assert!(config.security.is_some());
        assert!(config.software.is_some());
        assert!(config.network.is_some());
        assert!(config.ntp.is_some());
        assert!(config.questions.is_some());
        assert!(config.access.is_some());
        assert!(config.storage.is_some());
        assert!(config.iscsi.is_some());
        assert!(config.files.is_some());
        assert!(config.users.is_some());
        assert!(config.s390.is_some());
    }
}
