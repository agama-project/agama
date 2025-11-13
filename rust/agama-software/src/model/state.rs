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

//! This module implements a mechanism to build the wanted software
//! configuration and a mechanism to build it starting from the product
//! definition, the user configuration, etc.

use agama_utils::{
    api::software::{Config, PatternsConfig, RepositoryConfig, SystemInfo},
    products_registry::{ProductSpec, UserPattern},
};

use crate::{model::software_selection::SoftwareSelection, Resolvable, ResolvableType};

/// Represents the wanted software configuration.
///
/// It includes the list of repositories, selected resolvables, configuration
/// options, etc. This configuration is later applied by a model adapter.
///
/// The SoftwareState is built by the [SoftwareStateBuilder] using different
/// sources (the product specification, the user configuration, etc.).
#[derive(Debug)]
pub struct SoftwareState {
    pub product: String,
    pub repositories: Vec<Repository>,
    pub resolvables: Vec<ResolvableState>,
    pub options: SoftwareOptions,
}

/// Builder to create a [SoftwareState] struct from different sources.
///
/// At this point it uses the following sources:
///
/// * [Product specification](ProductSpec).
/// * [Software user configuration](Config).
/// * [System information](SystemInfo).
/// * [Agama software selection](SoftwareSelection).
pub struct SoftwareStateBuilder<'a> {
    /// Product specification.
    product: &'a ProductSpec,
    /// Configuration.
    config: Option<&'a Config>,
    /// Information from the underlying system.
    system: Option<&'a SystemInfo>,
    /// Agama's software selection.
    selection: Option<&'a SoftwareSelection>,
}

impl<'a> SoftwareStateBuilder<'a> {
    /// Creates a builder for the given product specification.
    pub fn for_product(product: &'a ProductSpec) -> Self {
        Self {
            product,
            config: None,
            system: None,
            selection: None,
        }
    }

    /// Adds the user configuration to use.
    pub fn with_config(mut self, config: &'a Config) -> Self {
        self.config = Some(config);
        self
    }

    pub fn with_system(mut self, system: &'a SystemInfo) -> Self {
        self.system = Some(system);
        self
    }

    pub fn with_selection(mut self, selection: &'a SoftwareSelection) -> Self {
        self.selection = Some(selection);
        self
    }

    /// Builds the [SoftwareState] by merging the product specification and the
    /// user configuration.
    pub fn build(self) -> SoftwareState {
        let mut state = self.from_product_spec();

        if let Some(system) = self.system {
            self.add_system_config(&mut state, system);
        }

        if let Some(config) = self.config {
            self.add_user_config(&mut state, config);
        }

        if let Some(selection) = self.selection {
            self.add_selection(&mut state, selection);
        }

        state
    }

    /// Adds the elements from the underlying system.
    ///
    /// It searches for repositories in the underlying system. The idea is to
    /// use the repositories for off-line installation.
    fn add_system_config(&self, state: &mut SoftwareState, system: &SystemInfo) {
        let repositories = system
            .repositories
            .iter()
            .filter(|r| r.mandatory)
            .map(Repository::from);
        state.repositories.extend(repositories);
    }

    /// Adds the elements from the user configuration.
    fn add_user_config(&self, state: &mut SoftwareState, config: &Config) {
        let Some(software) = &config.software else {
            return;
        };

        if let Some(repositories) = &software.extra_repositories {
            let extra = repositories.iter().map(Repository::from);
            state.repositories.extend(extra);
        }

        if let Some(patterns) = &software.patterns {
            match patterns {
                PatternsConfig::PatternsList(list) => {
                    // Replaces the list, keeping only the non-optional elements.
                    state.resolvables.retain(|p| p.optional == false);
                    state.resolvables.extend(
                        list.iter()
                            .map(|n| ResolvableState::new(n, ResolvableType::Pattern, false)),
                    );
                }
                PatternsConfig::PatternsMap(map) => {
                    // Adds or removes elements to the list
                    if let Some(add) = &map.add {
                        state.resolvables.extend(
                            add.iter()
                                .map(|n| ResolvableState::new(n, ResolvableType::Pattern, false)),
                        );
                    }

                    if let Some(remove) = &map.remove {
                        // NOTE: should we notify when a user wants to remove a
                        // pattern which is not optional?
                        state
                            .resolvables
                            .retain(|p| !(p.optional && remove.contains(&p.resolvable.name)));
                    }
                }
            }
        }

        if let Some(only_required) = software.only_required {
            state.options.only_required = only_required;
        }
    }

    /// It adds the software selection from Agama modules.
    fn add_selection(&self, state: &mut SoftwareState, selection: &SoftwareSelection) {
        let resolvables = selection
            .resolvables()
            .map(|r| ResolvableState::new_with_resolvable(&r, false));
        state.resolvables.extend(resolvables)
    }

