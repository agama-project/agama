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

use agama_utils::api::software::{
    Config, PatternsConfig, ProductConfig, RepositoryParams, SoftwareConfig,
};
use serde::Serialize;

#[derive(Clone, PartialEq, Serialize)]
pub struct ExtendedConfig {
    /// Product related configuration
    #[serde(skip_serializing_if = "ProductConfig::is_empty")]
    pub product: ProductConfig,
    /// Software related configuration
    pub software: ExtendedSoftwareSettings,
}

/// Software settings for installation
#[derive(Clone, Debug, Serialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ExtendedSoftwareSettings {
    /// List of user selected patterns to install.
    pub patterns: PatternsConfig,
    /// List of user selected packages to install.
    pub packages: Vec<String>,
    /// List of user specified repositories to use on top of default ones.
    pub extra_repositories: Vec<RepositoryParams>,
    /// Flag indicating if only hard requirements should be used by solver.
    pub only_required: bool,
}

impl ExtendedSoftwareSettings {
    pub fn merge(&mut self, config: &SoftwareConfig) -> &Self {
        if let Some(patterns) = &config.patterns {
            self.patterns = patterns.clone();
        }

        if let Some(packages) = &config.packages {
            self.packages = packages.clone();
        }

        if let Some(extra_repositories) = &config.extra_repositories {
            self.extra_repositories = extra_repositories.clone();
        }

        if let Some(only_required) = config.only_required {
            self.only_required = only_required;
        }

        self
    }
}

impl Default for ExtendedSoftwareSettings {
    fn default() -> Self {
        Self {
            patterns: PatternsConfig::default(),
            packages: Default::default(),
            extra_repositories: Default::default(),
            only_required: false,
        }
    }
}

impl ExtendedConfig {
    pub fn merge(&mut self, config: &Config) -> &Self {
        if let Some(product_settings) = &config.product {
            self.product = product_settings.clone();
        }

        if let Some(software) = &config.software {
            self.software.merge(software);
        }

        self
    }
}
