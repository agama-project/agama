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
pub use keyboard::KeymapsDatabase;

mod locale;
pub use locale::LocalesDatabase;

mod timezone;
pub use timezone::TimezonesDatabase;

use crate::{helpers, service};
use agama_locale_data::{KeymapId, LocaleId, TimezoneId};
use agama_utils::api::l10n::SystemInfo;
use regex::Regex;
use std::env;
use std::fs::OpenOptions;
use std::io::Write;
use std::process::Command;

/// Abstract the localization-related configuration from the underlying system.
///
/// It offers an API to query and set different localization elements of a
/// system. This trait can be implemented to replace the real system during
/// tests.
pub trait ModelAdapter: Send + 'static {
    /// Reads the system info.
    fn read_system_info(&self) -> SystemInfo {
        let locales = self.locales_db().entries().clone();
        let keymaps = self.keymaps_db().entries().clone();
        let timezones = self.timezones_db().entries().clone();

        SystemInfo {
            locales,
            keymaps,
            timezones,
            locale: self.locale(),
            keymap: self.keymap().unwrap(),
            timezone: Default::default(),
        }
    }

    /// Locales database.
    fn locales_db(&self) -> &LocalesDatabase;

    /// Timezones database.
    fn timezones_db(&self) -> &TimezonesDatabase;

    /// Keymaps database.
    fn keymaps_db(&self) -> &KeymapsDatabase;

    /// Current system locale.
    fn locale(&self) -> LocaleId;

    /// Current system keymap.
    fn keymap(&self) -> Result<KeymapId, service::Error>;

    /// Change the locale of the system.
    fn set_locale(&mut self, _locale: LocaleId) -> Result<(), service::Error> {
        Ok(())
    }

    /// Change the keymap of the system.
    fn set_keymap(&mut self, _keymap: KeymapId) -> Result<(), service::Error> {
        Ok(())
    }

    /// Apply the changes to target system. It is expected to be called almost
    /// at the end of the installation.
    fn install(
        &self,
        _locale: &LocaleId,
        _keymap: &KeymapId,
        _timezone: &TimezoneId,
    ) -> Result<(), service::Error> {
        Ok(())
    }
}

/// [ModelAdapter] implementation for systemd-based systems.
pub struct Model {
    pub timezones_db: TimezonesDatabase,
    pub locales_db: LocalesDatabase,
    pub keymaps_db: KeymapsDatabase,
}

impl Default for Model {
    fn default() -> Self {
        Self {
            locales_db: LocalesDatabase::new(),
            timezones_db: TimezonesDatabase::new(),
            keymaps_db: KeymapsDatabase::new(),
        }
    }
}

impl Model {
    /// Initializes the struct with the information from the underlying system.
    pub fn from_system() -> Result<Self, service::Error> {
        let mut model = Self::default();
        model.read(&model.locale())?;
        Ok(model)
    }

    fn read(&mut self, locale: &LocaleId) -> Result<(), service::Error> {
        self.locales_db.read(&locale.language)?;
        self.timezones_db.read(&locale.language)?;
        self.keymaps_db.read()?;

        Ok(())
    }
}

impl ModelAdapter for Model {
    fn locales_db(&self) -> &LocalesDatabase {
        &self.locales_db
    }
    fn timezones_db(&self) -> &TimezonesDatabase {
        &self.timezones_db
    }

    fn keymaps_db(&self) -> &KeymapsDatabase {
        &self.keymaps_db
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
            .and_then(|v| v.parse::<LocaleId>().ok());
        lang.unwrap_or_default()
    }

    fn set_locale(&mut self, locale: LocaleId) -> Result<(), service::Error> {
        if !self.locales_db.exists(&locale) {
            return Err(service::Error::UnknownLocale(locale));
        }

        Command::new("localectl")
            .args(["set-locale", &format!("LANG={}", locale)])
            .output()?;

        helpers::set_service_locale(&locale);
        self.timezones_db.read(&locale.language)?;
        self.locales_db.read(&locale.language)?;
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
        locale: &LocaleId,
        keymap: &KeymapId,
        timezone: &TimezoneId,
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
                    .open(format!("{ROOT}{VCONSOLE_CONF}"))?;

                tracing::info!("Configuring console font \"{:?}\"", font);
                writeln!(file, "\nFONT={font}.psfu")?;
            }
        }

        Ok(())
    }
}
