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

use crate::{l10n::L10nAgent, server::Proposal};

pub struct Supervisor {
    l10n: L10nAgent,
    user_config: InstallSettings,
    config: InstallSettings,
    proposal: Option<Proposal>,
}

impl Supervisor {
    pub fn new(l10n: L10nAgent) -> Self {
        Self {
            l10n,
            config: InstallSettings::default(),
            user_config: InstallSettings::default(),
            proposal: None,
        }
    }

    pub async fn get_config(&self) -> &InstallSettings {
        &self.config
    }

    pub async fn get_proposal(&self) -> &Option<Proposal> {
        &self.proposal
    }

    pub async fn patch_config(&mut self, user_config: InstallSettings) {
        let config = merge(&self.user_config, &user_config).unwrap();
        self.set_config(config);
    }

    pub async fn set_config(&mut self, user_config: InstallSettings) {
        let mut config = InstallSettings::default();

        let (l10n_config, l10n_proposal) = self.l10n.propose(&config).unwrap();
        config.localization = Some(l10n_config);

        self.config = config;
        self.user_config = user_config;
        self.proposal = Some(Proposal {
            localization: l10n_proposal,
        })
    }
}
