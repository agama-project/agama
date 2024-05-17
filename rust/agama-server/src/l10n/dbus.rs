use std::sync::{Arc, RwLock};

use agama_locale_data::{KeymapId, LocaleId};
use zbus::{dbus_interface, Connection};

use super::L10n;

struct L10nInterface {
    backend: Arc<RwLock<L10n>>,
}

#[dbus_interface(name = "org.opensuse.Agama1.Locale")]
impl L10nInterface {
    #[dbus_interface(property)]
    pub fn locales(&self) -> Vec<String> {
        let backend = self.backend.read().unwrap();
        backend.locales.to_owned()
    }

    #[dbus_interface(property)]
    pub fn set_locales(&mut self, locales: Vec<String>) -> zbus::fdo::Result<()> {
        let mut backend = self.backend.write().unwrap();
        if locales.is_empty() {
            return Err(zbus::fdo::Error::Failed(
                "The locales list cannot be empty".to_string(),
            ));
        }
        backend.set_locales(&locales).map_err(|e| {
            zbus::fdo::Error::Failed(format!("Could not set the locales: {}", e))
        })?;
        Ok(())
    }

    #[dbus_interface(property, name = "UILocale")]
    pub fn ui_locale(&self) -> String {
        let backend = self.backend.read().unwrap();
        backend.ui_locale.to_string()
    }

    #[dbus_interface(property, name = "UILocale")]
    pub fn set_ui_locale(&mut self, locale: &str) -> zbus::fdo::Result<()> {
        let mut backend = self.backend.write().unwrap();
        let locale: LocaleId = locale
            .try_into()
            .map_err(|_e| zbus::fdo::Error::Failed(format!("Invalid locale value '{locale}'")))?;
        Ok(backend.translate(&locale)?)
    }

    #[dbus_interface(property)]
    pub fn keymap(&self) -> String {
        let backend = self.backend.read().unwrap();
        backend.keymap.to_string()
    }

    #[dbus_interface(property)]
    fn set_keymap(&mut self, keymap_id: &str) -> Result<(), zbus::fdo::Error> {
        let mut backend = self.backend.write().unwrap();
        let keymap_id: KeymapId = keymap_id
            .parse()
            .map_err(|_e| zbus::fdo::Error::InvalidArgs("Cannot parse keymap ID".to_string()))?;

        backend.set_keymap(keymap_id).map_err(|e| {
            zbus::fdo::Error::Failed(format!("Could not set the keymap: {}", e))
        })?;

        Ok(())
    }

    #[dbus_interface(property)]
    pub fn timezone(&self) -> String {
        let backend = self.backend.read().unwrap();
        backend.timezone.clone()
    }

    #[dbus_interface(property)]
    pub fn set_timezone(&mut self, timezone: &str) -> Result<(), zbus::fdo::Error> {
        let mut backend = self.backend.write().unwrap();

        backend.set_timezone(timezone).map_err(|e| {
            zbus::fdo::Error::Failed(format!("Could not set the timezone: {}", e))
        })?;
        Ok(())
    }

    // TODO: what should be returned value for commit?
    pub fn commit(&mut self) -> zbus::fdo::Result<()> {
        let backend = self.backend.read().unwrap();

        backend.commit().map_err(|e| {
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
    let backend = L10n::new_with_locale(locale)?;
    let locale_iface = L10nInterface {
        backend: Arc::new(RwLock::new(backend)),
    };
    connection.object_server().at(PATH, locale_iface).await?;

    Ok(())
}
