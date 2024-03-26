use std::process::Command;

use agama_locale_data::{KeymapId, LocaleId};
use zbus::{dbus_interface, Connection};

use super::{helpers, Locale};

#[dbus_interface(name = "org.opensuse.Agama1.Locale")]
impl Locale {
    #[dbus_interface(property)]
    pub fn locales(&self) -> Vec<String> {
        self.locales.to_owned()
    }

    #[dbus_interface(property)]
    pub fn set_locales(&mut self, locales: Vec<String>) -> zbus::fdo::Result<()> {
        if locales.is_empty() {
            return Err(zbus::fdo::Error::Failed(
                "The locales list cannot be empty".to_string(),
            ));
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
    pub fn ui_locale(&self) -> String {
        self.ui_locale.to_string()
    }

    #[dbus_interface(property, name = "UILocale")]
    pub fn set_ui_locale(&mut self, locale: &str) -> zbus::fdo::Result<()> {
        let locale: LocaleId = locale
            .try_into()
            .map_err(|_e| zbus::fdo::Error::Failed(format!("Invalid locale value '{locale}'")))?;
        helpers::set_service_locale(&locale);
        Ok(self.translate(&locale)?)
    }

    #[dbus_interface(property)]
    pub fn keymap(&self) -> String {
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
    pub fn timezone(&self) -> &str {
        self.timezone.as_str()
    }

    #[dbus_interface(property)]
    pub fn set_timezone(&mut self, timezone: &str) -> Result<(), zbus::fdo::Error> {
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
    pub fn commit(&mut self) -> zbus::fdo::Result<()> {
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
