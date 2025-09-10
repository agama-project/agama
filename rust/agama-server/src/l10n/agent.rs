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

use agama_l10n::{L10n, L10nInfo, LocaleError, LocalizationProposal};
use agama_lib::{config::LocalizationConfig, install_settings::InstallSettings};
use agama_locale_data::{KeymapId, LocaleId};
use merge_struct::merge;

pub struct L10nAgent {
    l10n: L10n,
}

impl L10nAgent {
    pub fn new(l10n: L10n) -> Self {
        Self { l10n }
    }

    /// Creates a new proposal using the given user configuration.
    ///
    /// It returns the used configuration and the proposal. The returned
    /// configuration may contain default values for the settings that were
    /// missing in the user configuration.
    pub fn propose(
        &mut self,
        user_config: &LocalizationConfig,
    ) -> Result<(LocalizationConfig, LocalizationProposal), LocaleError> {
        // FIXME: Build a config from the system
        let default_config = LocalizationConfig::default();
        let config = merge(&default_config, &user_config)?;
        let proposal = self.build_proposal(&config)?;
        self.sync_model(&proposal)?;
        Ok((config, proposal))
    }

    /// Returns the current configuration.
    pub fn get_config(&self) -> InstallSettings {
        let language = self.l10n.locales.first().map(ToString::to_string);
        let localization = LocalizationConfig {
            timezone: Some(self.l10n.timezone.to_string()),
            keyboard: Some(self.l10n.keymap.to_string()),
            language,
        };
        InstallSettings {
            localization: Some(localization),
            ..Default::default()
        }
    }

    /// Returns the system information.
    ///
    /// It inncludes the list of available locales, keymaps and timezones.
    pub fn get_system(&self) -> L10nInfo {
        L10nInfo {
            locales: self.l10n.locales_db.entries().clone(),
            keymaps: self.l10n.keymaps_db.entries().clone(),
            timezones: self.l10n.timezones_db.entries().clone(),
        }
    }

    fn build_proposal(
        &self,
        config: &LocalizationConfig,
    ) -> Result<LocalizationProposal, LocaleError> {
        let locale: LocaleId = if let Some(language) = &config.language {
            language.as_str().try_into()?
        } else {
            LocaleId::default()
        };

        let keymap: KeymapId = if let Some(keyboard) = &config.keyboard {
            keyboard.parse().map_err(LocaleError::InvalidKeymap)?
        } else {
            KeymapId::default()
        };

        let timezone = config
            .timezone
            .clone()
            .unwrap_or("Europe/Berlin".to_string());

        Ok(LocalizationProposal {
            locale,
            timezone,
            keymap,
        })
    }

    fn sync_model(&mut self, value: &LocalizationProposal) -> Result<(), LocaleError> {
        self.l10n.set_locales(&vec![value.locale.to_string()])?;
        self.l10n.set_timezone(&value.timezone)?;
        self.l10n.set_keymap(value.keymap.clone())?;
        Ok(())
    }
}
