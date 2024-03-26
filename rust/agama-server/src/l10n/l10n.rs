use crate::error::Error;
use agama_locale_data::{KeymapId, LocaleId};

use super::keyboard::KeymapsDatabase;
use super::locale::LocalesDatabase;
use super::timezone::TimezonesDatabase;
use regex::Regex;
use std::{io, process::Command};

pub struct L10n {
    pub timezone: String,
    pub timezones_db: TimezonesDatabase,
    pub locales: Vec<String>,
    pub locales_db: LocalesDatabase,
    pub keymap: KeymapId,
    pub keymaps_db: KeymapsDatabase,
    pub ui_locale: LocaleId,
    pub ui_keymap: KeymapId,
}

impl L10n {
    pub fn new_with_locale(ui_locale: &LocaleId) -> Result<Self, Error> {
        const DEFAULT_TIMEZONE: &str = "Europe/Berlin";

        let locale = ui_locale.to_string();
        let mut locales_db = LocalesDatabase::new();
        locales_db.read(&locale)?;

        let mut default_locale = ui_locale.to_string();
        if !locales_db.exists(locale.as_str()) {
            // TODO: handle the case where the database is empty (not expected!)
            default_locale = locales_db.entries().first().unwrap().id.to_string();
        };

        let mut timezones_db = TimezonesDatabase::new();
        timezones_db.read(&ui_locale.language)?;

        let mut default_timezone = DEFAULT_TIMEZONE.to_string();
        if !timezones_db.exists(&default_timezone) {
            default_timezone = timezones_db.entries().first().unwrap().code.to_string();
        };

        let mut keymaps_db = KeymapsDatabase::new();
        keymaps_db.read()?;

        let ui_keymap = Self::x11_keymap().unwrap_or("us".to_string());

        let locale = Self {
            keymap: "us".parse().unwrap(),
            timezone: default_timezone,
            locales: vec![default_locale],
            locales_db,
            timezones_db,
            keymaps_db,
            ui_locale: ui_locale.clone(),
            ui_keymap: ui_keymap.parse().unwrap_or_default(),
        };

        Ok(locale)
    }

    pub fn translate(&mut self, locale: &LocaleId) -> Result<(), Error> {
        self.timezones_db.read(&locale.language)?;
        self.locales_db.read(&locale.language)?;
        self.ui_locale = locale.clone();
        Ok(())
    }

    fn x11_keymap() -> Result<String, io::Error> {
        let output = Command::new("setxkbmap")
            .arg("-query")
            .env("DISPLAY", ":0")
            .output()?;
        let output = String::from_utf8(output.stdout)
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;

        let keymap_regexp = Regex::new(r"(?m)^layout: (.+)$").unwrap();
        let captures = keymap_regexp.captures(&output);
        let keymap = captures
            .and_then(|c| c.get(1).map(|e| e.as_str()))
            .unwrap_or("us")
            .to_string();

        Ok(keymap)
    }
}
