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

use crate::service;
use agama_locale_data::{KeymapId, LocaleId, TimezoneId};
use agama_utils::api::{self, l10n::SystemInfo};

#[derive(Clone, PartialEq)]
pub struct Config {
    pub locale: LocaleId,
    pub keymap: KeymapId,
    pub timezone: TimezoneId,
}

impl Config {
    pub fn new_from(system: &SystemInfo) -> Self {
        Self {
            locale: system.locale.clone(),
            keymap: system.keymap.clone(),
            timezone: system.timezone.clone(),
        }
    }

    pub fn merge(&self, config: &api::l10n::Config) -> Result<Self, service::Error> {
        let mut merged = self.clone();

        if let Some(language) = &config.locale {
            merged.locale = language.parse()?
        }

        if let Some(keyboard) = &config.keymap {
            merged.keymap = keyboard.parse()?
        }

        if let Some(timezone) = &config.timezone {
            merged.timezone = timezone.parse()?;
        }

        Ok(merged)
    }
}