    fn from_product_spec(&self) -> SoftwareState {
        let software = &self.product.software;
        let repositories = software
            .repositories()
            .into_iter()
            .enumerate()
            .map(|(i, r)| {
                let alias = format!("agama-{}", i);
                Repository {
                    name: alias.clone(),
                    alias,
                    url: r.url.clone(),
                    enabled: true,
                }
            })
            .collect();

        let mut resolvables: Vec<ResolvableState> = software
            .mandatory_patterns
            .iter()
            .map(|p| ResolvableState::new(p, ResolvableType::Pattern, false))
            .collect();

        resolvables.extend(
            software
                .optional_patterns
                .iter()
                .map(|p| ResolvableState::new(p, ResolvableType::Pattern, true)),
        );

        resolvables.extend(software.user_patterns.iter().filter_map(|p| match p {
            UserPattern::Plain(_) => None,
            UserPattern::Preselected(pattern) => {
                if pattern.selected {
                    Some(ResolvableState::new(
                        &pattern.name,
                        ResolvableType::Pattern,
                        true,
                    ))
                } else {
                    None
                }
            }
        }));

        SoftwareState {
            product: software.base_product.clone(),
            repositories,
            resolvables,
            options: Default::default(),
        }
    }
}

impl SoftwareState {
    pub fn build_from(
        product: &ProductSpec,
        config: &Config,
        system: &SystemInfo,
        selection: &SoftwareSelection,
    ) -> Self {
        SoftwareStateBuilder::for_product(product)
            .with_config(config)
            .with_system(system)
            .with_selection(selection)
            .build()
    }
}

/// Defines a repository.
#[derive(Debug)]
pub struct Repository {
    pub alias: String,
    pub name: String,
    pub url: String,
    pub enabled: bool,
}

impl From<&RepositoryConfig> for Repository {
    fn from(value: &RepositoryConfig) -> Self {
        Repository {
            name: value.name.as_ref().unwrap_or(&value.alias).clone(),
            alias: value.alias.clone(),
            url: value.url.clone(),
            enabled: value.enabled.unwrap_or(true),
        }
    }
}

impl From<&agama_utils::api::software::Repository> for Repository {
    fn from(value: &agama_utils::api::software::Repository) -> Self {
        Repository {
            name: value.name.clone(),
            alias: value.alias.clone(),
            url: value.url.clone(),
            enabled: value.enabled,
        }
    }
}

/// Defines a resolvable to be selected.
#[derive(Debug, PartialEq)]
pub struct ResolvableState {
    /// Resolvable name.
    pub resolvable: Resolvable,
    /// Whether this resolvable is optional or not.
    pub optional: bool,
}

