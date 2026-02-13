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
//!
//! # Product templates
//!
//! The `products.d` directory contains a set of [product templates](ProductTemplate).
//! Each template is composed of:
//!
//! * Product metadata: id, name, description, etc.
//! * Configuration for storage, software management and security.
//!
//! Additionally, a template can specify a list of product modes. Each mode can overwrite
//! the default configuration for any of the sections. A typical use case is offering
//! "standard" and "immutable" modes.
//!
//! # Product specifications
//!
//! Internally, Agama works with the concept of [product specifications](ProductSpec). A product
//! specification is derived from a template and, optionally, a mode.

use crate::{
    api::{
        l10n::Translations,
        manager::{Product, ProductMode},
    },
    arch::Arch,
};
use merge::Merge;
use serde::{Deserialize, Serialize};
use serde_with::{formats::CommaSeparator, serde_as, StringWithSeparator};
use std::path::{Path, PathBuf};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Could not read the products registry: {0}")]
    IO(#[from] std::io::Error),
    #[error("Could not deserialize a product specification: {0}")]
    Deserialize(#[from] serde_yaml::Error),
    #[error("Unknown product '{0}'")]
    UnknownProduct(String),
    #[error("Invalid mode '{1}' for product '{0}'")]
    UnknownMode(String, String),
}

/// Products registry.
///
/// It holds the products definitions. At runtime it is possible to change the `products.d`
/// location by setting the `AGAMA_SHARE_DIR` environment variable. This variable points to
/// the parent of `products.d`.
///
/// Dynamic behavior, like filtering by architecture, is not supported yet.
#[derive(Clone, Debug, Deserialize)]
pub struct Registry {
    path: std::path::PathBuf,
    products: Vec<ProductTemplate>,
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
                let product = ProductTemplate::load_from(path)?;
                tracing::debug!(
                    "Loading product {} with modes {:?}",
                    &product.id,
                    &product
                        .modes
                        .iter()
                        .map(|m| m.id.as_str())
                        .collect::<Vec<_>>()
                );
                self.products.push(product);
            }
        }

        Ok(())
    }

    /// Returns the default product.
    ///
    /// If there is a single product, it is considered the "default product".
    pub fn default_product(&self) -> Option<ProductSpec> {
        if self.products.len() == 1 {
            if let Some(product) = self.products.first() {
                if !product.has_modes() {
                    return product.to_product_spec(None).ok();
                }
            }
        }

        None
    }

    /// Finds a product by its ID.
    ///
    /// * `id`: product ID.
    /// * `mode`: product mode. Required only if the product has modes.
    pub fn find(&self, id: &str, mode: Option<&str>) -> Result<ProductSpec, Error> {
        let mut mode = mode.clone();
        let Some(template) = self.products.iter().find(|p| p.id == id) else {
            return Err(Error::UnknownProduct(id.to_string()));
        };

        if mode.is_none() {
            if let Some(default_mode) = template.modes.first() {
                mode = Some(default_mode.id.as_str());
            }
        }

        template.to_product_spec(mode)
    }

    /// Returns a vector with available the products
    pub fn products(&self) -> Vec<Product> {
        let mut products: Vec<_> = self
            .products
            .iter()
            .map(|p| {
                let modes = p
                    .modes
                    .iter()
                    .map(|m| ProductMode {
                        id: m.id.clone(),
                        name: m.name.clone(),
                        description: m.description.clone(),
                    })
                    .collect();
                Product {
                    id: p.id.clone(),
                    name: p.name.clone(),
                    description: p.description.clone(),
                    icon: p.icon.clone(),
                    registration: p.registration,
                    license: p.license.clone(),
                    translations: Some(p.translations.clone()),
                    modes,
                }
            })
            .collect();

        products.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        products
    }
}

