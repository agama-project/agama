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

use crate::{service, SystemInfo, UserConfig};
use agama_locale_data::{KeymapId, LocaleId, TimezoneId};

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

    pub fn merge(&mut self, config: &UserConfig) -> Result<(), service::Error> {
        if let Some(language) = &config.language {
            self.locale = language.parse().map_err(service::Error::InvalidLocale)?
        }

        if let Some(keyboard) = &config.keyboard {
            self.keymap = keyboard.parse().map_err(service::Error::InvalidKeymap)?
        }

        if let Some(timezone) = &config.timezone {
            self.timezone = timezone.parse().map_err(service::Error::InvalidTimezone)?;
        }

        Ok(())
    }
}
