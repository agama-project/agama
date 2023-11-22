use agama_locale_data::LocaleCode;
use crate::{error::Error, keyboard::Keymap};
use super::{helpers, keyboard::get_xkb_keymaps};
use anyhow::Context;
use std::{fs::read_dir, process::Command};
use zbus::{dbus_interface, Connection};

pub struct Locale {
    locales: Vec<String>,
    keymap: String,
    timezone_id: String,
    supported_locales: Vec<String>,
    ui_locale: String,
    keymaps: Vec<Keymap>,
}

#[dbus_interface(name = "org.opensuse.Agama1.Locale")]
impl Locale {
    /// Gets the supported locales information.
    ///
    /// Each element of the has these parts:
    ///
    /// * The locale code (e.g., "es_ES.UTF-8").
    /// * A pair composed by the language and the territory names in english
    ///   (e.g. ("Spanish", "Spain")).
    /// * A pair composed by the language and the territory names in its own language
    ///   (e.g. ("Español", "España")).
    ///
    // NOTE: check how often it is used and if often, it can be easily cached
    fn list_locales(&self) -> Result<Vec<(String, String, String)>, Error> {
        const DEFAULT_LANG: &str = "en";
        let mut result = Vec::with_capacity(self.supported_locales.len());
        let languages = agama_locale_data::get_languages()?;
        let territories = agama_locale_data::get_territories()?;
        for code in self.supported_locales.as_slice() {
            let Ok(loc) = TryInto::<LocaleCode>::try_into(code.as_str()) else {
                log::debug!("Ignoring locale code {}", &code);
                continue;
            };

            let ui_language = self
                .ui_locale
                .split_once("_")
                .map(|(l, _)| l)
                .unwrap_or(DEFAULT_LANG);

            let language = languages
                .find_by_id(&loc.language)
                .context("language not found")?;

            let names = &language.names;
            let language_label = names
                .name_for(&ui_language)
                .or_else(|| names.name_for(DEFAULT_LANG))
                .unwrap_or(language.id.to_string());

            let territory = territories
                .find_by_id(&loc.territory)
                .context("territory not found")?;

            let names = &territory.names;
            let territory_label = names
                .name_for(&ui_language)
                .or_else(|| names.name_for(DEFAULT_LANG))
                .unwrap_or(territory.id.to_string());

            result.push((code.clone(), language_label, territory_label))
        }

        Ok(result)
    }

    #[dbus_interface(property)]
    fn locales(&self) -> Vec<String> {
        self.locales.to_owned()
    }

    #[dbus_interface(property)]
    fn set_locales(&mut self, locales: Vec<String>) -> zbus::fdo::Result<()> {
        for loc in &locales {
            if !self.supported_locales.contains(loc) {
                return Err(zbus::fdo::Error::Failed(format!(
                    "Unsupported locale value '{loc}'"
                )));
            }
        }
        self.locales = locales;
        Ok(())
    }

    #[dbus_interface(property)]
    fn supported_locales(&self) -> Vec<String> {
        self.supported_locales.to_owned()
    }

    #[dbus_interface(property)]
    fn set_supported_locales(&mut self, locales: Vec<String>) -> Result<(), zbus::fdo::Error> {
        self.supported_locales = locales;
        // TODO: handle if current selected locale contain something that is no longer supported
        Ok(())
    }

    #[dbus_interface(property, name = "UILocale")]
    fn ui_locale(&self) -> &str {
        &self.ui_locale
    }

    #[dbus_interface(property, name = "UILocale")]
    fn set_ui_locale(&mut self, locale: &str) {
        self.ui_locale = locale.to_string();
        helpers::set_service_locale(locale);
    }

    /// Gets list of locales available on system.
    ///
    /// # Examples
    ///
    /// ```
    ///   use agama_dbus_server::locale::Locale;
    ///   let locale = Locale::new();
    ///   assert!(locale.list_ui_locales().unwrap().len() > 0);
    /// ```
    #[dbus_interface(name = "ListUILocales")]
    pub fn list_ui_locales(&self) -> Result<Vec<String>, Error> {
        // english is always available ui localization
        let mut result = vec!["en".to_string()];
        const DIR: &str = "/usr/share/YaST2/locale/";
        let entries = read_dir(DIR);
        if entries.is_err() {
            // if dir is not there act like if it is empty
            return Ok(result);
        }

        for entry in entries.unwrap() {
            let entry = entry.context("Failed to read entry in YaST2 locale dir")?;
            let name = entry
                .file_name()
                .to_str()
                .context("Non valid UTF entry found in YaST2 locale dir")?
                .to_string();
            result.push(name)
        }

        Ok(result)
    }

