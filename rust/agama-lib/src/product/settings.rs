//! Representation of the product settings

use serde::{Deserialize, Serialize};

/// Software settings for installation
#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductSettings {
    /// ID of the product to install (e.g., "ALP", "Tumbleweed", etc.)
    pub id: Option<String>,
    pub registration_code: Option<String>,
    pub registration_email: Option<String>,
}
