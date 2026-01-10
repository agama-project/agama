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
//! Representation of the software settings

use merge::Merge;
use serde::{Deserialize, Serialize};
use serde_with::skip_serializing_none;
use std::collections::HashMap;
use url::Url;

/// User configuration for the localization of the target system.
///
/// This configuration is provided by the user, so all the values are optional.
#[skip_serializing_none]
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Merge, utoipa::ToSchema)]
#[schema(as = software::UserConfig)]
#[serde(rename_all = "camelCase")]
#[merge(strategy = merge::option::recurse)]
pub struct Config {
    /// Product related configuration
    pub product: Option<ProductConfig>,
    /// Software related configuration
    pub software: Option<SoftwareConfig>,
}

/// Addon settings for registration
#[skip_serializing_none]
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddonConfig {
    pub id: String,
    /// Optional version of the addon, if not specified the version is found
    /// from the available addons
    pub version: Option<String>,
    /// Free extensions do not require a registration code
    pub registration_code: Option<String>,
}

/// Software settings for installation
#[skip_serializing_none]
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Merge, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
#[merge(strategy = merge::option::overwrite_none)]
pub struct ProductConfig {
    /// ID of the product to install (e.g., "ALP", "Tumbleweed", etc.)
    pub id: Option<String>,
    pub registration_code: Option<String>,
    pub registration_email: Option<String>,
    pub registration_url: Option<Url>,
    pub addons: Option<Vec<AddonConfig>>,
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
#[skip_serializing_none]
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Merge, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
#[merge(strategy = merge::option::overwrite_none)]
pub struct SoftwareConfig {
    /// List of user selected patterns to install.
    pub patterns: Option<PatternsConfig>,
    /// List of user selected packages to install.
    pub packages: Option<Vec<String>>,
    /// List of user specified repositories to use on top of default ones.
    pub extra_repositories: Option<Vec<RepositoryConfig>>,
    /// Flag indicating if only hard requirements should be used by solver.
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

#[skip_serializing_none]
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
pub struct PatternsMap {
    pub add: Option<Vec<String>>,
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

/// Parameters for creating new a repository
#[skip_serializing_none]
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryConfig {
    /// repository alias. Has to be unique
    pub alias: String,
    /// repository name, if not specified the alias is used
    pub name: Option<String>,
    /// Repository url (raw format without expanded variables)
    pub url: String,
    /// product directory (currently not used, valid only for multiproduct DVDs)
    pub product_dir: Option<String>,
    /// Whether the repository is enabled, if missing the repository is enabled
    pub enabled: Option<bool>,
    /// Repository priority, lower number means higher priority, the default priority is 99
    pub priority: Option<i32>,
    /// Whenever repository can be unsigned. Default is false
    pub allow_unsigned: Option<bool>,
    /// List of fingerprints for GPG keys used for repository signing. If specified,
    /// the new list of fingerprints overrides the existing ones instead of merging
    /// with them. By default empty.
    pub gpg_fingerprints: Option<Vec<String>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_merge_config() {
        // The `updated` config that will be merged into
        let mut updated = Config {
            product: Some(ProductConfig {
                id: Some("product1".to_string()),
                registration_code: Some("reg1".to_string()),
                registration_email: None,
                registration_url: None,
                addons: Some(vec![AddonConfig {
                    id: "addon1".to_string(),
                    version: Some("1.0".to_string()),
                    registration_code: Some("addon_reg1".to_string()),
                }]),
            }),
            software: Some(SoftwareConfig {
                patterns: Some(PatternsConfig::PatternsList(vec!["pattern1".to_string()])),
                packages: Some(vec!["package1".to_string()]),
                extra_repositories: Some(vec![RepositoryConfig {
                    alias: "repo1".to_string(),
                    name: Some("Repo 1".to_string()),
                    url: "http://repo1.com".to_string(),
                    product_dir: None,
                    enabled: Some(true),
                    priority: Some(100),
                    allow_unsigned: None,
                    gpg_fingerprints: Some(vec!["fp1".to_string()]),
                }]),
                only_required: Some(false),
            }),
        };

        // The `original` config to merge from
        let original = Config {
            product: Some(ProductConfig {
                id: Some("product2".to_string()),
                registration_code: None,
                registration_email: Some("email2@a.com".to_string()),
                registration_url: None,
                addons: Some(vec![AddonConfig {
                    id: "addon2".to_string(),
                    version: None,
                    registration_code: None,
                }]),
            }),
            software: Some(SoftwareConfig {
                patterns: Some(PatternsConfig::PatternsList(vec!["pattern2".to_string()])),
                packages: None,
                extra_repositories: Some(vec![RepositoryConfig {
                    alias: "repo2".to_string(),
                    name: None,
                    url: "http://repo2.com".to_string(),
                    product_dir: None,
                    enabled: None,
                    priority: None,
                    allow_unsigned: Some(true),
                    gpg_fingerprints: Some(vec!["fp2".to_string(), "fp3".to_string()]),
                }]),
                only_required: Some(true),
            }),
        };

        // Perform the merge
        updated.merge(original);

        let expected_product = ProductConfig {
            id: Some("product1".to_string()),
            registration_code: Some("reg1".to_string()),
            registration_email: Some("email2@a.com".to_string()),
            registration_url: None,
            addons: Some(vec![AddonConfig {
                id: "addon1".to_string(),
                version: Some("1.0".to_string()),
                registration_code: Some("addon_reg1".to_string()),
            }]),
        };

        let expected_software = SoftwareConfig {
            patterns: Some(PatternsConfig::PatternsList(vec!["pattern1".to_string()])),
            packages: Some(vec!["package1".to_string()]),
            extra_repositories: Some(vec![RepositoryConfig {
                alias: "repo1".to_string(),
                name: Some("Repo 1".to_string()),
                url: "http://repo1.com".to_string(),
                product_dir: None,
                enabled: Some(true),
                priority: Some(100),
                allow_unsigned: None,
                gpg_fingerprints: Some(vec!["fp1".to_string()]),
            }]),
            only_required: Some(false),
        };

        assert_eq!(updated.product, Some(expected_product));
        assert_eq!(updated.software, Some(expected_software));
    }

    #[test]
    fn test_merge_config_with_nones() {
        // Case 1: `updated` has Some, `original` has None
        let mut updated = Config {
            product: Some(ProductConfig {
                id: Some("p1".to_string()),
                ..Default::default()
            }),
            software: None,
        };
        let original = Config {
            product: None,
            software: Some(SoftwareConfig {
                packages: Some(vec!["pkg1".to_string()]),
                ..Default::default()
            }),
        };

        let updated_clone = updated.clone();
        let original_clone = original.clone();
        updated.merge(original);

        assert_eq!(updated.product, updated_clone.product);
        assert_eq!(updated.software, original_clone.software);

        // Case 2: `updated` has None, `original` has Some
        let mut updated = Config {
            product: None,
            software: Some(SoftwareConfig {
                packages: Some(vec!["pkg1".to_string()]),
                ..Default::default()
            }),
        };
        let original = Config {
            product: Some(ProductConfig {
                id: Some("p1".to_string()),
                ..Default::default()
            }),
            software: None,
        };

        let updated_clone = updated.clone();
        let original_clone = original.clone();
        updated.merge(original);

        assert_eq!(updated.product, original_clone.product);
        assert_eq!(updated.software, updated_clone.software);
    }
}
