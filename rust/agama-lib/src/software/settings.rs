//! Representation of the software settings

use agama_derive::Settings;
use serde::{Deserialize, Serialize};

/// Software settings for installation
#[derive(Debug, Default, Settings, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftwareSettings {
    /// ID of the product to install (e.g., "ALP", "Tumbleweed", etc.)
    pub product: Option<String>,
}
