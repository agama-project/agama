//! Helpers functions
//!
//! FIXME: find a better place for the localization function

use gettextrs::{bind_textdomain_codeset, setlocale, textdomain, LocaleCategory};
use std::env;

/// Initializes the service locale.
///
/// It returns the used locale. Defaults to `en_US.UTF-8`.
pub fn init_locale() -> Result<String, Box<dyn std::error::Error>> {
    let locale = env::var("LANG").unwrap_or("en_US.UTF-8".to_owned());
    set_service_locale(&locale);
    textdomain("xkeyboard-config")?;
    bind_textdomain_codeset("xkeyboard-config", "UTF-8")?;
    Ok(locale)
}

pub fn set_service_locale(locale: &str) {
    if setlocale(LocaleCategory::LcAll, locale).is_none() {
        log::warn!("Could not set the locale");
    }
}
