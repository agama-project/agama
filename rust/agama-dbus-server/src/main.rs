pub mod error;
use crate::error::Error;

use std::{future::pending, process::Command};
use agama_locale_data::{parse_locale};
use anyhow::Context;
use zbus::{ConnectionBuilder, dbus_interface};

struct Locale {
    locale: String,
    keymap: String,
    timezone_id: String
}

#[dbus_interface(name = "org.opensuse.Agama.Locale1")]
impl Locale {
    // Can be `async` as well.
    /// get labels for given locale. The first pair is english language and territory
    /// and second one is localized one to target language from locale.
    /// 
    fn labels_for_locale(&self, locale: &str) -> Result<((String, String), (String, String)), Error> {
        const DEFAULT_LANG : &str = "en";
        let (loc_language, loc_territory) = parse_locale(locale)?;
        let languages = agama_locale_data::get_languages()?;
        let territories = agama_locale_data::get_territories()?;
        let language = languages.language.iter()
            .find(|l| l.id == loc_language).context("language for passed locale not found")?;
        let territory = territories.territory.iter()
            .find(|t| t.id == loc_territory).context("territory for passed locale not found")?;

        let default_ret = (language.names.name_for(DEFAULT_LANG).context("missing default translation for language")?,
            territory.names.name_for(DEFAULT_LANG).context("missing default translation for territory")?);
        let localized_ret = (language.names.name_for(language.id.as_str()).context("missing default translation for language")?,
            territory.names.name_for(language.id.as_str()).context("missing default translation for territory")?);
        Ok((default_ret, localized_ret))        
    }

    fn set_locale(&mut self, locale: &str) {
        self.locale = locale.to_string();
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

    fn list_keyboards(&self) -> Result<Vec<String>, Error> {
        let res = agama_locale_data::get_key_maps()?;
        Ok(res)
    }

    fn set_keyboard(&mut self, keyboard: &str) {
        self.keymap = keyboard.to_string();
    }

    fn list_timezones(&self, locale: &str) -> Result<Vec<(String, String)>, Error> {
        let timezones = agama_locale_data::get_timezones();
        let localized = agama_locale_data::get_timezone_parts()?
            .localize_timezones(locale, &timezones);
        let ret = timezones.into_iter().zip(localized.into_iter()).collect();
        Ok(ret)
    }

    fn set_timezone(&mut self, timezone: &str) {
        self.timezone_id = timezone.to_string();
    }

    // TODO: what should be returned value for commit?
    fn commit(&mut self) -> Result<(), Error> {
        const ROOT : &str = "/mnt";
        Command::new("/usr/bin/systemd-firstboot")
            .args(["root", ROOT, "--locale", self.locale.as_str()])
            .status().context("Failed to execute systemd-firstboot")?;
        Command::new("/usr/bin/systemd-firstboot")
            .args(["root", ROOT, "--keymap", self.keymap.as_str()])
            .status().context("Failed to execute systemd-firstboot")?;
        Command::new("/usr/bin/systemd-firstboot")
            .args(["root", ROOT, "--timezone", self.timezone_id.as_str()])
            .status().context("Failed to execute systemd-firstboot")?;

        Ok(())
    }
}

// Although we use `async-std` here, you can use any async runtime of choice.
#[async_std::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let locale = Locale { locale: "en_US.UTF-8".to_string(), keymap: "us".to_string(), timezone_id: "Europe/Prague".to_string() };
    let _conn = ConnectionBuilder::session()? //TODO: use agama bus instead of session one
        .name("org.opensuse.Agama.Locale1")?
        .serve_at("/org/opensuse/Agama/Locale1", locale)?
        .build()
        .await?;

    // Do other things or go to wait forever
    pending::<()>().await;

    Ok(())
}
