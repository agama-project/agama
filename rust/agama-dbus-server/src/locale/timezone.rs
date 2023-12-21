//! This module provides support for reading the timezones database.

use crate::error::Error;
use agama_locale_data::territory::Territories;
use agama_locale_data::timezone_part::TimezoneIdParts;
use std::collections::HashMap;

/// Represents a timezone, including each part as localized.
#[derive(Debug)]
pub struct TimezoneEntry {
    /// Timezone identifier (e.g. "Atlantic/Canary").
    pub code: String,
    /// Localized parts (e.g., "Atlántico", "Canarias").
    pub parts: Vec<String>,
    /// Localized name of the territory this timezone is associated to
    pub country: Option<String>,
}

#[derive(Default)]
pub struct TimezonesDatabase {
    timezones: Vec<TimezoneEntry>,
}

impl TimezonesDatabase {
    pub fn new() -> Self {
        Self::default()
    }

    /// Initializes the list of known timezones.
    ///
    /// * `ui_language`: language to translate the descriptions (e.g., "en").
    pub fn read(&mut self, ui_language: &str) -> Result<(), Error> {
        self.timezones = self.get_timezones(ui_language)?;
        Ok(())
    }

    /// Determines whether a timezone exists in the database.
    pub fn exists(&self, timezone: &String) -> bool {
        self.timezones.iter().any(|t| &t.code == timezone)
    }

    /// Returns the list of timezones.
    pub fn entries(&self) -> &Vec<TimezoneEntry> {
        &self.timezones
    }

    /// Returns a list of the supported timezones.
    ///
    /// Each element of the list contains a timezone identifier and a vector
    /// containing the translation of each part of the language.
    ///
    /// * `ui_language`: language to translate the descriptions (e.g., "en").
    fn get_timezones(&self, ui_language: &str) -> Result<Vec<TimezoneEntry>, Error> {
        let timezones = agama_locale_data::get_timezones();
        let tz_parts = agama_locale_data::get_timezone_parts()?;
        let territories = agama_locale_data::get_territories()?;
        let tz_countries = agama_locale_data::get_timezone_countries()?;
        const COUNTRYLESS: [&str; 2] = ["UTC", "Antarctica/South_Pole"];

        let ret = timezones
            .into_iter()
            .filter_map(|tz| {
                let parts = translate_parts(&tz, ui_language, &tz_parts);
                let country = translate_country(&tz, ui_language, &tz_countries, &territories);
                match country {
                    None if !COUNTRYLESS.contains(&tz.as_str()) => None,
                    _ => Some(TimezoneEntry {
                        code: tz,
                        parts,
                        country,
                    }),
                }
            })
            .collect();

        Ok(ret)
    }
}

fn translate_parts(timezone: &str, ui_language: &str, tz_parts: &TimezoneIdParts) -> Vec<String> {
    timezone
        .split('/')
        .map(|part| {
            tz_parts
                .localize_part(part, ui_language)
                .unwrap_or(part.to_owned())
        })
        .collect()
}

fn translate_country(
    timezone: &str,
    lang: &str,
    countries: &HashMap<String, String>,
    territories: &Territories,
) -> Option<String> {
    let tz = match timezone {
        "Asia/Rangoon" => "Asia/Yangon",
        "Europe/Kiev" => "Europe/Kyiv",
        _ => timezone,
    };
    let country_id = countries.get(tz)?;
    let territory = territories.find_by_id(country_id)?;
    let name = territory.names.name_for(lang)?;
    Some(name)
}

#[cfg(test)]
mod tests {
    use super::TimezonesDatabase;

    #[test]
    fn test_read_timezones() {
        let mut db = TimezonesDatabase::new();
        db.read("es").unwrap();
        let found_timezones = db.entries();
        dbg!(&found_timezones);
        let found = found_timezones
            .iter()
            .find(|tz| tz.code == "Europe/Berlin")
            .unwrap();
        assert_eq!(&found.code, "Europe/Berlin");
        assert_eq!(
            found.parts,
            vec!["Europa".to_string(), "Berlín".to_string()]
        );
        assert_eq!(found.country, Some("Alemania".to_string()));
    }

    #[test]
    fn test_read_timezone_without_country() {
        let mut db = TimezonesDatabase::new();
        db.read("es").unwrap();
        let timezone = db
            .entries()
            .into_iter()
            .find(|tz| tz.code == "UTC")
            .unwrap();
        assert_eq!(timezone.country, None);
    }

    #[test]
    fn test_read_kiev_country() {
        let mut db = TimezonesDatabase::new();
        db.read("en").unwrap();
        let timezone = db
            .entries()
            .into_iter()
            .find(|tz| tz.code == "Europe/Kiev")
            .unwrap();
        assert_eq!(timezone.country, Some("Ukraine".to_string()));
    }

    #[test]
    fn test_timezone_exists() {
        let mut db = TimezonesDatabase::new();
        db.read("es").unwrap();
        assert!(db.exists(&"Atlantic/Canary".to_string()));
        assert!(!db.exists(&"Unknown/Unknown".to_string()));
    }
}
