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

use crate::model::{Keymap, LocaleEntry, ModelAdapter, TimezoneEntry};
use agama_locale_data::{KeymapId, LocaleId, TimezoneId};
use serde::Serialize;
use serde_with::{serde_as, DisplayFromStr};

/// Localization-related information of the system where the installer
/// is running.
#[serde_as]
#[derive(Clone, Debug, Serialize)]
pub struct SystemInfo {
    /// List of know locales.
    pub locales: Vec<LocaleEntry>,
    /// List of known timezones.
    pub timezones: Vec<TimezoneEntry>,
    /// List of known keymaps.
    pub keymaps: Vec<Keymap>,
    /// Locale of the system where Agama is running.
    #[serde_as(as = "DisplayFromStr")]
    pub locale: LocaleId,
    /// Keymap of the system where Agama is running.
    #[serde_as(as = "DisplayFromStr")]
    pub keymap: KeymapId,
    /// Timezone of the system where Agama is running.
    #[serde_as(as = "DisplayFromStr")]
    pub timezone: TimezoneId,
}

impl SystemInfo {
    /// Reads the information from the system adapter.
    pub fn read_from<T: ModelAdapter>(model: &T) -> Self {
        let locales = model.locales_db().entries().clone();
        let keymaps = model.keymaps_db().entries().clone();
        let timezones = model.timezones_db().entries().clone();

        Self {
            locales,
            keymaps,
            timezones,
            locale: model.locale(),
            keymap: model.keymap().unwrap(),
            timezone: Default::default(),
        }
    }
}
