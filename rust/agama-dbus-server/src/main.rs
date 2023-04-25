pub mod error;
use crate::error::Error;

use std::future::pending;
use zbus::{ConnectionBuilder, dbus_interface};

struct Locale {
    locale_id: String,
    keyboard_id: String,
    timezone_id: String
}

#[dbus_interface(name = "org.opensuse.Agama.Locale1")]
impl Locale {
    // Can be `async` as well.
    fn list_locales(&self) -> Result<Vec<(String, String,String,Vec<String>)>, Error> {
        let locales = agama_locale_data::get_languages();
        let res = locales?.language.iter()
            .map(|l| (l.id.clone(), l.names.name_for("en").unwrap_or_default(),
                l.names.name_for(l.id.as_str()).unwrap_or_default(),
                l.locales.locale.iter().map(|l| l.id.to_owned()).collect()))
             // filter out missing translations as language that does not translate itself is very minor
            .filter(|r| r.1 != "" && r.2 != "")
            .collect()

        Ok(ret)
    }

    fn set_locale(&mut self, locale: &str) {
        self.locale_id = locale.to_string();
    }

    fn list_x11_keyboards(&self) -> Result<Vec<(String, String)>, Error> {
        let keyboards = agama_locale_data::get_keyboards()?;
        let ret = keyboards
            .keyboard.iter()
            .map(|k| (k.id.clone(), k.description.clone()))
            .collect();
        Ok(ret)
    }

    fn set_x11_keyboard(&mut self, keyboard: &str) {
        self.keyboard_id = keyboard.to_string();
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
}

// Although we use `async-std` here, you can use any async runtime of choice.
#[async_std::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let locale = Locale { locale_id: "en".to_string(), keyboard_id: "us".to_string(), timezone_id: "Europe/Prague".to_string() };
    let _conn = ConnectionBuilder::session()? //TODO: use agama bus instead of session one
        .name("org.opensuse.Agama.Locale1")?
        .serve_at("/org/opensuse/Agama/Locale1", locale)?
        .build()
        .await?;

    // Do other things or go to wait forever
    pending::<()>().await;

    Ok(())
}
