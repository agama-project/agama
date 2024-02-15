//! Representation of the localization settings

use agama_settings::Settings;
use serde::{Deserialize, Serialize};

/// Localization settings for the system being installed (not the UI)
#[derive(Debug, Default, Settings, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalizationSettings {
    /// like "en_US.UTF-8"
    pub language: Option<String>,
    /// like "cz(qwerty)"
    pub keyboard: Option<String>,
    /// like "Europe/Berlin"
    pub timezone: Option<String>,
}
