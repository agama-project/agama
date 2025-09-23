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

mod keyboard;
pub use keyboard::Keymap;
pub use keyboard::KeymapsDatabase;

mod locale;
pub use locale::LocaleEntry;
pub use locale::LocalesDatabase;

mod timezone;
pub use timezone::TimezoneEntry;
pub use timezone::TimezonesDatabase;

use crate::{helpers, service};
use agama_locale_data::{KeymapId, LocaleId, TimezoneId};
use regex::Regex;
use std::io::Write;
use std::process::Command;
use std::{env, fs::OpenOptions};

pub trait ModelAdapter: Send {
    fn locales_db(&mut self) -> &mut LocalesDatabase;
    fn timezones_db(&mut self) -> &mut TimezonesDatabase;
    fn keymaps_db(&mut self) -> &mut KeymapsDatabase;
    fn locale(&self) -> LocaleId;
    fn keymap(&self) -> Result<KeymapId, service::Error>;

    fn set_locale(&mut self, _locale: LocaleId) -> Result<(), service::Error> {
        Ok(())
    }

    fn set_keymap(&mut self, _keymap: KeymapId) -> Result<(), service::Error> {
        Ok(())
    }

    fn install(
        &self,
        _locale: LocaleId,
        _keymap: KeymapId,
        _timezone: TimezoneId,
    ) -> Result<(), service::Error> {
        Ok(())
    }
}

pub struct Model {
    pub timezones_db: TimezonesDatabase,
    pub locales_db: LocalesDatabase,
    pub keymaps_db: KeymapsDatabase,
}

impl Model {
    pub fn new() -> Self {
        Self {
            locales_db: LocalesDatabase::new(),
            timezones_db: TimezonesDatabase::new(),
            keymaps_db: KeymapsDatabase::new(),
        }
    }

    pub fn from_system() -> Result<Self, service::Error> {
        let mut model = Self::new();
        model.read(&model.locale())?;
        Ok(model)
    }

    fn read(&mut self, locale: &LocaleId) -> Result<(), service::Error> {
        let mut locales_db = LocalesDatabase::new();
        locales_db.read(&locale.language)?;

        let mut timezones_db = TimezonesDatabase::new();
        timezones_db.read(&locale.language)?;

        let mut keymaps_db = KeymapsDatabase::new();
        keymaps_db.read()?;

        Ok(())
    }
}

impl ModelAdapter for Model {
    fn locales_db(&mut self) -> &mut LocalesDatabase {
        &mut self.locales_db
    }
    fn timezones_db(&mut self) -> &mut TimezonesDatabase {
        &mut self.timezones_db
    }

    fn keymaps_db(&mut self) -> &mut KeymapsDatabase {
        &mut self.keymaps_db
    }

    fn keymap(&self) -> Result<KeymapId, service::Error> {
        let output = Command::new("localectl").output()?;
        let output = String::from_utf8_lossy(&output.stdout);

        let keymap_regexp = Regex::new(r"(?m)VC Keymap: (.+)$").unwrap();
        let captures = keymap_regexp.captures(&output);
        let keymap = captures
            .and_then(|c| c.get(1).map(|e| e.as_str()))
            .unwrap_or("us")
            .to_string();

        let keymap_id: KeymapId = keymap.parse().unwrap_or(KeymapId::default());
        Ok(keymap_id)
    }

    // FIXME: we could use D-Bus to read the locale and the keymap (see ui_keymap).
    fn locale(&self) -> LocaleId {
        let lang = env::var("LANG")
            .ok()
            .map(|v| v.parse::<LocaleId>().ok())
            .flatten();
        lang.unwrap_or(LocaleId::default())
    }

    fn set_locale(&mut self, locale: LocaleId) -> Result<(), service::Error> {
        helpers::set_service_locale(&locale);
        self.timezones_db().read(&locale.language)?;
        self.locales_db().read(&locale.language)?;
        Ok(())
    }

    fn set_keymap(&mut self, keymap: KeymapId) -> Result<(), service::Error> {
        if !self.keymaps_db.exists(&keymap) {
            return Err(service::Error::UnknownKeymap(keymap));
        }

        Command::new("localectl")
            .args(["set-keymap", &keymap.dashed()])
            .output()?;
        Ok(())
    }

    fn install(
        &self,
        locale: LocaleId,
        keymap: KeymapId,
        timezone: TimezoneId,
    ) -> Result<(), service::Error> {
        const ROOT: &str = "/mnt";
        const VCONSOLE_CONF: &str = "/etc/vconsole.conf";

        let mut cmd = Command::new("/usr/bin/systemd-firstboot");
        cmd.args([
            "--root",
            ROOT,
            "--force",
            "--locale",
            &locale.to_string(),
            "--keymap",
            &keymap.dashed(),
            "--timezone",
            &timezone.to_string(),
        ]);
        tracing::info!("{:?}", &cmd);

        let output = cmd.output()?;
        tracing::info!("{:?}", &output);

        // unfortunately the console font cannot be set via the "systemd-firstboot" tool,
        // we need to write it directly to the config file
        if let Some(entry) = self.locales_db.find_locale(&locale) {
            if let Some(font) = &entry.consolefont {
                // the font entry is missing in a file created by "systemd-firstboot", just append it at the end
                let mut file = OpenOptions::new()
                    .append(true)
                    .open(format!("{}{}", ROOT, VCONSOLE_CONF))?;

                tracing::info!("Configuring console font \"{:?}\"", font);
                writeln!(file, "\nFONT={}.psfu", font)?;
            }
        }

        Ok(())
    }
}
