//! This module provides support for reading the timezones database.

use crate::error::Error;
use agama_locale_data::timezone_part::TimezoneIdParts;

/// Represents a timezone, including each part as localized.
#[derive(Debug)]
pub struct TimezoneEntry {
    /// Timezone identifier (e.g. "Atlantic/Canary").
    pub code: String,
    /// Localized parts (e.g., "Atlántico", "Canarias").
    pub parts: Vec<String>,
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
        let ret = timezones
            .into_iter()
            .map(|tz| {
                let parts = translate_parts(&tz, &ui_language, &tz_parts);
                TimezoneEntry { code: tz, parts }
            })
            .collect();
        Ok(ret)
    }
}

fn translate_parts(timezone: &str, ui_language: &str, tz_parts: &TimezoneIdParts) -> Vec<String> {
    timezone
        .split("/")
        .map(|part| {
            tz_parts
                .localize_part(part, &ui_language)
                .unwrap_or(part.to_owned())
        })
        .collect()
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
            .into_iter()
            .find(|tz| tz.code == "Europe/Berlin")
            .unwrap();
        assert_eq!(&found.code, "Europe/Berlin");
        assert_eq!(
            found.parts,
            vec!["Europa".to_string(), "Berlín".to_string()]
        )
    }

    #[test]
    fn test_timezone_exists() {
        let mut db = TimezonesDatabase::new();
        db.read("es").unwrap();
        assert!(db.exists(&"Atlantic/Canary".to_string()));
        assert!(!db.exists(&"Unknown/Unknown".to_string()));
    }
}
