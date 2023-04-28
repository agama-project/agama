use crate::error::Error;
use anyhow::Context;
use std::process::Command;
use zbus::{dbus_interface, Connection, ConnectionBuilder};

pub struct Locale {
    locales: Vec<String>,
    keymap: String,
    timezone_id: String,
    supported_locales: Vec<String>,
}

#[dbus_interface(name = "org.opensuse.Agama.Locale1")]
impl Locale {
    // Can be `async` as well.
    /// get labels for given locale. The first pair is english language and territory
    /// and second one is localized one to target language from locale.
    ///
    /// Note: check how often it is used and if often, it can be easily cached
    fn labels_for_locales(&self) -> Result<Vec<((String, String), (String, String))>, Error> {
        const DEFAULT_LANG: &str = "en";
        let mut res = Vec::with_capacity(self.supported_locales.len());
        for locale in self.supported_locales.as_slice() {
            let (loc_language, loc_territory) = agama_locale_data::parse_locale(locale.as_str())?;
            let languages = agama_locale_data::get_languages()?;
            let territories = agama_locale_data::get_territories()?;
            let language = languages
                .language
                .iter()
                .find(|l| l.id == loc_language)
                .context("language for passed locale not found")?;
            let territory = territories
                .territory
                .iter()
                .find(|t| t.id == loc_territory)
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
        return self.locales.to_owned();
    }

    #[dbus_interface(property)]
    fn set_locales(&mut self, locales: Vec<String>) -> Result<(), zbus::fdo::Error> {
        // verify that all locales are supported
        self.locales = locales;
        Ok(())
    }

    #[dbus_interface(property)]
    fn supported_locales(&self) -> Vec<String> {
        return self.supported_locales.to_owned();
    }

    #[dbus_interface(property)]
    fn set_supported_locales(&mut self, locales: Vec<String>) -> Result<(), zbus::fdo::Error> {
        self.supported_locales = locales;
        // TODO: handle if current selected locale contain something that is no longer supported
        Ok(())
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

    #[dbus_interface(name="ListVConsoleKeyboards")]
    fn list_keyboards(&self) -> Result<Vec<String>, Error> {
        let res = agama_locale_data::get_key_maps()?;
        Ok(res)
    }

    #[dbus_interface(property, name="VConsoleKeyboard")]
    fn keymap(&self) -> &str {
        return &self.keymap.as_str();
    }

    #[dbus_interface(property, name="VConsoleKeyboard")]
    fn set_keymap(&mut self, keyboard: &str) -> Result<(), zbus::fdo::Error> {
        let exist = agama_locale_data::get_key_maps().unwrap().iter().find(|&k| k == keyboard).is_some();
        if !exist {
            return Err(zbus::fdo::Error::Failed("Invalid keyboard value".to_string()))
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
        return &self.timezone_id.as_str();
    }

    #[dbus_interface(property)]
    fn set_timezone(&mut self, timezone: &str) -> Result<(), zbus::fdo::Error> { // NOTE: cannot use crate::Error as property expect this one
        self.timezone_id = timezone.to_string();
        Ok(())
    }

    // TODO: what should be returned value for commit?
    fn commit(&mut self) -> Result<(), Error> {
        const ROOT: &str = "/mnt";
        Command::new("/usr/bin/systemd-firstboot")
            .args(["root", ROOT, "--locale", self.locales.first().context("missing locale")?.as_str()])
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
    fn new() -> Locale {
        Locale {
            locales: vec!["en_US.UTF-8".to_string()],
            keymap: "us".to_string(),
            timezone_id: "America/Los_Angeles".to_string(),
            supported_locales: vec!["en_US.UTF-8".to_string()],
        }
    }

    pub async fn start_service() -> Result<Connection, Box<dyn std::error::Error>> {
        const SERVICE_NAME: &str = "org.opensuse.Agama.Locale1";

        let locale = Locale::new();
        let conn = ConnectionBuilder::session()? //TODO: use agama bus instead of session one
            .name(SERVICE_NAME)?
            .serve_at("/org/opensuse/Agama/Locale1", locale)?
            .build()
            .await
            .context(format!("Requesting name {SERVICE_NAME}"))?;

        Ok(conn)
    }
}