impl ResolvableState {
    pub fn new(name: &str, r#type: ResolvableType, optional: bool) -> Self {
        Self::new_with_resolvable(&Resolvable::new(name, r#type), optional)
    }

    pub fn new_with_resolvable(resolvable: &Resolvable, optional: bool) -> Self {
        Self {
            resolvable: resolvable.clone(),
            optional,
        }
    }
}

/// Software system options.
#[derive(Default, Debug)]
pub struct SoftwareOptions {
    /// Install only required packages (not recommended ones).
    only_required: bool,
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use agama_utils::{
        api::software::{
            Config, PatternsConfig, PatternsMap, Repository, RepositoryConfig, SoftwareConfig,
            SystemInfo,
        },
        products_registry::ProductSpec,
    };

    use crate::model::{
        packages::ResolvableType,
        state::{ResolvableState, SoftwareStateBuilder},
    };

    fn build_user_config(patterns: Option<PatternsConfig>) -> Config {
        let repo = RepositoryConfig {
            alias: "user-repo-0".to_string(),
            url: "http://example.net/repo".to_string(),
            name: None,
            product_dir: None,
            enabled: Some(true),
            priority: None,
            allow_unsigned: None,
            gpg_fingerprints: None,
        };

        let software = SoftwareConfig {
            patterns,
            extra_repositories: Some(vec![repo]),
            ..Default::default()
        };

        Config {
            software: Some(software),
            ..Default::default()
        }
    }

    fn build_product_spec() -> ProductSpec {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../test/share/products.d/tumbleweed.yaml");
        let product = std::fs::read_to_string(&path).unwrap();
        serde_yaml::from_str(&product).unwrap()
    }

    #[test]
    fn test_build_state() {
        let product = build_product_spec();
        let config = Config::default();
        let state = SoftwareStateBuilder::for_product(&product)
            .with_config(&config)
            .build();

        assert_eq!(state.repositories.len(), 3);
        let aliases: Vec<_> = state.repositories.iter().map(|r| r.alias.clone()).collect();
        let expected_aliases = vec![
            "agama-0".to_string(),
            "agama-1".to_string(),
            "agama-2".to_string(),
        ];
        assert_eq!(expected_aliases, aliases);

        assert_eq!(state.product, "openSUSE".to_string());

        assert_eq!(
            state.resolvables,
            vec![
                ResolvableState::new("enhanced_base", ResolvableType::Pattern, false),
                ResolvableState::new("selinux", ResolvableType::Pattern, true),
            ]
        );
    }

    #[test]
    fn test_add_user_repositories() {
        let product = build_product_spec();
        let config = build_user_config(None);
        let state = SoftwareStateBuilder::for_product(&product)
            .with_config(&config)
            .build();

        assert_eq!(state.repositories.len(), 4);
        let aliases: Vec<_> = state.repositories.iter().map(|r| r.alias.clone()).collect();
        let expected_aliases = vec![
            "agama-0".to_string(),
            "agama-1".to_string(),
            "agama-2".to_string(),
            "user-repo-0".to_string(),
        ];
        assert_eq!(expected_aliases, aliases);
    }

    #[test]
    fn test_add_patterns() {
        let product = build_product_spec();
        let patterns = PatternsConfig::PatternsMap(PatternsMap {
            add: Some(vec!["gnome".to_string()]),
            remove: None,
        });
        let config = build_user_config(Some(patterns));

        let state = SoftwareStateBuilder::for_product(&product)
            .with_config(&config)
            .build();
        assert_eq!(
            state.resolvables,
            vec![
                ResolvableState::new("enhanced_base", ResolvableType::Pattern, false),
                ResolvableState::new("selinux", ResolvableType::Pattern, true),
                ResolvableState::new("gnome", ResolvableType::Pattern, false)
            ]
        );
    }

    #[test]
    fn test_remove_patterns() {
        let product = build_product_spec();
        let patterns = PatternsConfig::PatternsMap(PatternsMap {
            add: None,
            remove: Some(vec!["selinux".to_string()]),
        });
        let config = build_user_config(Some(patterns));

        let state = SoftwareStateBuilder::for_product(&product)
            .with_config(&config)
            .build();
        assert_eq!(
            state.resolvables,
            vec![ResolvableState::new(
                "enhanced_base",
                ResolvableType::Pattern,
                false
            ),]
        );
    }

    #[test]
    fn test_remove_mandatory_patterns() {
        let product = build_product_spec();
        let patterns = PatternsConfig::PatternsMap(PatternsMap {
            add: None,
            remove: Some(vec!["enhanced_base".to_string()]),
        });
        let config = build_user_config(Some(patterns));

        let state = SoftwareStateBuilder::for_product(&product)
            .with_config(&config)
            .build();
        assert_eq!(
            state.resolvables,
            vec![
                ResolvableState::new("enhanced_base", ResolvableType::Pattern, false),
                ResolvableState::new("selinux", ResolvableType::Pattern, true)
            ]
        );
    }

    #[test]
    fn test_replace_patterns_list() {
        let product = build_product_spec();
        let patterns = PatternsConfig::PatternsList(vec!["gnome".to_string()]);
        let config = build_user_config(Some(patterns));

        let state = SoftwareStateBuilder::for_product(&product)
            .with_config(&config)
            .build();
        assert_eq!(
            state.resolvables,
            vec![
                ResolvableState::new("enhanced_base", ResolvableType::Pattern, false),
                ResolvableState::new("gnome", ResolvableType::Pattern, false)
            ]
        );
    }

    #[test]
    fn test_use_base_repositories() {
        let product = build_product_spec();
        let patterns = PatternsConfig::PatternsList(vec!["gnome".to_string()]);
        let config = build_user_config(Some(patterns));

        let base_repo = Repository {
            alias: "install".to_string(),
            name: "install".to_string(),
            url: "hd:/run/initramfs/install".to_string(),
            enabled: false,
            mandatory: true,
        };

        let another_repo = Repository {
            alias: "another".to_string(),
            name: "another".to_string(),
            url: "https://example.lan/SLES/".to_string(),
            enabled: false,
            mandatory: false,
        };

        let system = SystemInfo {
            repositories: vec![base_repo, another_repo],
            ..Default::default()
        };

        let state = SoftwareStateBuilder::for_product(&product)
            .with_config(&config)
            .with_system(&system)
            .build();

        let aliases: Vec<_> = state.repositories.iter().map(|r| r.alias.clone()).collect();
        let expected_aliases = vec![
            "agama-0".to_string(),
            "agama-1".to_string(),
            "agama-2".to_string(),
            "install".to_string(),
            "user-repo-0".to_string(),
        ];
        assert_eq!(expected_aliases, aliases);
    }
}
