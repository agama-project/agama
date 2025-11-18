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

//! This module provides support for reading the timezones database.

use agama_locale_data::{territory::Territories, timezone_part::TimezoneIdParts, TimezoneId};
use agama_utils::api::l10n::TimezoneEntry;
use std::collections::HashMap;

#[derive(Default)]
pub struct TimezonesDatabase {
    timezones: Vec<TimezoneEntry>,
}

impl TimezonesDatabase {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_entries(data: &[TimezoneEntry]) -> Self {
        Self {
            timezones: data.to_vec(),
        }
    }

    /// Initializes the list of known timezones.
    ///
    /// * `ui_language`: language to translate the descriptions (e.g., "en").
    pub fn read(&mut self, ui_language: &str) -> anyhow::Result<()> {
        self.timezones = self.get_timezones(ui_language)?;
        Ok(())
    }

    /// Determines whether a timezone exists in the database.
    pub fn exists(&self, timezone: &TimezoneId) -> bool {
        self.timezones.iter().any(|t| &t.id == timezone)
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
    fn get_timezones(&self, ui_language: &str) -> anyhow::Result<Vec<TimezoneEntry>> {
        let timezones = agama_locale_data::get_timezones();
        let tz_parts = agama_locale_data::get_timezone_parts()?;
        let territories = agama_locale_data::get_territories()?;
        let tz_countries = agama_locale_data::get_timezone_countries()?;
        const COUNTRYLESS: [&str; 2] = ["UTC", "Antarctica/South_Pole"];

        let ret = timezones
            .into_iter()
            .filter_map(|tz| {
                tz.parse::<TimezoneId>()
                    .inspect_err(|e| println!("Ignoring timezone {tz}: {e}"))
                    .ok()
            })
            .filter_map(|id| {
                let parts = translate_parts(id.as_str(), ui_language, &tz_parts);
                let country =
                    translate_country(id.as_str(), ui_language, &tz_countries, &territories);
                match country {
                    None if !COUNTRYLESS.contains(&id.as_str()) => None,
                    _ => Some(TimezoneEntry { id, parts, country }),
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
        let found = found_timezones
            .iter()
            .find(|tz| tz.id.as_str() == "Europe/Berlin")
            .unwrap();
        assert_eq!(found.id.as_str(), "Europe/Berlin");
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
            .iter()
            .find(|tz| tz.id.as_str() == "UTC")
            .unwrap();
        assert_eq!(timezone.country, None);
    }

    #[test]
    fn test_read_kiev_country() {
        let mut db = TimezonesDatabase::new();
        db.read("en").unwrap();
        let timezone = db
            .entries()
            .iter()
            .find(|tz| tz.id.as_str() == "Europe/Kiev")
            .unwrap();
        assert_eq!(timezone.country, Some("Ukraine".to_string()));
    }

    #[test]
    fn test_timezone_exists() {
        let mut db = TimezonesDatabase::new();
        db.read("es").unwrap();
        let canary = "Atlantic/Canary".parse().unwrap();
        let unknown = "Unknown/Unknown".parse().unwrap();
        assert!(db.exists(&canary));
        assert!(!db.exists(&unknown));
    }
}
