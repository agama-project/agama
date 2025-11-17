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

//! Implements a products registry.
//!
//! The products registry contains the specification of every known product.
//! It reads the list of products from the `products.d` directory (usually,
//! `/usr/share/agama/products.d`).

use crate::api::manager::Product;
use serde::{Deserialize, Deserializer, Serialize};
use serde_with::{formats::CommaSeparator, serde_as, StringWithSeparator};
use std::path::{Path, PathBuf};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Could not read the products registry: {0}")]
    IO(#[from] std::io::Error),
    #[error("Could not deserialize a product specification: {0}")]
    Deserialize(#[from] serde_yaml::Error),
}

/// Products registry.
///
/// It holds the products specifications. At runtime it is possible to change the `products.d`
/// location by setting the `AGAMA_SHARE_DIR` environment variable. This variable points to
/// the parent of `products.d`.
///
/// Dynamic behavior, like filtering by architecture, is not supported yet.
#[derive(Clone, Debug, Deserialize)]
pub struct Registry {
    path: std::path::PathBuf,
    products: Vec<ProductSpec>,
}

impl Registry {
    pub fn new<P: AsRef<Path>>(path: P) -> Self {
        Self {
            path: path.as_ref().to_owned(),
            products: vec![],
        }
    }

    /// Creates a registry loading the products from its location.
    pub fn read(&mut self) -> Result<(), Error> {
        let entries = std::fs::read_dir(&self.path)?;
        self.products.clear();

        for entry in entries {
            let entry = entry?;
            let path = entry.path();

            let Some(ext) = path.extension() else {
                continue;
            };

            if path.is_file() && (ext == "yaml" || ext == "yml") {
                let product = ProductSpec::load_from(path)?;
                self.products.push(product);
            }
        }

        Ok(())
    }

    /// Returns the default product.
    ///
    /// If there is a single product, it is considered the "default product".
    pub fn default_product(&self) -> Option<&ProductSpec> {
        if self.products.len() == 1 {
            self.products.first()
        } else {
            None
        }
    }

    /// Finds a product by its ID.
    ///
    /// * `id`: product ID.
    pub fn find(&self, id: &str) -> Option<&ProductSpec> {
        self.products.iter().find(|p| p.id == id)
    }

    /// Returns a vector with the licenses from the repository.
    pub fn products(&self) -> Vec<Product> {
        self.products
            .iter()
            .map(|p| Product {
                id: p.id.clone(),
                name: p.name.clone(),
                description: p.description.clone(),
                icon: p.icon.clone(),
                registration: p.registration,
                license: p.license.clone(),
            })
            .collect()
    }
}

impl Default for Registry {
    fn default() -> Self {
        let share_dir = std::env::var("AGAMA_SHARE_DIR").unwrap_or("/usr/share/agama".to_string());
        let products_dir = PathBuf::from(share_dir).join("products.d");
        Self::new(products_dir)
    }
}

// TODO: ideally, part of this code could be auto-generated from a JSON schema definition.
/// Product specification (e.g., Tumbleweed).
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ProductSpec {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    #[serde(default)]
    pub registration: bool,
    pub version: Option<String>,
    pub license: Option<String>,
    pub software: SoftwareSpec,
    pub storage: StorageSpec,
}

impl ProductSpec {
    pub fn load_from<P: AsRef<Path>>(path: P) -> Result<Self, Error> {
        let contents = std::fs::read_to_string(path)?;
        let product: ProductSpec = serde_yaml::from_str(&contents)?;
        Ok(product)
    }
}

fn parse_optional<'de, D>(d: D) -> Result<Vec<String>, D::Error>
where
    D: Deserializer<'de>,
{
    Deserialize::deserialize(d).map(|x: Option<_>| x.unwrap_or_default())
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct SoftwareSpec {
    installation_repositories: Vec<RepositorySpec>,
    #[serde(default)]
    pub installation_labels: Vec<LabelSpec>,
    #[serde(default)]
    pub user_patterns: Vec<UserPattern>,
    #[serde(default)]
    pub mandatory_patterns: Vec<String>,
    #[serde(default)]
    pub mandatory_packages: Vec<String>,
    #[serde(deserialize_with = "parse_optional")]
    pub optional_patterns: Vec<String>,
    #[serde(deserialize_with = "parse_optional")]
    pub optional_packages: Vec<String>,
    pub base_product: String,
}

impl SoftwareSpec {
    // NOTE: perhaps implementing our own iterator would be more efficient.
    pub fn repositories(&self) -> Vec<&RepositorySpec> {
        let arch = std::env::consts::ARCH.to_string();
        self.installation_repositories
            .iter()
            .filter(|r| r.archs.is_empty() || r.archs.contains(&arch))
            .collect()
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(untagged)]
pub enum UserPattern {
    Plain(String),
    Preselected(PreselectedPattern),
}

impl UserPattern {
    pub fn name(&self) -> &str {
        match self {
            UserPattern::Plain(name) => name,
            UserPattern::Preselected(pattern) => &pattern.name,
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct PreselectedPattern {
    pub name: String,
    pub selected: bool,
}

#[serde_as]
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct RepositorySpec {
    pub url: String,
    #[serde(default)]
    #[serde_as(as = "StringWithSeparator::<CommaSeparator, String>")]
    pub archs: Vec<String>,
}

#[serde_as]
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct LabelSpec {
    pub label: String,
    #[serde(default)]
    #[serde_as(as = "StringWithSeparator::<CommaSeparator, String>")]
    pub archs: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct StorageSpec {
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    boot_strategy: Option<String>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    space_policy: Option<String>,
    #[serde(default)]
    volumes: Vec<String>,
    #[serde(default)]
    pub volume_templates: Vec<VolumeSpec>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct VolumeSpec {
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    mount_path: Option<String>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    filesystem: Option<String>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    btrfs: Option<BtrfsSpec>,
    size: SizeSpec,
    outline: VolumeOutlineSpec,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct BtrfsSpec {
    snapshots: bool,
    read_only: bool,
    default_subvolume: String,
    #[serde(default)]
    subvolumes: Vec<BtrfsSubvolSpec>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct BtrfsSubvolSpec {
    path: String,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    copy_on_write: Option<bool>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    archs: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct SizeSpec {
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    auto: Option<bool>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    min: Option<String>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    max: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct VolumeOutlineSpec {
    required: bool,
    filesystems: Vec<String>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    auto_size: Option<AutoSizeSpec>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    snapshots_configurable: Option<bool>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct AutoSizeSpec {
    base_min: String,
    base_max: String,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    snapshots_increment: Option<String>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    max_fallback_for: Option<Vec<String>>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    min_fallback_for: Option<Vec<String>>,
}

#[cfg(test)]
mod test {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_load_registry() {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share/products.d");
        let mut registry = Registry::new(path.as_path());
        registry.read().unwrap();
        // ensuring that we can load all products from tests
        assert_eq!(registry.products.len(), 8);
    }

    #[test]
    fn test_find_product() {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share/products.d");
        let mut registry = Registry::new(path.as_path());
        registry.read().unwrap();
        let tw = registry.find("Tumbleweed").unwrap();
        assert_eq!(tw.id, "Tumbleweed");
        assert_eq!(tw.name, "openSUSE Tumbleweed");
        assert_eq!(tw.icon, "Tumbleweed.svg");
        assert_eq!(tw.registration, false);
        assert_eq!(tw.version, None);
        let software = &tw.software;
        assert_eq!(software.installation_repositories.len(), 12);
        assert_eq!(software.installation_labels.len(), 4);
        assert_eq!(software.base_product, "openSUSE");
        assert_eq!(software.user_patterns.len(), 11);

        let preselected = software
            .user_patterns
            .iter()
            .find(|p| matches!(p, UserPattern::Preselected(_)));
        let expected_pattern = PreselectedPattern {
            name: "selinux".to_string(),
            selected: true,
        };
        assert_eq!(
            preselected,
            Some(&UserPattern::Preselected(expected_pattern))
        );

        let missing = registry.find("Missing");
        assert!(missing.is_none());
    }

    #[test]
    fn test_default_product() {
        let path =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share/products.d-single");
        let mut registry = Registry::new(path.as_path());
        registry.read().unwrap();
        assert!(registry.default_product().is_some());

        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share/products.d");
        let mut registry = Registry::new(path.as_path());
        registry.read().unwrap();
        assert!(registry.default_product().is_none());
    }
}
