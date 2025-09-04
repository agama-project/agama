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

use agama_lib::{
    install_settings::InstallSettings,
    localization::{model::LocaleConfig, LocalizationSettings},
};

use crate::l10n::L10n;

use super::LocaleError;

pub struct L10nAgent {
    l10n: L10n,
}

impl L10nAgent {
    pub fn new(l10n: L10n) -> Self {
        Self { l10n }
    }

    pub fn set_config(&mut self, config: &InstallSettings) {
        let localization = config.localization.clone().unwrap_or_default();

        let mut new_config = LocaleConfig::default();

        if let Some(language) = localization.language {
            new_config.locales = Some(vec![language]);
        }
        if let Some(keyboard) = localization.keyboard {
            new_config.keymap = Some(keyboard);
        }
        if let Some(timezone) = localization.timezone {
            new_config.timezone = Some(timezone);
        }

        self.update_model(new_config).unwrap();
    }

    pub fn get_config(&self) -> InstallSettings {
        let language = self.l10n.locales.first().map(ToString::to_string);
        let localization = LocalizationSettings {
            timezone: Some(self.l10n.timezone.to_string()),
            keyboard: Some(self.l10n.keymap.to_string()),
            language,
        };
        InstallSettings {
            localization: Some(localization),
            ..Default::default()
        }
    }

    pub fn update_model(&mut self, value: LocaleConfig) -> Result<(), LocaleError> {
        if let Some(locales) = &value.locales {
            self.l10n.set_locales(locales)?;
        }

        if let Some(timezone) = &value.timezone {
            self.l10n.set_timezone(timezone)?;
        }

        if let Some(keymap_id) = &value.keymap {
            let keymap_id = keymap_id.parse().map_err(LocaleError::InvalidKeymap)?;
            self.l10n.set_keymap(keymap_id)?;
        }

        Ok(())
    }
}
