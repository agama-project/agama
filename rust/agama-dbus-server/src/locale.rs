use crate::error::Error;
use anyhow::Context;
use std::{fs::read_dir, process::Command};
use zbus::{dbus_interface, Connection};

pub struct Locale {
    locales: Vec<String>,
    keymap: String,
    timezone_id: String,
    supported_locales: Vec<String>,
    ui_locale: String,
}

#[dbus_interface(name = "org.opensuse.Agama1.Locale")]
impl Locale {
    /// Get labels for locales. The first pair is english language and territory
    /// and second one is localized one to target language from locale.
    ///
    // Can be `async` as well.
    // NOTE: check how often it is used and if often, it can be easily cached
    fn labels_for_locales(&self) -> Result<Vec<((String, String), (String, String))>, Error> {
        const DEFAULT_LANG: &str = "en";
        let mut res = Vec::with_capacity(self.supported_locales.len());
        let languages = agama_locale_data::get_languages()?;
        let territories = agama_locale_data::get_territories()?;
        for locale in self.supported_locales.as_slice() {
            let (loc_language, loc_territory) = agama_locale_data::parse_locale(locale.as_str())?;

            let language = languages
                .find_by_id(loc_language)
                .context("language for passed locale not found")?;
            let territory = territories
                .find_by_id(loc_territory)
                .context("territory for passed locale not found")?;

            let default_ret = (
                language
                    .names
                    .name_for(DEFAULT_LANG)
                    .context("missing default translation for language")?,
                territory
                    .names
                    .name_for(DEFAULT_LANG)
                    .context("missing default translation for territory")?,
            );
            let localized_ret = (
                language
                    .names
                    .name_for(language.id.as_str())
                    .context("missing native label for language")?,
                territory
                    .names
                    .name_for(language.id.as_str())
                    .context("missing native label for territory")?,
            );
            res.push((default_ret, localized_ret));
        }

        Ok(res)
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
        let entries = read_dir(DIR).context("Reading YaST2 locale")?;
        for entry in entries {
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
    pub fn new() -> Self {
        Self {
            locales: vec!["en_US.UTF-8".to_string()],
            keymap: "us".to_string(),
            timezone_id: "America/Los_Angeles".to_string(),
            supported_locales: vec!["en_US.UTF-8".to_string()],
            ui_locale: "en".to_string(),
        }
    }
}

impl Default for Locale {
    fn default() -> Self {
        Self::new()
    }
}

pub async fn start_service(connection: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    const PATH: &str = "/org/opensuse/Agama1/Locale";

    // When serving, request the service name _after_ exposing the main object
    let locale = Locale::new();
    connection.object_server().at(PATH, locale).await?;

    Ok(())
}
