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

use crate::l10n::L10nAgent;

pub struct Supervisor {
    l10n: L10nAgent,
    config: InstallSettings,
}

impl Supervisor {
    pub fn new(l10n: L10nAgent) -> Self {
        Self {
            l10n,
            config: InstallSettings::default(),
        }
    }

    pub async fn get_config(&self) -> &InstallSettings {
        &self.config
    }

    pub async fn get_proposal(&self) -> InstallSettings {
        // self.l10n.get_config()
        unimplemented!()
    }

    pub async fn patch_config(&self, config: InstallSettings) {
        unimplemented!();
        // let mut current = self.get_config();
        // self.set_config(current,.merge(config))
    }

    pub async fn set_config(&mut self, config: InstallSettings) {
        self.l10n.set_config(&config);
        self.config = config
    }
}