impl Default for Registry {
    fn default() -> Self {
        let share_dir = std::env::var("AGAMA_SHARE_DIR").unwrap_or("/usr/share/agama".to_string());
        let products_dir = PathBuf::from(share_dir).join("products.d");
        Self::new(products_dir)
    }
}

/// Represents a product that can be installed using Agama.
///
/// A product can have multiple modes (e.g., "Traditional" and "Immutable").
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ProductTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    #[serde(default)]
    pub translations: Translations,
    #[serde(default)]
    pub registration: bool,
    pub version: Option<String>,
    pub license: Option<String>,
    #[serde(default)]
    pub software: SoftwareSpec,
    #[serde(default)]
    pub storage: StorageSpec,
    #[serde(default)]
    pub modes: Vec<ProductModeSpec>,
}

impl ProductTemplate {
    pub fn load_from<P: AsRef<Path>>(path: P) -> Result<Self, Error> {
        let contents = std::fs::read_to_string(path)?;
        let template: ProductTemplate = serde_yaml::from_str(&contents)?;
        Ok(template)
    }

    pub fn to_product_spec(&self, mode: Option<&str>) -> Result<ProductSpec, Error> {
        let mut software = self.software.clone();
        let mut storage = self.storage.clone();

        if let Some(mode) = mode {
            let Some(mode) = self.modes.iter().find(|m| m.id == mode) else {
                return Err(Error::UnknownMode(self.id.to_string(), mode.to_string()));
            };

            if let Some(mut mode_software) = mode.software.clone() {
                mode_software.merge(software);
                software = mode_software;
            }

            if let Some(mut mode_storage) = mode.storage.clone() {
                mode_storage.merge(storage);
                storage = mode_storage;
            }
        }

        Ok(ProductSpec {
            id: self.id.clone(),
            name: self.name.clone(),
            description: self.description.clone(),
            mode: mode.map(|m| m.to_string()),
            icon: self.icon.clone(),
            // TODO: take only the proper translation.
            translations: self.translations.clone(),
            registration: self.registration,
            version: self.version.clone(),
            license: self.license.clone(),
            software,
            storage,
        })
    }

