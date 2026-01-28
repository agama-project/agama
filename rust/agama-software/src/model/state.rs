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

use std::collections::HashMap;

use agama_utils::{
    api::software::{
        Config, PatternsConfig, ProductConfig, RepositoryConfig, SoftwareConfig, SystemInfo,
    },
    kernel_cmdline::KernelCmdline,
    products::{ProductSpec, UserPattern},
};
use url::Url;

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
    pub resolvables: ResolvablesState,
    pub options: SoftwareOptions,
    pub registration: Option<RegistrationState>,
    pub allow_registration: bool,
}

impl SoftwareState {
    /// Builds an empty software state for the given product.
    pub fn new(product: &str) -> Self {
        SoftwareState {
            product: product.to_string(),
            repositories: Default::default(),
            resolvables: Default::default(),
            options: Default::default(),
            registration: None,
            allow_registration: false,
        }
    }
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
    /// Kernel command-line options.
    kernel_cmdline: KernelCmdline,
}

impl<'a> SoftwareStateBuilder<'a> {
    /// Creates a builder for the given product specification.
    pub fn for_product(product: &'a ProductSpec) -> Self {
        Self {
            product,
            config: None,
            system: None,
            selection: None,
            kernel_cmdline: KernelCmdline::default(),
        }
    }

    /// Adds the user configuration to use.
    ///
    /// The configuration may contain user-selected patterns and packages, extra repositories, etc.
    pub fn with_config(mut self, config: &'a Config) -> Self {
        self.config = Some(config);
        self
    }

    /// Adds the information of the underlying system.
    ///
    /// The system may contain repositories, e.g. the off-line medium repository, DUD, etc.
    pub fn with_system(mut self, system: &'a SystemInfo) -> Self {
        self.system = Some(system);
        self
    }

    /// Adds the software selection from the installer.
    ///
    /// Agama might require the installation of patterns and packages.
    pub fn with_selection(mut self, selection: &'a SoftwareSelection) -> Self {
        self.selection = Some(selection);
        self
    }

    /// Adds the kernel command-line options.
    pub fn with_kernel_cmdline(mut self, kernel_cmdline: KernelCmdline) -> Self {
        self.kernel_cmdline = kernel_cmdline;
        self
    }

    /// Builds the [SoftwareState] combining all the sources.
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
    /// use the repositories for off-line installation or Driver Update Disks.
    fn add_system_config(&self, state: &mut SoftwareState, system: &SystemInfo) {
        let repositories = system
            .repositories
            .iter()
            .filter(|r| r.predefined)
            .map(Repository::from);
        state.repositories.extend(repositories);

        // hardcode here kernel as it is not in basic dependencies due to
        // containers, but for agama usage, it does not make sense to skip kernel
        // If needs arise, we can always add more smarter kernel selection later.
        state.resolvables.add_or_replace(
            "kernel-default",
            ResolvableType::Package,
            ResolvableSelection::AutoSelected { optional: false },
        );
    }

    /// Adds the elements from the user configuration.
    fn add_user_config(&self, state: &mut SoftwareState, config: &Config) {
        if let Some(product) = &config.product {
            self.add_user_product_config(state, product);
        }

        if let Some(software) = &config.software {
            self.add_user_software_config(state, software);
        }
    }

    /// Adds the elements from the user product configuration.
    fn add_user_product_config(&self, state: &mut SoftwareState, config: &ProductConfig) {
        if !state.allow_registration {
            return;
        }

        if config.registration_code.is_none() && config.registration_url.is_none() {
            return;
        }

        let product = self.product.id.clone();
        let version = self.product.version.clone().unwrap_or("1".to_string());

        let addons: Vec<_> = if let Some(addons_config) = &config.addons {
            addons_config
                .iter()
                .map(|c| Addon::new(&c.id, c.version.clone(), c.registration_code.clone()))
                .collect()
        } else {
            vec![]
        };

        state.registration = Some(RegistrationState {
            product,
            version,
            code: config.registration_code.clone(),
            email: config.registration_email.clone(),
            url: config.registration_url.clone(),
            addons,
        });
    }

