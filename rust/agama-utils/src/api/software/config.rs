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
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_with::skip_serializing_none;
use std::collections::HashMap;
use url::Url;

/// User configuration for the localization of the target system.
///
/// This configuration is provided by the user, so all the values are optional.
#[skip_serializing_none]
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Merge, JsonSchema)]
#[schemars(rename = "software.UserConfig")]
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
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(title = "List of add-ons to activate")]
pub struct AddonConfig {
    /// ID of the addon.
    #[schemars(example = &"sle-ha")]
    pub id: String,
    /// Optional version of the addon. It is mandatory if there are multiple available versions.
    /// If not specified, the version is found from the available addons.
    pub version: Option<String>,
    /// Registration code for the addon. Free extensions do not require a registration code.
    pub registration_code: Option<String>,
}

/// Software settings for installation
#[skip_serializing_none]
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Merge, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(deny_unknown_fields, title = "Product to install")]
#[merge(strategy = merge::option::overwrite_none)]
pub struct ProductConfig {
    /// ID of the product to install (e.g., "SLES", "Tumbleweed", etc.).
    #[schemars(
        example = &"Tumbleweed",
        example = &"MicroOS",
        example = &"Slowroll",
        example = &"openSUSE_Leap",
        example = &"SLES",
        example = &"Kalpa"
    )]
    pub id: Option<String>,
    /// The mode from the products.d/foo.yaml file.
    pub mode: Option<String>,
    /// Product registration code.
    pub registration_code: Option<String>,
    /// Product registration email.
    pub registration_email: Option<String>,
    /// URL of the registration server.
    pub registration_url: Option<Url>,
    /// List of product addons to register and install.
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
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Merge, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[merge(strategy = merge::option::overwrite_none)]
pub struct SoftwareConfig {
    /// List of user selected patterns to install.
    #[schemars(example = &["minimal_base"])]
    pub patterns: Option<PatternsConfig>,
    /// List of user selected packages to install.
    #[schemars(example = &["vim"])]
    pub packages: Option<Vec<String>>,
    /// List of user specified repositories to use on top of default ones.
    pub extra_repositories: Option<Vec<RepositoryConfig>>,
    /// Flag indicating if only hard requirements should be used by solver.
    pub only_required: Option<bool>,
    /// Image configuration for image-based deployment.
    pub image: Option<ImageConfig>,
}

/// Supported image types for image-based deployment.
#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum ImageType {
    /// Tarball archive containing the root filesystem.
    #[default]
    Tarball,
    /// Raw disk or filesystem image.
    Raw,
    /// OCI container image.
    Oci,
}

/// Image-based deployment configuration.
#[skip_serializing_none]
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(title = "Image configuration")]
pub struct ImageConfig {
    /// Path to the image file, remote URL, or container image reference (e.g. "registry.mycompany.com/myorg/gold:latest").
    pub path: String,
    /// Type of the image (tarball, raw, oci).
    #[serde(rename = "type")]
    pub image_type: ImageType,
    /// Whether to ignore SSL/TLS certificate verification when downloading or pulling images.
    pub insecure: Option<bool>,
    /// Flag indicating if recommended hardware packages should be installed after deploying the image.
    pub recommended_hardware_packages: Option<bool>,
    /// Flag indicating if packages required by Agama (kernel, storage, bootloader) should be installed via zypper.
    pub install_required_packages: Option<bool>,
}

impl merge::Merge for ImageConfig {
    fn merge(&mut self, other: Self) {
        if !other.path.is_empty() {
            self.path = other.path;
        }
        self.image_type = other.image_type;
        if other.insecure.is_some() {
            self.insecure = other.insecure;
        }
        if other.recommended_hardware_packages.is_some() {
            self.recommended_hardware_packages = other.recommended_hardware_packages;
        }
        if other.install_required_packages.is_some() {
            self.install_required_packages = other.install_required_packages;
        }
    }
}

impl ImageConfig {
    pub fn new(path: impl Into<String>, image_type: ImageType) -> Self {
        Self {
            path: path.into(),
            image_type,
            insecure: None,
            recommended_hardware_packages: None,
            install_required_packages: None,
        }
    }

    pub fn with_insecure(mut self, insecure: bool) -> Self {
        self.insecure = Some(insecure);
        self
    }

    pub fn with_recommended_hardware_packages(mut self, enabled: bool) -> Self {
        self.recommended_hardware_packages = Some(enabled);
        self
    }

    pub fn with_install_required_packages(mut self, enabled: bool) -> Self {
        self.install_required_packages = Some(enabled);
        self
    }

    /// Whether recommended hardware packages should be installed.
    pub fn install_hardware_packages(&self) -> bool {
        self.recommended_hardware_packages.unwrap_or(false)
    }

    /// Whether packages required by Agama (kernel, storage, bootloader) should be installed.
    pub fn install_required_packages(&self) -> bool {
        self.install_required_packages.unwrap_or(false)
    }

    /// Whether to ignore SSL/TLS certificate verification.
    pub fn insecure(&self) -> bool {
        self.insecure.unwrap_or(false)
    }

