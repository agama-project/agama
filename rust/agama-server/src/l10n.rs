pub mod helpers;
mod keyboard;
mod locale;
mod timezone;
pub mod web;

use crate::error::Error;
use agama_locale_data::{KeymapId, LocaleId};

use keyboard::KeymapsDatabase;
use locale::LocalesDatabase;
use regex::Regex;
use std::{io, process::Command};
use timezone::TimezonesDatabase;
use zbus::{dbus_interface, Connection};

pub use keyboard::Keymap;
pub use locale::LocaleEntry;
pub use timezone::TimezoneEntry;
pub use web::LocaleConfig;

pub struct Locale {
    timezone: String,
    timezones_db: TimezonesDatabase,
    locales: Vec<String>,
    pub locales_db: LocalesDatabase,
    keymap: KeymapId,
    keymaps_db: KeymapsDatabase,
    ui_locale: LocaleId,
    pub ui_keymap: KeymapId,
}

#[dbus_interface(name = "org.opensuse.Agama1.Locale")]
impl Locale {
    #[dbus_interface(property)]
    fn locales(&self) -> Vec<String> {
        self.locales.to_owned()
    }

    #[dbus_interface(property)]
    fn set_locales(&mut self, locales: Vec<String>) -> zbus::fdo::Result<()> {
        if locales.is_empty() {
            return Err(zbus::fdo::Error::Failed(format!(
                "The locales list cannot be empty"
            )));
        }
        for loc in &locales {
            if !self.locales_db.exists(loc.as_str()) {
                return Err(zbus::fdo::Error::Failed(format!(
                    "Unsupported locale value '{loc}'"
                )));
            }
        }
        self.locales = locales;
        Ok(())
    }

    #[dbus_interface(property, name = "UILocale")]
    fn ui_locale(&self) -> String {
        self.ui_locale.to_string()
    }

    #[dbus_interface(property, name = "UILocale")]
    fn set_ui_locale(&mut self, locale: &str) -> zbus::fdo::Result<()> {
        let locale: LocaleId = locale
            .try_into()
            .map_err(|_e| zbus::fdo::Error::Failed(format!("Invalid locale value '{locale}'")))?;
        helpers::set_service_locale(&locale);
        Ok(self.translate(&locale)?)
    }

    #[dbus_interface(property)]
    fn keymap(&self) -> String {
        self.keymap.to_string()
    }

    #[dbus_interface(property)]
    fn set_keymap(&mut self, keymap_id: &str) -> Result<(), zbus::fdo::Error> {
        let keymap_id: KeymapId = keymap_id
            .parse()
            .map_err(|_e| zbus::fdo::Error::InvalidArgs("Cannot parse keymap ID".to_string()))?;

        if !self.keymaps_db.exists(&keymap_id) {
            return Err(zbus::fdo::Error::Failed(
                "Cannot find this keymap".to_string(),
            ));
        }
        self.keymap = keymap_id;
        Ok(())
    }

    #[dbus_interface(property)]
    fn timezone(&self) -> &str {
        self.timezone.as_str()
    }

    #[dbus_interface(property)]
    fn set_timezone(&mut self, timezone: &str) -> Result<(), zbus::fdo::Error> {
        let timezone = timezone.to_string();
        if !self.timezones_db.exists(&timezone) {
            return Err(zbus::fdo::Error::Failed(format!(
                "Unsupported timezone value '{timezone}'"
            )));
        }
        self.timezone = timezone;
        Ok(())
    }

    // TODO: what should be returned value for commit?
    fn commit(&mut self) -> zbus::fdo::Result<()> {
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
            .status()
            .map_err(|e| {
                zbus::fdo::Error::Failed(format!("Could not apply the l10n configuration: {e}"))
            })?;

        Ok(())
    }
}

impl Locale {
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

pub async fn export_dbus_objects(
    connection: &Connection,
    locale: &LocaleId,
) -> Result<(), Box<dyn std::error::Error>> {
    const PATH: &str = "/org/opensuse/Agama1/Locale";

    // When serving, request the service name _after_ exposing the main object
    let locale_iface = Locale::new_with_locale(locale)?;
    connection.object_server().at(PATH, locale_iface).await?;

    Ok(())
}
