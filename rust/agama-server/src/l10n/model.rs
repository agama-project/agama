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

use std::env;
use std::io;
use std::process::Command;
use std::time::Duration;

use crate::error::Error;
use agama_locale_data::InvalidLocaleCode;
use agama_locale_data::{KeymapId, LocaleId};
use regex::Regex;
use subprocess::{Popen, PopenConfig, PopenError, Redirection};

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

// timeout for the setxkbmap call (in seconds), when there is an authentication
// problem when accessing the X server then it enters an infinite loop
const SETXKBMAP_TIMEOUT: u64 = 3;

// helper function which runs a command with timeout and collects it's standard
// output
fn run_with_timeout(cmd: &[&str], timeout: u64) -> Result<Option<String>, PopenError> {
    // start the subprocess
    let mut process = Popen::create(
        cmd,
        PopenConfig {
            stdout: Redirection::Pipe,
            stderr: Redirection::Pipe,
            ..Default::default()
        },
    )?;

    // wait for it to finish or until the timeout is reached
    if process
        .wait_timeout(Duration::from_secs(timeout))?
        .is_none()
    {
        tracing::warn!("Command {:?} timed out!", cmd);
        // if the process is still running after the timeout then terminate it,
        // ignore errors, there is another attempt later to kill the process
        let _ = process.terminate();

        // give the process some time to react to SIGTERM
        if process.wait_timeout(Duration::from_secs(1))?.is_none() {
            // process still running, kill it with SIGKILL
            process.kill()?;
        }

        return Err(PopenError::LogicError("Timeout reached"));
    }

    // get the collected stdout/stderr
    let (out, err) = process.communicate(None)?;

    if let Some(err_str) = err {
        if !err_str.is_empty() {
            tracing::warn!("Error output size: {}", err_str.len());
        }
    }

    Ok(out)
}

// the default X display to use if not configured or when X forwarding is used
fn default_display() -> String {
    String::from(":0")
}

// helper function to get the X display name, if not set it returns the default display
fn display() -> String {
    let display = env::var("DISPLAY");

    match display {
        Ok(display) => {
            // use the $DISPLAY value only when it is a local X server
            if display.starts_with(':') {
                display
            } else {
                // when using SSH X forwarding (e.g. "localhost:10.0") we could
                // accidentally change the configuration of the remote X server,
                // in that case try using the local X server if it is available
                default_display()
            }
        }
        Err(_) => default_display(),
    }
}

impl L10n {
    pub fn new_with_locale(ui_locale: &LocaleId) -> Result<Self, Error> {
        const DEFAULT_TIMEZONE: &str = "Europe/Berlin";

        let locale = ui_locale.to_string();
        let mut locales_db = LocalesDatabase::new();
        locales_db.read(&locale)?;

        let mut default_locale = ui_locale.clone();
        if !locales_db.exists(&ui_locale) {
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

        let output = run_with_timeout(
            &[
                "setxkbmap",
                "-display",
                &display(),
                &self.ui_keymap.to_string(),
            ],
            SETXKBMAP_TIMEOUT,
        );
        output.map_err(|e| {
            LocaleError::Commit(io::Error::new(io::ErrorKind::Other, e.to_string()))
        })?;

        Ok(())
    }

    // TODO: what should be returned value for commit?
    pub fn commit(&self) -> Result<(), LocaleError> {
        const ROOT: &str = "/mnt";

        let locale = self.locales.first().cloned().unwrap_or_default();
        Command::new("/usr/bin/systemd-firstboot")
            .args([
                "--root",
                ROOT,
                "--force",
                "--locale",
                &locale.to_string(),
                "--keymap",
                &self.keymap.dashed(),
                "--timezone",
                &self.timezone,
            ])
            .status()?;
        Ok(())
    }

    fn x11_keymap() -> Result<String, io::Error> {
        let output = run_with_timeout(
            &["setxkbmap", "-query", "-display", &display()],
            SETXKBMAP_TIMEOUT,
        );
        let output = output.map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
        let output = output.unwrap_or(String::new());

        let keymap_regexp = Regex::new(r"(?m)^layout: (.+)$").unwrap();
        let captures = keymap_regexp.captures(&output);
        let keymap = captures
            .and_then(|c| c.get(1).map(|e| e.as_str()))
            .unwrap_or("us")
            .to_string();

        Ok(keymap)
    }
}
