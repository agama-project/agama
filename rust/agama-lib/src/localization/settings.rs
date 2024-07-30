//! Representation of the localization settings

use serde::{Deserialize, Serialize};

/// Localization settings for the system being installed (not the UI)
/// FIXME: this one is close to CLI. A possible duplicate close to HTTP is LocaleConfig
#[derive(Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LocalizationSettings {
    /// like "en_US.UTF-8"
    pub language: Option<String>,
    /// like "cz(qwerty)"
    pub keyboard: Option<String>,
    /// like "Europe/Berlin"
    pub timezone: Option<String>,
}
