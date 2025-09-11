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

use agama_lib::install_settings::InstallSettings;
use merge_struct::merge;
use serde::Deserialize;
use crate::{
    server::{Proposal, Scope, ScopeConfig, SystemInfo},
};
use agama_l10n::{L10n, L10nAction};

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum Action<'a> {
    L10n(L10nAction<'a>),
}

pub struct Supervisor {
    l10n: L10n,
    user_config: InstallSettings,
    config: InstallSettings,
    proposal: Option<Proposal>,
}

impl Supervisor {
    pub fn new() -> Self {
        Self {
            l10n: L10n::new(),
            config: InstallSettings::default(),
            user_config: InstallSettings::default(),
            proposal: None,
        }
    }

    /// Gets the current configuration.
    ///
    /// It includes user and default values.
    pub async fn get_config(&self) -> &InstallSettings {
        &self.config
    }

    /// Gets the current configuration set by the user.
    ///
    /// It includes only the values that were set by the user.
    pub async fn get_user_config(&self) -> &InstallSettings {
        &self.user_config
    }

    /// It returns the configuration for the given scope.
    ///
    /// * scope: scope to get the configuration for.
    pub async fn get_scope_config(&self, scope: Scope) -> Option<ScopeConfig> {
        // FIXME: implement this logic at InstallSettings level: self.get_config().by_scope(...)
        // It would allow us to drop this method.
        match scope {
            Scope::L10n => self
                .config
                .localization
                .clone()
                .map(|c| ScopeConfig::L10n(c)),
        }
    }

    /// Patches the user configuration with the given values.
    ///
    /// It merges the current configuration with the given one.
    pub async fn patch_config(&mut self, user_config: InstallSettings) {
        let config = merge(&self.user_config, &user_config).unwrap();
        self.update_config(config).await;
    }

    /// Sets the user configuration with the given values.
    ///
    /// It merges the values in the top-level. Therefore, if the configuration
    /// for a scope is not given, it keeps the previous one.
    ///
    /// FIXME: We should replace not given sections with the default ones.
    /// After all, now we have config/user/:scope URLs.
    pub async fn update_config(&mut self, user_config: InstallSettings) {
        // let mut config = self.config.clone();
        // let mut proposal = self.proposal.clone().unwrap_or_default();

        if let Some(l10n_user_config) = &user_config.localization {
            let action = L10n::new_configure_action(l10n_user_config);
            // TODO: manage error.
            self.l10n.dispatch(action).unwrap();
            // let (l10n_config, l10n_proposal) = self.l10n.propose(&l10n_user_config).unwrap();
            // config.localization = Some(l10n_config);
            // proposal.localization = l10n_proposal;
        }

        // self.config = config;
        self.user_config = user_config;
        // self.proposal = Some(proposal);
    }

    /// Patches the user configuration within the given scope.
    ///
    /// It merges the current configuration with the given one.
    pub async fn patch_scope_config(&mut self, user_config: ScopeConfig) {
        // let config = match user_config {
        //     ScopeConfig::L10n(new_config) => {
        //         let base_config = self.config.localization.clone().unwrap_or_default();
        //         ScopeConfig::L10n(merge(&base_config, &new_config).unwrap())
        //     }
        // };
        // self.update_scope_config(config).await;
        unimplemented!("TODO")
    }

    /// Sets the user configuration within the given scope.
    ///
    /// It replaces the current configuration with the given one and calculates a
    /// new proposal. Only the configuration in the given scope is affected.
    pub async fn update_scope_config(&mut self, user_config: ScopeConfig) {
        // let mut config = self.config.clone();
        // let mut proposal = self.proposal.clone().unwrap_or_default();
        // let mut base_user_config = self.user_config.clone();

        // match user_config {
        //     ScopeConfig::L10n(user_config) => {
        //         let (l10n_config, l10n_proposal) = self.l10n.propose(&user_config).unwrap();
        //         config.localization = Some(l10n_config);
        //         proposal.localization = l10n_proposal;
        //         base_user_config.localization = Some(user_config);
        //     }
        // }

        // self.config = config;
        // self.proposal = Some(proposal);
        // self.user_config = base_user_config;
        unimplemented!("TODO")
    }

    // TODO: report error if the action fails.
    pub async fn run_action<'a>(&mut self, action: Action<'a>) {
        match action {
            Action::L10n(l10n_action) => self.l10n.dispatch(l10n_action).unwrap(),
        }
    }

    /// It returns the current proposal, if any.
    pub async fn get_proposal(&self) -> Option<&Proposal> {
        self.proposal.as_ref()
    }

    /// It returns the information of the underlying system.
    pub async fn get_system(&self) -> SystemInfo {
        // SystemInfo {
        //     localization: self.l10n.get_system(),
        // }
        unimplemented!("TODO")
    }
}
