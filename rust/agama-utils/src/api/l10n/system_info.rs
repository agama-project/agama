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

use agama_locale_data::{KeymapId, LocaleId, TimezoneId};
use gettextrs::dgettext;
use serde::ser::SerializeStruct;
use serde::Serialize;
use serde_with::{serde_as, DisplayFromStr};

/// Localization-related information of the system where the installer is running.
#[serde_as]
#[derive(Clone, Default, Debug, Serialize, utoipa::ToSchema)]
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

/// Represents a locale, including the localized language and territory.
#[serde_as]
#[derive(Debug, Serialize, Clone, utoipa::ToSchema, PartialEq, Eq)]
pub struct LocaleEntry {
    /// The locale code (e.g., "es_ES.UTF-8").
    #[serde_as(as = "DisplayFromStr")]
    pub id: LocaleId,
    /// Localized language name (e.g., "Spanish", "Español", etc.)
    pub language: String,
    /// Localized territory name (e.g., "Spain", "España", etc.)
    pub territory: String,
    /// Console font
    pub consolefont: Option<String>,
}

impl Ord for LocaleEntry {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.language
            .cmp(&other.language)
            .then_with(|| self.territory.cmp(&other.territory))
            .then_with(|| self.id.cmp(&other.id))
            .then_with(|| self.consolefont.cmp(&other.consolefont))
    }
}

impl PartialOrd for LocaleEntry {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

/// Represents a timezone, including each part as localized.
#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
pub struct TimezoneEntry {
    /// Timezone identifier (e.g. "Atlantic/Canary").
    pub id: TimezoneId,
    /// Localized parts (e.g., "Atlántico", "Canarias").
    pub parts: Vec<String>,
    /// Localized name of the territory this timezone is associated to
    pub country: Option<String>,
}

// Minimal representation of a keymap
#[derive(Clone, Debug, utoipa::ToSchema)]
pub struct Keymap {
    /// Keymap identifier (e.g., "us")
    pub id: KeymapId,
    /// Keymap description
    description: String,
}

impl Keymap {
    pub fn new(id: KeymapId, description: &str) -> Self {
        Self {
            id,
            description: description.to_string(),
        }
    }

    pub fn localized_description(&self) -> String {
        dgettext("xkeyboard-config", &self.description)
    }
}

impl Serialize for Keymap {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let mut state = serializer.serialize_struct("Keymap", 2)?;
        state.serialize_field("id", &self.id.to_string())?;
        state.serialize_field("description", &self.localized_description())?;
        state.end()
    }
}
