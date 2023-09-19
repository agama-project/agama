//! Representation of the storage settings

use agama_settings::Settings;
use serde::{Deserialize, Serialize};

/// Storage settings for installation
#[derive(Debug, Default, Settings, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageSettings {
    /// Whether LVM should be enabled
    pub lvm: Option<bool>,
    /// Encryption password for the storage devices (in clear text)
    pub encryption_password: Option<String>,
    /// Boot device to use in the installation
    pub boot_device: Option<String>,
}
