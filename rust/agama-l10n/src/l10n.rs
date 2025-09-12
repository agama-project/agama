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

use crate::{actions, L10nConfig, L10nModel, L10nProposal, L10nSystemInfo, LocaleError};
use agama_locale_data::{KeymapId, LocaleId, TimezoneId};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub enum L10nAction {
    #[serde(rename = "configureL10n")]
    ConfigureSystem(actions::ConfigureSystemAction),
}

pub struct L10n {
    state: State,
    model: L10nModel,
}

struct State {
    system: L10nSystemInfo,
    config: Config,
}

impl L10n {
    pub fn new() -> Self {
        let model = L10nModel::new_with_locale(&LocaleId::default()).unwrap();
        let system = L10nSystemInfo::read_from(&model);
        let config = Config::new_from(&system);

        let state = State {
            system,
            config,
        };

        Self {
            state,
            model,
        }
    }

    pub fn get_config(&self) -> L10nConfig {
        (&self.state.config).into()
    }

    pub fn set_config(&mut self, user_config: &L10nConfig) -> Result<(), LocaleError> {
        self.state.config.merge(user_config)
    }

    pub fn get_proposal(&self) -> L10nProposal {
        (&self.state.config).into()
    }

    pub fn dispatch(&mut self, action: L10nAction) -> anyhow::Result<()> {
        match action {
            L10nAction::ConfigureSystem(action) => action.run(self),
        }
    }
}

struct Config {
    locale: LocaleId,
    keymap: KeymapId,
    timezone: TimezoneId,
}

impl Config {
    fn new_from(system: &L10nSystemInfo) -> Self {
        Self {
            locale: system.locale.clone(),
            keymap: system.keymap.clone(),
            timezone: system.timezone.clone(),
        }
    }

    fn merge(&mut self, config: &L10nConfig) -> Result<(), LocaleError> {
        if let Some(language) = &config.language {
            self.locale = language.parse().map_err(LocaleError::InvalidLocale)?
        }

        if let Some(keyboard) = &config.keyboard {
            self.keymap = keyboard.parse().map_err(LocaleError::InvalidKeymap)?
        }

        if let Some(timezone) = &config.timezone {
            self.timezone = timezone.parse().map_err(LocaleError::InvalidTimezone)?;
        }

        Ok(())
    }
}

impl From<&Config> for L10nConfig {
    fn from(config: &Config) -> Self {
        L10nConfig {
            language: Some(config.locale.to_string()),
            keyboard: Some(config.keymap.to_string()),
            timezone: Some(config.timezone.to_string()),
        }
    }
}

impl From<&Config> for L10nProposal {
    fn from(config: &Config) -> Self {
        L10nProposal {
            keymap: config.keymap.clone(),
            locale: config.locale.clone(),
            timezone: config.timezone.clone(),
        }
    }
}
