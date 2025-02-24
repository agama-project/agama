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

//! This module provides support for reading the locales database.

use crate::error::Error;
use agama_locale_data::LocaleId;
use anyhow::Context;
use serde::Serialize;
use serde_with::{serde_as, DisplayFromStr};
use std::{fs, process::Command};

/// Represents a locale, including the localized language and territory.
#[serde_as]
#[derive(Debug, Serialize, Clone, utoipa::ToSchema)]
pub struct LocaleEntry {
    /// The locale code (e.g., "es_ES.UTF-8").
    #[serde_as(as = "DisplayFromStr")]
    pub id: LocaleId,
    /// Localized language name (e.g., "Spanish", "Español", etc.)
    pub language: String,
    /// Localized territory name (e.g., "Spain", "España", etc.)
    pub territory: String,
}

/// Represents the locales database.
///
/// The list of supported locales is read from `systemd-localed`. However, the
/// translations are obtained from the `agama_locale_data` crate.
#[derive(Default)]
pub struct LocalesDatabase {
    known_locales: Vec<LocaleId>,
    locales: Vec<LocaleEntry>,
}

impl LocalesDatabase {
    pub fn new() -> Self {
        Self::default()
    }

    /// Loads the list of locales.
    ///
    /// It checks for a file in /etc/agama.d/locales containing the list of supported locales (one per line).
    /// It it does not exists, calls `localectl list-locales`.
    ///
    /// * `ui_language`: language to translate the descriptions (e.g., "en").
    pub fn read(&mut self, ui_language: &str) -> Result<(), Error> {
        self.known_locales = Self::get_locales_list()?;
        self.locales = self.get_locales(ui_language)?;
        Ok(())
    }

    /// Determines whether a locale exists in the database.
    pub fn exists(&self, locale: &LocaleId) -> bool {
        self.known_locales.contains(&locale)
    }

    /// Returns the list of locales.
    pub fn entries(&self) -> &Vec<LocaleEntry> {
        &self.locales
    }

    /// Gets the supported locales information.
    ///
    /// * `ui_language`: language to use in the translations.
    fn get_locales(&self, ui_language: &str) -> Result<Vec<LocaleEntry>, Error> {
        const DEFAULT_LANG: &str = "en";
        let mut result = Vec::with_capacity(self.known_locales.len());
        let languages = agama_locale_data::get_languages()?;
        let territories = agama_locale_data::get_territories()?;
        for code in self.known_locales.as_slice() {
            let language = languages
                .find_by_id(&code.language)
                .context("language not found")?;

            let names = &language.names;
            let language_label = names
                .name_for(ui_language)
                .or_else(|| names.name_for(DEFAULT_LANG))
                .unwrap_or(language.id.to_string());

            let territory = territories
                .find_by_id(&code.territory)
                .context("territory not found")?;

            let names = &territory.names;
            let territory_label = names
                .name_for(ui_language)
                .or_else(|| names.name_for(DEFAULT_LANG))
                .unwrap_or(territory.id.to_string());

            let entry = LocaleEntry {
                id: code.clone(),
                language: language_label,
                territory: territory_label,
            };
            result.push(entry)
        }

        Ok(result)
    }

    fn get_locales_list() -> Result<Vec<LocaleId>, Error> {
        const LOCALES_LIST_PATH: &str = "/etc/agama.d/locales";

        let locales = fs::read_to_string(LOCALES_LIST_PATH).map(Self::get_locales_from_string);

        if let Ok(locales) = locales {
            if !locales.is_empty() {
                return Ok(locales);
            }
        }

        let result = Command::new("localectl")
            .args(["list-locales"])
            .output()
            .context("Failed to get the list of locales")?;

        let locales = String::from_utf8(result.stdout)
            .map(Self::get_locales_from_string)
            .context("Invalid UTF-8 sequence from list-locales")?;

        Ok(locales)
    }

    fn get_locales_from_string(locales: String) -> Vec<LocaleId> {
        locales
            .lines()
            .filter_map(|line| TryInto::<LocaleId>::try_into(line).ok())
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::LocalesDatabase;
    use agama_locale_data::LocaleId;

    #[test]
    fn test_read_locales() {
        let mut db = LocalesDatabase::new();
        db.read("de").unwrap();
        let found_locales = db.entries();
        let spanish: LocaleId = "es_ES".try_into().unwrap();
        let found = found_locales
            .iter()
            .find(|l| l.id == spanish)
            .expect("Spanish locale not found?! Suggestion: zypper in glibc-locale");
        assert_eq!(&found.language, "Spanisch");
        assert_eq!(&found.territory, "Spanien");
    }

    #[test]
    fn test_try_into_locale() {
        let locale = LocaleId::try_from("es_ES.UTF-16").unwrap();
        assert_eq!(&locale.language, "es");
        assert_eq!(&locale.territory, "ES");
        assert_eq!(&locale.encoding, "UTF-16");

        let invalid = LocaleId::try_from(".");
        assert!(invalid.is_err());
    }

    #[test]
    fn test_locale_exists() {
        let mut db = LocalesDatabase::new();
        db.read("en").unwrap();
        let en_us = LocaleId::try_from("en_US").unwrap();
        let unknown = LocaleId::try_from("unknown_UNKNOWN").unwrap();
        assert!(db.exists(&en_us));
        assert!(!db.exists(&unknown));
    }
}
