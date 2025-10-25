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

//! Representation of the software settings

use std::collections::HashMap;

use crate::model::packages::RepositoryParams;
use serde::{Deserialize, Serialize};

/// User configuration for the localization of the target system.
///
/// This configuration is provided by the user, so all the values are optional.
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[schema(as = software::UserConfig)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    /// Product related configuration
    #[serde(skip_serializing_if = "Option::is_none")]
    pub product: Option<ProductConfig>,
    /// Software related configuration
    #[serde(skip_serializing_if = "Option::is_none")]
    pub software: Option<SoftwareConfig>,
}

/// Addon settings for registration
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddonSettings {
    pub id: String,
    /// Optional version of the addon, if not specified the version is found
    /// from the available addons
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    /// Free extensions do not require a registration code
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registration_code: Option<String>,
}

/// Software settings for installation
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProductConfig {
    /// ID of the product to install (e.g., "ALP", "Tumbleweed", etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registration_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registration_email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registration_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub addons: Option<Vec<AddonSettings>>,
}

impl ProductConfig {
    pub fn is_empty(&self) -> bool {
        self.id.is_none()
            && self.registration_code.is_none()
            && self.registration_email.is_none()
            && self.registration_url.is_none()
            && self.addons.is_none()
    }
}

/// Software settings for installation
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SoftwareConfig {
    /// List of user selected patterns to install.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub patterns: Option<PatternsConfig>,
    /// List of user selected packages to install.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub packages: Option<Vec<String>>,
    /// List of user specified repositories to use on top of default ones.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_repositories: Option<Vec<RepositoryParams>>,
    /// Flag indicating if only hard requirements should be used by solver.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub only_required: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(untagged)]
pub enum PatternsConfig {
    PatternsList(Vec<String>),
    PatternsMap(PatternsMap),
}

impl Default for PatternsConfig {
    fn default() -> Self {
        PatternsConfig::PatternsMap(PatternsMap {
            add: None,
            remove: None,
        })
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
pub struct PatternsMap {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub add: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remove: Option<Vec<String>>,
}

impl From<Vec<String>> for PatternsConfig {
    fn from(list: Vec<String>) -> Self {
        Self::PatternsList(list)
    }
}

impl From<HashMap<String, Vec<String>>> for PatternsConfig {
    fn from(map: HashMap<String, Vec<String>>) -> Self {
        let add = if let Some(to_add) = map.get("add") {
            Some(to_add.to_owned())
        } else {
            None
        };

        let remove = if let Some(to_remove) = map.get("remove") {
            Some(to_remove.to_owned())
        } else {
            None
        };

        Self::PatternsMap(PatternsMap { add, remove })
    }
}

impl SoftwareConfig {
    pub fn to_option(self) -> Option<Self> {
        if self.patterns.is_none()
            && self.packages.is_none()
            && self.extra_repositories.is_none()
            && self.only_required.is_none()
        {
            None
        } else {
            Some(self)
        }
    }
}
