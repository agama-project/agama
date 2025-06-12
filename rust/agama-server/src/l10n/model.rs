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

use std::process::Command;

use crate::error::Error;
use agama_locale_data::InvalidLocaleCode;
use agama_locale_data::{KeymapId, LocaleId};
use regex::Regex;

pub mod keyboard;
pub mod locale;
pub mod timezone;

pub use keyboard::Keymap;
pub use locale::LocaleEntry;
pub use timezone::TimezoneEntry;

use super::{helpers, LocaleError};
use keyboard::KeymapsDatabase;
use locale::LocalesDatabase;
use timezone::TimezonesDatabase;

pub struct L10n {
    pub timezone: String,
    pub timezones_db: TimezonesDatabase,
    pub locales: Vec<LocaleId>,
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

        let mut default_locale = ui_locale.clone();
        if !locales_db.exists(ui_locale) {
            // TODO: handle the case where the database is empty (not expected!)
            default_locale = locales_db.entries().first().unwrap().id.clone();
        };

        let mut timezones_db = TimezonesDatabase::new();
        timezones_db.read(&ui_locale.language)?;

        let mut default_timezone = DEFAULT_TIMEZONE.to_string();
        if !timezones_db.exists(&default_timezone) {
            default_timezone = timezones_db.entries().first().unwrap().code.to_string();
        };

        let mut keymaps_db = KeymapsDatabase::new();
        keymaps_db.read()?;

        let locale = Self {
            keymap: "us".parse().unwrap(),
            timezone: default_timezone,
            locales: vec![default_locale],
            locales_db,
            timezones_db,
            keymaps_db,
            ui_locale: ui_locale.clone(),
            ui_keymap: Self::ui_keymap()?,
        };

        Ok(locale)
    }

    pub fn set_locales(&mut self, locales: &Vec<String>) -> Result<(), LocaleError> {
        let locale_ids: Result<Vec<LocaleId>, InvalidLocaleCode> = locales
            .iter()
            .cloned()
            .map(|l| l.as_str().try_into())
            .collect();
        let locale_ids = locale_ids?;

        for loc in &locale_ids {
            if !self.locales_db.exists(loc) {
                return Err(LocaleError::UnknownLocale(loc.clone()));
            }
        }

        self.locales = locale_ids;
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

        self.ui_keymap = keymap_id;

        Command::new("/usr/bin/localectl")
            .args(["set-keymap", &self.ui_keymap.dashed()])
            .output()
            .map_err(LocaleError::Commit)?;
        Ok(())
    }

    // TODO: what should be returned value for commit?
    pub fn commit(&self) -> Result<(), LocaleError> {
        const ROOT: &str = "/mnt";

        let locale = self.locales.first().cloned().unwrap_or_default();
        let mut cmd = Command::new("/usr/bin/systemd-firstboot");
        cmd.args([
            "--root",
            ROOT,
            "--force",
            "--locale",
            &locale.to_string(),
            "--keymap",
            &self.keymap.dashed(),
            "--timezone",
            &self.timezone,
        ]);
        tracing::info!("{:?}", &cmd);

        let output = cmd.output()?;
        tracing::info!("{:?}", &output);

        Ok(())
    }

    fn ui_keymap() -> Result<KeymapId, LocaleError> {
        let output = Command::new("/usr/bin/localectl")
            .output()
            .map_err(LocaleError::Commit)?;
        let output = String::from_utf8_lossy(&output.stdout);

        let keymap_regexp = Regex::new(r"(?m)VC Kayout: (.+)$").unwrap();
        let captures = keymap_regexp.captures(&output);
        let keymap = captures
            .and_then(|c| c.get(1).map(|e| e.as_str()))
            .unwrap_or("us")
            .to_string();

        let keymap_id: KeymapId = keymap.parse().unwrap_or(KeymapId::default());
        Ok(keymap_id)
    }
}