    /* support only keymaps for console for now
        fn list_x11_keyboards(&self) -> Result<Vec<(String, String)>, Error> {
            let keyboards = agama_locale_data::get_xkeyboards()?;
            let ret = keyboards
                .keyboard.iter()
                .map(|k| (k.id.clone(), k.description.clone()))
                .collect();
            Ok(ret)
        }

        fn set_x11_keyboard(&mut self, keyboard: &str) {
            self.keyboard_id = keyboard.to_string();
        }
    */

    #[dbus_interface(name = "ListVConsoleKeyboards")]
    fn list_keyboards(&self) -> Result<Vec<String>, Error> {
        let res = agama_locale_data::get_key_maps()?;
        Ok(res)
    }

    #[dbus_interface(name = "ListKeymaps")]
    fn list_keymaps(&self) -> Result<Vec<(String, String)>, Error> {
        let keymaps = self
            .keymaps
            .iter()
            .map(|k| (k.id(), k.localized_description()))
            .collect();
        Ok(keymaps)
    }

    #[dbus_interface(property, name = "VConsoleKeyboard")]
    fn keymap(&self) -> &str {
        self.keymap.as_str()
    }

    #[dbus_interface(property, name = "VConsoleKeyboard")]
    fn set_keymap(&mut self, keyboard: &str) -> Result<(), zbus::fdo::Error> {
        let exist = agama_locale_data::get_key_maps()
            .unwrap()
            .iter()
            .any(|k| k == keyboard);
        if !exist {
            return Err(zbus::fdo::Error::Failed(
                "Invalid keyboard value".to_string(),
            ));
        }
        self.keymap = keyboard.to_string();
        Ok(())
    }

    fn list_timezones(&self, locale: &str) -> Result<Vec<(String, String)>, Error> {
        let timezones = agama_locale_data::get_timezones();
        let localized =
            agama_locale_data::get_timezone_parts()?.localize_timezones(locale, &timezones);
        let ret = timezones.into_iter().zip(localized.into_iter()).collect();
        Ok(ret)
    }

    #[dbus_interface(property)]
    fn timezone(&self) -> &str {
        self.timezone_id.as_str()
    }

    #[dbus_interface(property)]
    fn set_timezone(&mut self, timezone: &str) -> Result<(), zbus::fdo::Error> {
        // NOTE: cannot use crate::Error as property expect this one
        self.timezone_id = timezone.to_string();
        Ok(())
    }

    // TODO: what should be returned value for commit?
    fn commit(&mut self) -> Result<(), Error> {
        const ROOT: &str = "/mnt";
        Command::new("/usr/bin/systemd-firstboot")
            .args([
                "root",
                ROOT,
                "--locale",
                self.locales.first().context("missing locale")?.as_str(),
            ])
            .status()
            .context("Failed to execute systemd-firstboot")?;
        Command::new("/usr/bin/systemd-firstboot")
            .args(["root", ROOT, "--keymap", self.keymap.as_str()])
            .status()
            .context("Failed to execute systemd-firstboot")?;
        Command::new("/usr/bin/systemd-firstboot")
            .args(["root", ROOT, "--timezone", self.timezone_id.as_str()])
            .status()
            .context("Failed to execute systemd-firstboot")?;

        Ok(())
    }
}

impl Locale {
    pub fn from_system() -> Result<Self, Error> {
        let result = Command::new("/usr/bin/localectl")
            .args(["list-locales"])
            .output()
            .context("Failed to get the list of locales")?;
        let output =
            String::from_utf8(result.stdout).context("Invalid UTF-8 sequence from list-locales")?;
        let supported: Vec<String> = output.lines().map(|s| s.to_string()).collect();
        Ok(Self {
            supported_locales: supported,
            keymaps: get_xkb_keymaps(),
            ..Default::default()
        })
    }

    pub fn init(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        Ok(())
    }
}

impl Default for Locale {
    fn default() -> Self {
        Self {
            locales: vec!["en_US.UTF-8".to_string()],
            keymap: "us".to_string(),
            timezone_id: "America/Los_Angeles".to_string(),
            supported_locales: vec!["en_US.UTF-8".to_string(), "es_ES.UTF-8".to_string()],
            ui_locale: "en".to_string(),
            keymaps: vec![]
        }
    }
}

pub async fn export_dbus_objects(
    connection: &Connection,
) -> Result<(), Box<dyn std::error::Error>> {
    const PATH: &str = "/org/opensuse/Agama1/Locale";

    // When serving, request the service name _after_ exposing the main object
    let locale = Locale::from_system()?;
    connection.object_server().at(PATH, locale).await?;

    Ok(())
}
