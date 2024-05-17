use std::io;
use std::process::Command;

use crate::error::Error;
use agama_locale_data::{KeymapId, LocaleId};
use regex::Regex;

use super::keyboard::KeymapsDatabase;
use super::locale::LocalesDatabase;
use super::timezone::TimezonesDatabase;
use super::{helpers, LocaleError};

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

    pub fn set_locales(&mut self, locales: &Vec<String>) -> Result<(), LocaleError> {
        for loc in locales {
            if !self.locales_db.exists(loc.as_str()) {
                return Err(LocaleError::UnknownLocale(loc.to_string()))?;
            }
        }
        self.locales.clone_from(locales);
        Ok(())
    }

    pub fn set_timezone(&mut self, timezone: &str) -> Result<(), LocaleError> {
        // TODO: modify exists() to receive an `&str`
        if !self.timezones_db.exists(&timezone.to_string()) {
            return Err(LocaleError::UnknownTimezone(timezone.to_string()))?;
        }
        timezone.clone_into(&mut self.timezone);
        Ok(())
    }

    pub fn set_keymap(&mut self, keymap_id: KeymapId) -> Result<(), LocaleError> {
        if !self.keymaps_db.exists(&keymap_id) {
            return Err(LocaleError::UnknownKeymap(keymap_id));
        }

        self.keymap = keymap_id;
        Ok(())
    }

    // TODO: use LocaleError
    pub fn translate(&mut self, locale: &LocaleId) -> Result<(), Error> {
        helpers::set_service_locale(locale);
        self.timezones_db.read(&locale.language)?;
        self.locales_db.read(&locale.language)?;
        self.ui_locale = locale.clone();
        Ok(())
    }

    // TODO: use LocaleError
    pub fn set_ui_keymap(&mut self, keymap_id: KeymapId) -> Result<(), LocaleError> {
        if !self.keymaps_db.exists(&keymap_id) {
            return Err(LocaleError::UnknownKeymap(keymap_id));
        }

        let keymap = keymap_id.to_string();
        self.ui_keymap = keymap_id;

        Command::new("/usr/bin/localectl")
            .args(["set-x11-keymap", &keymap])
            .output()
            .map_err(LocaleError::Commit)?;
        Command::new("/usr/bin/setxkbmap")
            .arg(keymap)
            .env("DISPLAY", ":0")
            .output()
            .map_err(LocaleError::Commit)?;
        Ok(())
    }

    // TODO: what should be returned value for commit?
    pub fn commit(&self) -> Result<(), LocaleError> {
        const ROOT: &str = "/mnt";

        Command::new("/usr/bin/systemd-firstboot")
            .args([
                "--root",
                ROOT,
                "--force",
                "--locale",
                self.locales.first().unwrap_or(&"en_US.UTF-8".to_string()),
                "--keymap",
                &self.keymap.to_string(),
                "--timezone",
                &self.timezone,
            ])
            .status()?;
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
