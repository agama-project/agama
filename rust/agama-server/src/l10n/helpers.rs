//! Helpers functions
//!
//! FIXME: find a better place for the localization function

use agama_locale_data::LocaleId;
use gettextrs::{bind_textdomain_codeset, setlocale, textdomain, LocaleCategory};
use std::env;

/// Initializes the service locale.
///
/// It returns the used locale. Defaults to `en_US.UTF-8`.
pub fn init_locale() -> Result<LocaleId, Box<dyn std::error::Error>> {
    let lang = env::var("LANG").unwrap_or("en_US.UTF-8".to_string());
    let locale: LocaleId = lang.as_str().try_into().unwrap_or_default();

    set_service_locale(&locale);
    textdomain("xkeyboard-config")?;
    bind_textdomain_codeset("xkeyboard-config", "UTF-8")?;
    Ok(locale)
}

/// Sets the service locale.
///
pub fn set_service_locale(locale: &LocaleId) {
    if setlocale(LocaleCategory::LcAll, locale.to_string()).is_none() {
        log::warn!("Could not set the locale");
    }
}