    /// Returns true if the path is a URL (e.g. http://, https://, ftp://, file://).
    pub fn is_url(&self) -> bool {
        self.path.contains("://") && Url::parse(&self.path).is_ok()
    }
}

/// List or modification map of user-selected patterns to install.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(untagged)]
pub enum PatternsConfig {
    /// List of user-selected patterns to install.
    PatternsList(Vec<String>),
    /// Modifications for the list of user-selected patterns to install.
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

/// Modifications for the list of user-selected patterns to install
#[skip_serializing_none]
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, JsonSchema)]
pub struct PatternsMap {
    /// List of user-selected patterns to add to the list.
    pub add: Option<Vec<String>>,
    /// List of user-selected patterns to remove from the list.
    pub remove: Option<Vec<String>>,
}

impl From<Vec<String>> for PatternsConfig {
    fn from(list: Vec<String>) -> Self {
        Self::PatternsList(list)
    }
}

impl From<HashMap<String, Vec<String>>> for PatternsConfig {
    fn from(map: HashMap<String, Vec<String>>) -> Self {
        let add = map.get("add").map(|to_add| to_add.to_owned());

        let remove = map.get("remove").map(|to_remove| to_remove.to_owned());

        Self::PatternsMap(PatternsMap { add, remove })
    }
}

impl SoftwareConfig {
    pub fn to_option(self) -> Option<Self> {
        if self.patterns.is_none()
            && self.packages.is_none()
            && self.extra_repositories.is_none()
            && self.only_required.is_none()
            && self.image.is_none()
        {
            None
        } else {
            Some(self)
        }
    }
}

/// Parameters for creating new a repository
#[skip_serializing_none]
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, JsonSchema)]
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
                mode: None,
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
                image: None,
            }),
        };

        // The `original` config to merge from
        let original = Config {
            product: Some(ProductConfig {
                id: Some("product2".to_string()),
                mode: None,
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
                image: None,
            }),
        };

        // Perform the merge
        updated.merge(original);

        let expected_product = ProductConfig {
            id: Some("product1".to_string()),
            mode: None,
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
            image: None,
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

    #[test]
    fn test_image_config_deserialization() {
        let json = r#"{
            "path": "/images/system.tar.xz",
            "type": "tarball",
            "recommendedHardwarePackages": true
        }"#;

        let image_config: ImageConfig = serde_json::from_str(json).unwrap();
        assert_eq!(image_config.path, "/images/system.tar.xz");
        assert_eq!(image_config.image_type, ImageType::Tarball);
        assert_eq!(image_config.recommended_hardware_packages, Some(true));
        assert!(image_config.install_hardware_packages());

        let raw_json = r#"{
            "path": "/images/system.raw",
            "type": "raw"
        }"#;
        let raw_config: ImageConfig = serde_json::from_str(raw_json).unwrap();
        assert_eq!(raw_config.path, "/images/system.raw");
        assert_eq!(raw_config.image_type, ImageType::Raw);
        assert_eq!(raw_config.recommended_hardware_packages, None);
        assert!(!raw_config.install_hardware_packages());

        let oci_json = r#"{
            "path": "registry.opensuse.org/opensuse/tumbleweed:latest",
            "type": "oci",
            "insecure": true,
            "recommendedHardwarePackages": false,
            "installRequiredPackages": true
        }"#;
        let oci_config: ImageConfig = serde_json::from_str(oci_json).unwrap();
        assert_eq!(
            oci_config.path,
            "registry.opensuse.org/opensuse/tumbleweed:latest"
        );
        assert_eq!(oci_config.image_type, ImageType::Oci);
        assert!(oci_config.insecure());
        assert_eq!(oci_config.recommended_hardware_packages, Some(false));
        assert!(!oci_config.install_hardware_packages());
        assert_eq!(oci_config.install_required_packages, Some(true));
        assert!(oci_config.install_required_packages());

        let url_config = ImageConfig::new("https://example.com/image.tar.xz", ImageType::Tarball);
        assert!(url_config.is_url());
    }

    #[test]
    fn test_software_config_with_image_to_option() {
        let config = SoftwareConfig {
            image: Some(ImageConfig::new("/images/image.tar", ImageType::Tarball)),
            ..Default::default()
        };
        assert!(config.to_option().is_some());
    }

    #[test]
    fn test_merge_image_config() {
        let mut updated = SoftwareConfig {
            image: Some(ImageConfig {
                path: "/new/path.tar".to_string(),
                image_type: ImageType::Tarball,
                recommended_hardware_packages: Some(true),
                ..Default::default()
            }),
            ..Default::default()
        };

        let original = SoftwareConfig {
            image: Some(ImageConfig {
                path: "/old/path.tar".to_string(),
                image_type: ImageType::Tarball,
                recommended_hardware_packages: Some(false),
                ..Default::default()
            }),
            ..Default::default()
        };

        updated.merge(original);
        assert_eq!(
            updated.image.as_ref().unwrap().path,
            "/new/path.tar".to_string()
        );
        assert_eq!(
            updated.image.as_ref().unwrap().recommended_hardware_packages,
            Some(true)
        );
    }
}
