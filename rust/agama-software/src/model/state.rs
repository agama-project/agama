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

use agama_utils::api::software::{Config, PatternsConfig, RepositoryParams};

use crate::model::products::{ProductSpec, UserPattern};

/// Represents the wanted software configuration.
///
/// It includes the list of repositories, selected resolvables, configuration
/// options, etc. This configuration is later applied by a model adapter.
#[derive(Debug)]
pub struct SoftwareState {
    pub product: String,
    pub repositories: Vec<Repository>,
    // TODO: consider implementing a list to make easier working with them.
    pub patterns: Vec<Resolvable>,
    pub packages: Vec<Resolvable>,
    pub options: SoftwareOptions,
}

/// Builder to create a [SoftwareState] struct from the other sources like the
/// product specification, the user configuration, etc.
pub struct SoftwareStateBuilder<'a> {
    product: &'a ProductSpec,
    config: Option<&'a Config>,
}

impl<'a> SoftwareStateBuilder<'a> {
    /// Creates a builder for the given product specification.
    pub fn for_product(product: &'a ProductSpec) -> Self {
        Self {
            product,
            config: None,
        }
    }

    /// Adds the user configuration to use.
    pub fn with_config(mut self, config: &'a Config) -> Self {
        self.config = Some(config);
        self
    }

    /// Builds the [SoftwareState] by merging the product specification and the
    /// user configuration.
    pub fn build(self) -> SoftwareState {
        let mut state = self.from_product_spec();

        if let Some(config) = self.config {
            self.add_user_config(&mut state, &config);
        }

        state
    }

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
                    state.patterns.retain(|p| p.optional == false);
                    state
                        .patterns
                        .extend(list.iter().map(|n| Resolvable::new(n, false)));
                }
                PatternsConfig::PatternsMap(map) => {
                    if let Some(add) = &map.add {
                        state
                            .patterns
                            .extend(add.iter().map(|n| Resolvable::new(n, false)));
                    }

                    if let Some(remove) = &map.remove {
                        state.patterns.retain(|p| !remove.contains(&p.name))
                    }
                }
            }
        }
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

        let mut patterns: Vec<Resolvable> = software
            .mandatory_patterns
            .iter()
            .map(|p| Resolvable::new(p, false))
            .collect();

        patterns.extend(
            software
                .optional_patterns
                .iter()
                .map(|p| Resolvable::new(p, true)),
        );

        patterns.extend(software.user_patterns.iter().filter_map(|p| match p {
            UserPattern::Plain(_) => None,
            UserPattern::Preselected(pattern) => {
                if pattern.selected {
                    Some(Resolvable::new(&pattern.name, true))
                } else {
                    None
                }
            }
        }));

        SoftwareState {
            product: software.base_product.clone(),
            repositories,
            patterns,
            packages: vec![],
            options: Default::default(),
        }
    }
}

impl SoftwareState {
    // TODO: Add SoftwareSelection as additional argument.
    pub fn build_from(product: &ProductSpec, config: &Config) -> Self {
        SoftwareStateBuilder::for_product(product)
            .with_config(config)
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

impl From<&RepositoryParams> for Repository {
    fn from(value: &RepositoryParams) -> Self {
        Repository {
            name: value.name.as_ref().unwrap_or(&value.alias).clone(),
            alias: value.alias.clone(),
            url: value.url.clone(),
            enabled: value.enabled.unwrap_or(true),
        }
    }
}

/// Defines a resolvable to be selected.
#[derive(Debug, PartialEq)]
pub struct Resolvable {
    /// Resolvable name.
    pub name: String,
    /// Whether this resolvable is optional or not.
    pub optional: bool,
}

impl Resolvable {
    pub fn new(name: &str, optional: bool) -> Self {
        Self {
            name: name.to_string(),
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
    use agama_utils::api::software::{
        PatternsConfig, PatternsMap, RepositoryParams, SoftwareConfig,
    };

    use super::*;

    fn build_user_config(patterns: Option<PatternsConfig>) -> Config {
        let repo = RepositoryParams {
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
        let product = std::fs::read_to_string("test/share/products.d/tumbleweed.yaml").unwrap();
        serde_yaml::from_str(&product).unwrap()
    }

    #[test]
    fn test_build_state() {
        let product = build_product_spec();
        let config = Config::default();
        let state = SoftwareState::build_from(&product, &config);

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
            state.patterns,
            vec![
                Resolvable::new("enhanced_base", false),
                Resolvable::new("selinux", true),
            ]
        );
    }

    #[test]
    fn test_add_user_repositories() {
        let product = build_product_spec();
        let config = build_user_config(None);
        let state = SoftwareState::build_from(&product, &config);

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

        let state = SoftwareState::build_from(&product, &config);
        assert_eq!(
            state.patterns,
            vec![
                Resolvable::new("enhanced_base", false),
                Resolvable::new("selinux", true),
                Resolvable::new("gnome", false)
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

        let state = SoftwareState::build_from(&product, &config);
        assert_eq!(
            state.patterns,
            vec![Resolvable::new("enhanced_base", false),]
        );
    }

    #[test]
    fn test_replace_patterns_list() {
        let product = build_product_spec();
        let patterns = PatternsConfig::PatternsList(vec!["gnome".to_string()]);
        let config = build_user_config(Some(patterns));

        let state = SoftwareState::build_from(&product, &config);
        assert_eq!(
            state.patterns,
            vec![
                Resolvable::new("enhanced_base", false),
                Resolvable::new("gnome", false)
            ]
        );
    }
}
