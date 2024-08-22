//! Representation of the software settings

use serde::{Deserialize, Serialize};

/// Software settings for installation
#[derive(Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SoftwareSettings {
    /// List of patterns to install. If empty use default.
    pub patterns: Vec<String>,
}