    /// Adds the elements from the user software configuration.
    fn add_user_software_config(&self, state: &mut SoftwareState, config: &SoftwareConfig) {
        if let Some(repositories) = &config.extra_repositories {
            let extra = repositories.iter().map(Repository::from);
            state.repositories.extend(extra);
        }

        if let Some(patterns) = &config.patterns {
            match patterns {
                PatternsConfig::PatternsList(list) => {
                    // reset list of product preselected patterns
                    state.resolvables.reset_user_patterns();
                    for name in list.iter() {
                        state.resolvables.add_or_replace(
                            name,
                            ResolvableType::Pattern,
                            ResolvableSelection::Selected,
                        )
                    }
                }
                PatternsConfig::PatternsMap(map) => {
                    let mut list: Vec<(&str, ResolvableSelection)> = vec![];

                    if let Some(add) = &map.add {
                        list.extend(
                            add.iter()
                                .map(|n| (n.as_str(), ResolvableSelection::Selected)),
                        );
                    }

                    if let Some(remove) = &map.remove {
                        list.extend(
                            remove
                                .iter()
                                .map(|n| (n.as_str(), ResolvableSelection::Removed)),
                        );
                    }

                    for (name, selection) in list.into_iter() {
                        state
                            .resolvables
                            .add_or_replace(name, ResolvableType::Pattern, selection);
                    }
                }
            }
        }

        if let Some(packages) = &config.packages {
            for name in packages.iter() {
                state.resolvables.add_or_replace(
                    name,
                    ResolvableType::Package,
                    ResolvableSelection::Selected,
                )
            }
        }

        if let Some(only_required) = config.only_required {
            state.options.only_required = only_required;
        }
    }

    /// It adds the software selection from Agama modules.
    fn add_selection(&self, state: &mut SoftwareState, selection: &SoftwareSelection) {
        for resolvable in selection.resolvables() {
            state.resolvables.add_or_replace_resolvable(
                &resolvable,
                ResolvableSelection::AutoSelected { optional: false },
            );
        }
    }

