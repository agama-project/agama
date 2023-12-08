//! Representation of the software settings

use agama_settings::Settings;
use serde::{Deserialize, Serialize};

/// Software settings for installation
#[derive(Debug, Default, Settings, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftwareSettings {
    /// List of patterns to install. If empty use default.
    #[settings(collection)]
    pub patterns: Vec<String>,
}