    pub fn has_modes(&self) -> bool {
        !self.modes.is_empty()
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ProductModeSpec {
    id: String,
    name: String,
    description: String,
    software: Option<SoftwareSpec>,
    storage: Option<StorageSpec>,
}

// TODO: ideally, part of this code could be auto-generated from a JSON schema definition.
/// Product specification (e.g., Tumbleweed).
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ProductSpec {
    pub id: String,
    pub name: String,
    pub description: String,
    pub mode: Option<String>,
    pub icon: String,
    #[serde(default)]
    pub translations: Translations,
    #[serde(default)]
    pub registration: bool,
    pub version: Option<String>,
    pub license: Option<String>,
    pub software: SoftwareSpec,
    pub storage: StorageSpec,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, Merge)]
pub struct SoftwareSpec {
    #[serde(default)]
    #[merge(strategy = merge::vec::append)]
    installation_repositories: Vec<RepositorySpec>,
    #[serde(default)]
    #[merge(strategy = merge::vec::append)]
    pub installation_labels: Vec<LabelSpec>,
    #[serde(default)]
    #[merge(strategy = merge::vec::append)]
    pub user_patterns: Vec<UserPattern>,
    #[serde(default)]
    #[merge(strategy = merge::vec::append)]
    pub mandatory_patterns: Vec<String>,
    #[serde(default)]
    #[merge(strategy = merge::vec::append)]
    pub mandatory_packages: Vec<String>,
    #[serde(default)]
    #[merge(strategy = merge::vec::append)]
    pub optional_patterns: Vec<String>,
    #[serde(default)]
    #[merge(strategy = merge::vec::append)]
    pub optional_packages: Vec<String>,
    #[merge(strategy = merge::option::overwrite_none)]
    pub base_product: Option<String>,
}

impl SoftwareSpec {
    // NOTE: perhaps implementing our own iterator would be more efficient.
    pub fn repositories(&self) -> Vec<&RepositorySpec> {
        let Ok(arch) = Arch::current() else {
            tracing::error!("Failed to determine the architecture");
            return vec![];
        };
        let arch = arch.to_yast_id();
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
    /// Pattern name.
    pub fn name(&self) -> &str {
        match self {
            UserPattern::Plain(name) => name,
            UserPattern::Preselected(pattern) => &pattern.name,
        }
    }

    /// Whether the pattern is preselected.
    pub fn preselected(&self) -> bool {
        match self {
            UserPattern::Plain(_) => false,
            UserPattern::Preselected(pattern) => pattern.selected,
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

#[derive(Clone, Debug, Default, Deserialize, Serialize, Merge)]
pub struct StorageSpec {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    boot_strategy: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    space_policy: Option<String>,
    #[serde(default)]
    #[merge(strategy = merge::vec::append)]
    volumes: Vec<String>,
    #[serde(default)]
    #[merge(strategy = merge::vec::append)]
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
    use test_context::{test_context, TestContext};

    use super::*;
    use std::path::PathBuf;

    struct Context {
        registry: Registry,
    }

    impl TestContext for Context {
        fn setup() -> Self {
            let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share/products.d");
            let mut registry = Registry::new(path.as_path());
            registry.read().unwrap();

            Self { registry }
        }
    }

    #[test_context(Context)]
    #[test]
    fn test_load_registry(ctx: &mut Context) {
        // ensuring that we can load all products from tests
        assert_eq!(ctx.registry.products.len(), 8);
    }

    #[test_context(Context)]
    #[test]
    fn test_find_product(ctx: &mut Context) {
        let tw = ctx.registry.find("Tumbleweed", None).unwrap();
        assert_eq!(tw.id, "Tumbleweed");
        assert_eq!(tw.name, "openSUSE Tumbleweed");
        assert_eq!(tw.icon, "Tumbleweed.svg");
        assert_eq!(tw.registration, false);
        assert_eq!(tw.version, None);

        let translations = &tw.translations;
        let description = &translations.description;
        assert!(description["cs"].contains("verze"));

        let software = &tw.software;
        assert_eq!(software.installation_repositories.len(), 12);
        assert_eq!(software.installation_labels.len(), 4);
        assert_eq!(software.base_product.as_ref().unwrap(), "openSUSE");
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
    }

    #[test_context(Context)]
    #[test]
    fn test_find_unknown_product(ctx: &mut Context) {
        let product = ctx.registry.find("Unknown", None).unwrap_err();
        assert!(matches!(product, Error::UnknownProduct(_)));
    }

    #[test_context(Context)]
    #[test]
    fn test_find_product_without_mode(ctx: &mut Context) {
        let product = ctx.registry.find("SLES", None).unwrap();
        assert_eq!(&product.id, "SLES");
        assert_eq!(&product.mode.unwrap(), "standard");
    }

    #[test_context(Context)]
    #[test]
    fn test_find_product_with_mode(ctx: &mut Context) {
        let sles = ctx.registry.find("SLES", Some("standard")).unwrap();
        assert_eq!(sles.id, "SLES");
        assert_eq!(sles.name, "SUSE Linux Enterprise Server 16.1");
        assert_eq!(sles.registration, true);
        assert_eq!(sles.version, Some("16.1".to_string()));

        let translations = &sles.translations;
        let description = &translations.description;
        assert!(description["cs"].contains("v cloudu"));

        let software = &sles.software;
        // from the base software section
        assert_eq!(software.installation_labels.len(), 4);
        assert!(software
            .mandatory_patterns
            .contains(&"bootloader".to_string()));

        // from the mode software section
        assert_eq!(software.base_product.as_ref().unwrap(), "SLES");
        assert!(software
            .mandatory_patterns
            .contains(&"enhanced_base".to_string()));
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
