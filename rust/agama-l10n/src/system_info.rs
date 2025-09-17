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

use crate::{Keymap, LocaleEntry, Model, TimezoneEntry};
use agama_locale_data::{KeymapId, LocaleId, TimezoneId};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SystemInfo {
    pub locales: Vec<LocaleEntry>,
    pub timezones: Vec<TimezoneEntry>,
    pub keymaps: Vec<Keymap>,
    pub locale: LocaleId,
    pub keymap: KeymapId,
    pub timezone: TimezoneId,
}

impl SystemInfo {
    pub fn read_from(model: &Model) -> Self {
        let locales = model.locales_db.entries().clone();
        let keymaps = model.keymaps_db.entries().clone();
        let timezones = model.timezones_db.entries().clone();

        Self {
            locales,
            keymaps,
            timezones,
            locale: model.ui_locale.clone(),
            keymap: model.ui_keymap.clone(),
            timezone: Default::default(),
        }
    }
}
