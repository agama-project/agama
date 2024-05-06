//! This module provides support for reading the locales database.

use crate::error::Error;
use agama_locale_data::{InvalidLocaleCode, LocaleId};
use anyhow::Context;
use serde::Serialize;
use serde_with::{serde_as, DisplayFromStr};
use std::process::Command;

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
    /// * `ui_language`: language to translate the descriptions (e.g., "en").
    pub fn read(&mut self, ui_language: &str) -> Result<(), Error> {
        let result = Command::new("localectl")
            .args(["list-locales"])
            .output()
            .context("Failed to get the list of locales")?;
        let output =
            String::from_utf8(result.stdout).context("Invalid UTF-8 sequence from list-locales")?;
        self.known_locales = output
            .lines()
            .filter_map(|line| TryInto::<LocaleId>::try_into(line).ok())
            .collect();
        self.locales = self.get_locales(ui_language)?;
        Ok(())
    }

    /// Determines whether a locale exists in the database.
    pub fn exists<T>(&self, locale: T) -> bool
    where
        T: TryInto<LocaleId>,
        T::Error: Into<InvalidLocaleCode>,
    {
        if let Ok(locale) = TryInto::<LocaleId>::try_into(locale) {
            return self.known_locales.contains(&locale);
        }

        false
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
        let found = found_locales.iter().find(|l| l.id == spanish).unwrap();
        assert_eq!(&found.language, "Spanisch");
        assert_eq!(&found.territory, "Spanien");
    }

    #[test]
    fn test_locale_exists() {
        let mut db = LocalesDatabase::new();
        db.read("en").unwrap();
        assert!(db.exists("en_US"));
        assert!(!db.exists("unknown_UNKNOWN"));
    }
}
