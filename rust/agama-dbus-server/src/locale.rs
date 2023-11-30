pub mod helpers;
mod keyboard;
mod locale;
mod timezone;

use crate::error::Error;
use agama_locale_data::KeymapId;
use anyhow::Context;
use keyboard::KeymapsDatabase;
use locale::LocalesDatabase;
use std::process::Command;
use timezone::TimezonesDatabase;
use zbus::{dbus_interface, Connection};

pub struct Locale {
    timezone: String,
    timezones_db: TimezonesDatabase,
    locales: Vec<String>,
    locales_db: LocalesDatabase,
    keymap: KeymapId,
    keymaps_db: KeymapsDatabase,
    ui_locale: String,
}

#[dbus_interface(name = "org.opensuse.Agama1.Locale")]
impl Locale {
    /// Gets the supported locales information.
    ///
    /// Each element of the list has these parts:
    ///
    /// * The locale code (e.g., "es_ES.UTF-8").
    /// * The name of the language according to the language defined by the
    ///   UILocale property.
    /// * The name of the territory according to the language defined by the
    ///   UILocale property.
    fn list_locales(&self) -> Result<Vec<(String, String, String)>, Error> {
        let locales = self
            .locales_db
            .entries()
            .iter()
            .map(|l| {
                (
                    l.code.to_string(),
                    l.language.to_string(),
                    l.territory.to_string(),
                )
            })
            .collect::<Vec<_>>();
        Ok(locales)
    }

    #[dbus_interface(property)]
    fn locales(&self) -> Vec<String> {
        self.locales.to_owned()
    }

    #[dbus_interface(property)]
    fn set_locales(&mut self, locales: Vec<String>) -> zbus::fdo::Result<()> {
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
    fn ui_locale(&self) -> &str {
        &self.ui_locale
    }

    #[dbus_interface(property, name = "UILocale")]
    fn set_ui_locale(&mut self, locale: &str) -> zbus::fdo::Result<()> {
        helpers::set_service_locale(locale);
        Ok(self.translate(locale)?)
    }

    /// Returns a list of the supported keymaps.
    ///
    /// Each element of the list contains:
    ///
    /// * The keymap identifier (e.g., "es" or "es(ast)").
    /// * The name of the keyboard in language set by the UILocale property.
    fn list_keymaps(&self) -> Result<Vec<(String, String)>, Error> {
        let keymaps = self
            .keymaps_db
            .entries()
            .iter()
            .map(|k| (k.id.to_string(), k.localized_description()))
            .collect();
        Ok(keymaps)
    }

    #[dbus_interface(property)]
    fn keymap(&self) -> String {
        self.keymap.to_string()
    }

    #[dbus_interface(property)]
    fn set_keymap(&mut self, keymap_id: &str) -> Result<(), zbus::fdo::Error> {
        let keymap_id: KeymapId = keymap_id
            .parse()
            .map_err(|_e| zbus::fdo::Error::InvalidArgs("Invalid keymap".to_string()))?;

        if !self.keymaps_db.exists(&keymap_id) {
            return Err(zbus::fdo::Error::Failed(
                "Invalid keymap value".to_string(),
            ));
        }
        self.keymap = keymap_id;
        Ok(())
    }

    /// Returns a list of the supported timezones.
    ///
    /// Each element of the list contains:
    ///
    /// * The timezone identifier (e.g., "Europe/Berlin").
    /// * A list containing each part of the name in the language set by the
    ///   UILocale property.
    fn list_timezones(&self) -> Result<Vec<(String, Vec<String>)>, Error> {
        let timezones: Vec<_> = self
            .timezones_db
            .entries()
            .iter()
            .map(|tz| (tz.code.to_string(), tz.parts.clone()))
            .collect();
        Ok(timezones)
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
    fn commit(&mut self) -> Result<(), Error> {
        const ROOT: &str = "/mnt";
        Command::new("/usr/bin/systemd-firstboot")
            .args([
                "--root",
                ROOT,
                "--locale",
                self.locales.first().context("missing locale")?.as_str(),
            ])
            .status()
            .context("Failed to execute systemd-firstboot")?;
        Command::new("/usr/bin/systemd-firstboot")
            .args(["--root", ROOT, "--keymap", &self.keymap.to_string()])
            .status()
            .context("Failed to execute systemd-firstboot")?;
        Command::new("/usr/bin/systemd-firstboot")
            .args(["--root", ROOT, "--timezone", self.timezone.as_str()])
            .status()
            .context("Failed to execute systemd-firstboot")?;

        Ok(())
    }
}

impl Locale {
    pub fn new_with_locale(locale: &str) -> Result<Self, Error> {
        let mut locales_db = LocalesDatabase::new();
        locales_db.read(&locale)?;
        let default_locale = locales_db.entries().get(0).unwrap();

        let mut timezones_db = TimezonesDatabase::new();
        timezones_db.read(&locale)?;
        let default_timezone = timezones_db.entries().get(0).unwrap();

        let mut keymaps_db = KeymapsDatabase::new();
        keymaps_db.read()?;

        let locale = Self {
            keymap: "us".parse().unwrap(),
            timezone: default_timezone.code.to_string(),
            locales: vec![default_locale.code.to_string()],
            locales_db,
            timezones_db,
            keymaps_db,
            ui_locale: locale.to_string(),
        };

        Ok(locale)
    }

    pub fn translate(&mut self, locale: &str) -> Result<(), Error> {
        self.ui_locale = locale.to_string();
        let language = locale.split_once("_").map(|(l, _)| l).unwrap_or("en");
        self.timezones_db.read(&language)?;
        self.locales_db.read(&language)?;
        self.ui_locale = locale.to_string();
        Ok(())
    }
}

pub async fn export_dbus_objects(
    connection: &Connection, locale: &str
) -> Result<(), Box<dyn std::error::Error>> {
    const PATH: &str = "/org/opensuse/Agama1/Locale";

    // When serving, request the service name _after_ exposing the main object
    let locale_iface = Locale::new_with_locale(locale)?;
    connection.object_server().at(PATH, locale_iface).await?;

    Ok(())
}
