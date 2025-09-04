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

use agama_lib::{install_settings::InstallSettings, localization::LocalizationSettings};

use crate::{l10n::L10n, server::proposal::LocalizationProposal};

use super::LocaleError;

pub struct L10nAgent {
    l10n: L10n,
}

impl L10nAgent {
    pub fn new(l10n: L10n) -> Self {
        Self { l10n }
    }

    pub fn set_config(&mut self, config: &InstallSettings) -> Result<(), LocaleError> {
        let localization = config.localization.clone().unwrap_or_default();

        // FIXME: Build a proposal
        let mut proposal = LocalizationProposal::default();

        if let Some(language) = localization.language {
            proposal.locale = language.as_str().try_into()?;
        }
        if let Some(keymap) = localization.keyboard {
            proposal.keymap = keymap.parse().map_err(LocaleError::InvalidKeymap)?;
        }
        if let Some(timezone) = localization.timezone {
            proposal.timezone = timezone;
        }

        self.update_proposal(proposal)
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

    pub fn get_proposal(&self) -> LocalizationProposal {
        let locale = self.l10n.locales.first().cloned().unwrap_or_default();
        LocalizationProposal {
            keymap: self.l10n.keymap.clone(),
            locale,
            timezone: self.l10n.timezone.clone(),
        }
    }

    pub fn update_proposal(&mut self, value: LocalizationProposal) -> Result<(), LocaleError> {
        self.l10n.set_locales(&vec![value.locale.to_string()])?;
        self.l10n.set_timezone(&value.timezone)?;
        self.l10n.set_keymap(value.keymap)?;

        Ok(())
    }
}