    fn from_product_spec(&self) -> SoftwareState {
        let software = &self.product.software;
        let kernel_repos = self.kernel_cmdline.get_last("inst.install_url");
        let repositories = if let Some(kernel_repos) = kernel_repos {
            kernel_repos
                .split(",")
                .enumerate()
                .map(|(i, url)| {
                    let alias = format!("agama-{}", i);
                    Repository {
                        name: alias.clone(),
                        alias: alias,
                        url: url.to_string(),
                        enabled: true,
                    }
                })
                .collect()
        } else {
            software
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
                .collect()
        };

        let mut resolvables = ResolvablesState::default();
        for pattern in &software.mandatory_patterns {
            resolvables.add_or_replace(
                pattern,
                ResolvableType::Pattern,
                ResolvableSelection::AutoSelected { optional: false },
            );
        }

        for pattern in &software.optional_patterns {
            resolvables.add_or_replace(
                pattern,
                ResolvableType::Pattern,
                ResolvableSelection::AutoSelected { optional: true },
            );
        }

        for pattern in &software.user_patterns {
            if let UserPattern::Preselected(user_pattern) = pattern {
                if user_pattern.selected {
                    resolvables.add_or_replace(
                        &user_pattern.name,
                        ResolvableType::Pattern,
                        ResolvableSelection::Selected,
                    )
                }
            }
        }

        for package in &software.mandatory_packages {
            resolvables.add_or_replace(
                package,
                ResolvableType::Package,
                ResolvableSelection::AutoSelected { optional: false },
            );
        }

        for package in &software.optional_packages {
            resolvables.add_or_replace(
                package,
                ResolvableType::Package,
                ResolvableSelection::AutoSelected { optional: true },
            );
        }

        SoftwareState {
            product: software
                .base_product
                .clone()
                .expect("Expected a base product to be defined"),
            repositories,
            resolvables,
            registration: None,
            options: Default::default(),
            allow_registration: self.product.registration,
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
            .with_kernel_cmdline(KernelCmdline::parse().unwrap_or_default())
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

/// Holds states for resolvables.
///
/// Check the [ResolvableSelection] enum for possible states.
#[derive(Debug, Default)]
pub struct ResolvablesState(HashMap<(String, ResolvableType), ResolvableSelection>);

impl ResolvablesState {
    /// Add or replace the state for the resolvable with the given name and type.
    ///
    /// If the resolvable is auto selected and mandatory, it does not update the
    /// state.
    ///
    /// * `name`: resolvable name.
    /// * `r#type`: resolvable type.
    /// * `selection`: selection state.
    pub fn add_or_replace(
        &mut self,
        name: &str,
        r#type: ResolvableType,
        selection: ResolvableSelection,
    ) {
        if let Some(entry) = self.0.get(&(name.to_string(), r#type)) {
            if let ResolvableSelection::AutoSelected { optional: _ } = entry {
                tracing::debug!("Could not modify the {name} state because it is mandatory.");
                return;
            }
        }
        self.0.insert((name.to_string(), r#type), selection);
    }

    /// Add or replace the state for the given resolvable.
    ///
    /// If the resolvable is auto selected and mandatory, it does not update the
    /// state.
    ///
    /// * `resolvable`: resolvable.
    /// * `selection`: selection state.
    pub fn add_or_replace_resolvable(
        &mut self,
        resolvable: &Resolvable,
        selection: ResolvableSelection,
    ) {
        self.add_or_replace(&resolvable.name, resolvable.r#type, selection);
    }

    /// Reset the list of user selected patterns. It is useful if product preselects some and
    /// user then specify exact list of packages he wants.
    ///
    /// The automatic patterns are preserved.
    pub fn reset_user_patterns(&mut self) {
        self.0.retain(|(_name, typ), selection| {
            if typ != &ResolvableType::Pattern {
                return true;
            }

            selection != &ResolvableSelection::Selected
        });
    }

    /// Turns the list of resolvables into a vector.
    ///
    /// FIXME: return an interator instead.
    pub fn to_vec(&self) -> Vec<(String, ResolvableType, ResolvableSelection)> {
        let mut vector: Vec<_> = self
            .0
            .iter()
            .map(|(key, selection)| (key.0.to_string(), key.1, *selection))
            .collect();
        vector.sort_by(|a, b| a.0.cmp(&b.0));
        vector
    }
}

/// Define the wanted resolvable selection state.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ResolvableSelection {
    /// Selected by the user.
    Selected,
    /// Selected by the installer itself and whether it is optional or not.
    AutoSelected { optional: bool },
    /// Removed by the user. It allows to remove resolvables that might be auto-selected
    /// by the solver (e.g., recommended patterns).
    Removed,
}

impl ResolvableSelection {
    pub fn is_optional(&self) -> bool {
        if let ResolvableSelection::AutoSelected { optional } = self {
            return *optional;
        }

        false
    }
}

impl From<ResolvableSelection> for zypp_agama::ResolvableSelected {
    fn from(value: ResolvableSelection) -> Self {
        match value {
            ResolvableSelection::Selected => zypp_agama::ResolvableSelected::User,
            ResolvableSelection::AutoSelected { optional: _ } => {
                zypp_agama::ResolvableSelected::Installation
            }
            ResolvableSelection::Removed => zypp_agama::ResolvableSelected::Not,
        }
    }
}

/// Software system options.
#[derive(Default, Debug)]
pub struct SoftwareOptions {
    /// Install only required packages (not recommended ones).
    only_required: bool,
}

#[derive(Clone, Debug)]
pub struct RegistrationState {
    pub product: String,
    pub version: String,
    // FIXME: the code should be optional.
    pub code: Option<String>,
    pub email: Option<String>,
    pub url: Option<Url>,
    pub addons: Vec<Addon>,
}

#[derive(Clone, Debug)]
pub struct Addon {
    pub id: String,
    pub version: Option<String>,
    pub code: Option<String>,
}

impl Addon {
    pub fn new(id: &str, version: Option<String>, code: Option<String>) -> Self {
        Addon {
            id: id.to_string(),
            version: version,
            code: code,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use agama_utils::{
        api::software::{
            AddonConfig, Config, PatternsConfig, PatternsMap, ProductConfig, Repository,
            RepositoryConfig, SoftwareConfig, SystemInfo,
        },
        kernel_cmdline::KernelCmdline,
        products::{ProductSpec, ProductTemplate},
    };
    use url::Url;

    use crate::model::{
        packages::ResolvableType,
        state::{ResolvableSelection, SoftwareStateBuilder},
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

    fn build_product_spec(name: &str, mode: Option<&str>) -> ProductSpec {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join(format!("../test/share/products.d/{}.yaml", name));
        let template = std::fs::read_to_string(&path).unwrap();
        let template: ProductTemplate = serde_yaml::from_str(&template).unwrap();
        template.to_product_spec(mode).unwrap()
    }

    #[test]
    fn test_build_state() {
        let product = build_product_spec("tumbleweed", None);
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
            state.resolvables.to_vec(),
            vec![
                (
                    "NetworkManager".to_string(),
                    ResolvableType::Package,
                    ResolvableSelection::AutoSelected { optional: false }
                ),
                (
                    "enhanced_base".to_string(),
                    ResolvableType::Pattern,
                    ResolvableSelection::AutoSelected { optional: false }
                ),
                (
                    "openSUSE-repos-Tumbleweed".to_string(),
                    ResolvableType::Package,
                    ResolvableSelection::AutoSelected { optional: false }
                ),
                (
                    "selinux".to_string(),
                    ResolvableType::Pattern,
                    ResolvableSelection::Selected
                ),
                (
                    "sudo-policy-wheel-auth-self".to_string(),
                    ResolvableType::Package,
                    ResolvableSelection::AutoSelected { optional: false }
                )
            ]
        );
    }

    #[test]
    fn test_add_user_repositories() {
        let product = build_product_spec("tumbleweed", None);
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
        let product = build_product_spec("tumbleweed", None);
        let patterns = PatternsConfig::PatternsMap(PatternsMap {
            add: Some(vec!["gnome".to_string()]),
            remove: None,
        });
        let config = build_user_config(Some(patterns));

        let state = SoftwareStateBuilder::for_product(&product)
            .with_config(&config)
            .build();
        let patterns: Vec<_> = state
            .resolvables
            .to_vec()
            .into_iter()
            .filter(|(_, t, _)| *t == ResolvableType::Pattern)
            .collect();
        assert_eq!(
            patterns,
            vec![
                (
                    "enhanced_base".to_string(),
                    ResolvableType::Pattern,
                    ResolvableSelection::AutoSelected { optional: false }
                ),
                (
                    "gnome".to_string(),
                    ResolvableType::Pattern,
                    ResolvableSelection::Selected
                ),
                (
                    "selinux".to_string(),
                    ResolvableType::Pattern,
                    ResolvableSelection::Selected
                ),
            ]
        );
    }

    #[test]
    fn test_add_registration() {
        let product = build_product_spec("sles_161", Some("traditional"));
        let mut config = build_user_config(None);
        config.product = ProductConfig {
            id: Some("SLES".to_string()),
            mode: Some("traditional".to_string()),
            registration_code: Some("123456".to_string()),
            registration_url: Some(Url::parse("https://scc.suse.com").unwrap()),
            registration_email: Some("jane.doe@example.net".to_string()),
            addons: Some(vec![AddonConfig {
                id: "sle-ha".to_string(),
                version: Some("16.0".to_string()),
                registration_code: Some("ABCDEF".to_string()),
            }]),
        }
        .into();
        let state = SoftwareStateBuilder::for_product(&product)
            .with_config(&config)
            .build();

        let registration = state.registration.unwrap();
        assert_eq!(registration.code, Some("123456".to_string()));
        assert_eq!(
            registration.url,
            Some(Url::parse("https://scc.suse.com").unwrap())
        );
        assert_eq!(registration.email, Some("jane.doe@example.net".to_string()));

        let addon = registration.addons.first().unwrap();
        assert_eq!(&addon.id, "sle-ha");
        assert_eq!(addon.version, Some("16.0".to_string()));
        assert_eq!(addon.code, Some("ABCDEF".to_string()));
    }

    #[test]
    fn test_remove_patterns() {
        let product = build_product_spec("tumbleweed", None);
        let patterns = PatternsConfig::PatternsMap(PatternsMap {
            add: None,
            remove: Some(vec!["selinux".to_string()]),
        });
        let config = build_user_config(Some(patterns));

        let state = SoftwareStateBuilder::for_product(&product)
            .with_config(&config)
            .build();
        let patterns: Vec<_> = state
            .resolvables
            .to_vec()
            .into_iter()
            .filter(|(_, t, _)| *t == ResolvableType::Pattern)
            .collect();
        assert_eq!(
            patterns,
            vec![
                (
                    "enhanced_base".to_string(),
                    ResolvableType::Pattern,
                    ResolvableSelection::AutoSelected { optional: false }
                ),
                (
                    "selinux".to_string(),
                    ResolvableType::Pattern,
                    ResolvableSelection::Removed
                )
            ]
        );
    }

    #[test]
    fn test_remove_mandatory_patterns() {
        let product = build_product_spec("tumbleweed", None);
        let patterns = PatternsConfig::PatternsMap(PatternsMap {
            add: None,
            remove: Some(vec!["enhanced_base".to_string()]),
        });
        let config = build_user_config(Some(patterns));

        let state = SoftwareStateBuilder::for_product(&product)
            .with_config(&config)
            .build();
        let patterns: Vec<_> = state
            .resolvables
            .to_vec()
            .into_iter()
            .filter(|(_, t, _)| *t == ResolvableType::Pattern)
            .collect();
        assert_eq!(
            patterns,
            vec![
                (
                    "enhanced_base".to_string(),
                    ResolvableType::Pattern,
                    ResolvableSelection::AutoSelected { optional: false }
                ),
                (
                    "selinux".to_string(),
                    ResolvableType::Pattern,
                    ResolvableSelection::Selected
                )
            ]
        );
    }

    #[test]
    fn test_replace_patterns_list() {
        let product = build_product_spec("tumbleweed", None);
        let patterns = PatternsConfig::PatternsList(vec!["gnome".to_string()]);
        let config = build_user_config(Some(patterns));

        let state = SoftwareStateBuilder::for_product(&product)
            .with_config(&config)
            .build();
        let patterns: Vec<_> = state
            .resolvables
            .to_vec()
            .into_iter()
            .filter(|(_, t, _)| *t == ResolvableType::Pattern)
            .collect();
        assert_eq!(
            patterns,
            vec![
                (
                    "enhanced_base".to_string(),
                    ResolvableType::Pattern,
                    ResolvableSelection::AutoSelected { optional: false }
                ),
                (
                    "gnome".to_string(),
                    ResolvableType::Pattern,
                    ResolvableSelection::Selected,
                )
            ]
        );
    }

    #[test]
    fn test_use_base_repositories() {
        let product = build_product_spec("tumbleweed", None);
        let patterns = PatternsConfig::PatternsList(vec!["gnome".to_string()]);
        let config = build_user_config(Some(patterns));

        let base_repo = Repository {
            alias: "install".to_string(),
            name: "install".to_string(),
            url: "hd:/run/initramfs/install".to_string(),
            enabled: false,
            predefined: true,
        };

        let another_repo = Repository {
            alias: "another".to_string(),
            name: "another".to_string(),
            url: "https://example.lan/SLES/".to_string(),
            enabled: false,
            predefined: false,
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

    #[test]
    fn test_mandatory_packages() {
        let product = build_product_spec("tumbleweed", None);
        let config = Config::default();
        let state = SoftwareStateBuilder::for_product(&product)
            .with_config(&config)
            .build();

        let packages: Vec<_> = state
            .resolvables
            .to_vec()
            .into_iter()
            .filter(|(_, t, _)| *t == ResolvableType::Package)
            .collect();

        assert_eq!(
            packages,
            vec![
                (
                    "NetworkManager".to_string(),
                    ResolvableType::Package,
                    ResolvableSelection::AutoSelected { optional: false }
                ),
                (
                    "openSUSE-repos-Tumbleweed".to_string(),
                    ResolvableType::Package,
                    ResolvableSelection::AutoSelected { optional: false }
                ),
                (
                    "sudo-policy-wheel-auth-self".to_string(),
                    ResolvableType::Package,
                    ResolvableSelection::AutoSelected { optional: false }
                )
            ]
        );
    }

    #[test]
    fn test_system_adds_kernel() {
        let product = build_product_spec("tumbleweed", None);
        let system = SystemInfo::default();

        let state = SoftwareStateBuilder::for_product(&product)
            .with_system(&system)
            .build();

        let kernel = state
            .resolvables
            .to_vec()
            .into_iter()
            .find(|(name, r#type, _)| {
                name == "kernel-default" && *r#type == ResolvableType::Package
            });

        assert_eq!(
            kernel,
            Some((
                "kernel-default".to_string(),
                ResolvableType::Package,
                ResolvableSelection::AutoSelected { optional: false }
            ))
        );
    }

    #[test]
    fn test_repositories_from_kernel_cmdline() {
        let product = build_product_spec("tumbleweed", None);
        let kernel_cmdline = KernelCmdline::parse_str(
            "inst.install_url=http://example.com/repo1,http://example.com/repo2",
        );

        let state = SoftwareStateBuilder::for_product(&product)
            .with_kernel_cmdline(kernel_cmdline)
            .build();

        assert_eq!(state.repositories.len(), 2);
        assert_eq!(state.repositories[0].url, "http://example.com/repo1");
        assert_eq!(state.repositories[0].alias, "agama-0");
        assert_eq!(state.repositories[1].url, "http://example.com/repo2");
        assert_eq!(state.repositories[1].alias, "agama-1");
    }

    #[test]
    fn test_single_repository_from_kernel_cmdline() {
        let product = build_product_spec("tumbleweed", None);
        let kernel_cmdline = KernelCmdline::parse_str("inst.install_url=http://example.com/repo1");

        let state = SoftwareStateBuilder::for_product(&product)
            .with_kernel_cmdline(kernel_cmdline)
            .build();

        assert_eq!(state.repositories.len(), 1);
        assert_eq!(state.repositories[0].url, "http://example.com/repo1");
        assert_eq!(state.repositories[0].alias, "agama-0");
    }

    #[test]
    fn test_repositories_fallback_to_product() {
        let product = build_product_spec("tumbleweed", None);
        let kernel_cmdline = KernelCmdline::default();

        let state = SoftwareStateBuilder::for_product(&product)
            .with_kernel_cmdline(kernel_cmdline)
            .build();

        assert_eq!(state.repositories.len(), 3);
    }
}
