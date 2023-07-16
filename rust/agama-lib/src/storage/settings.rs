//! Representation of the storage settings

use crate::settings::{SettingObject, Settings, SettingsError};
use agama_derive::Settings;
use serde::{Deserialize, Serialize};

/// Storage settings for installation
#[derive(Debug, Default, Settings, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageSettings {
    /// Whether LVM should be enabled
    pub lvm: Option<bool>,
    /// Encryption password for the storage devices (in clear text)
    pub encryption_password: Option<String>,
    /// Devices to use in the installation
    #[settings(collection)]
    pub devices: Vec<Device>,
}

/// Device to use in the installation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    /// Device name (e.g., "/dev/sda")
    pub name: String,
}

impl From<String> for Device {
    fn from(value: String) -> Self {
        Self { name: value }
    }
}

impl TryFrom<SettingObject> for Device {
    type Error = SettingsError;

    fn try_from(value: SettingObject) -> Result<Self, Self::Error> {
        match value.get("name") {
            Some(name) => Ok(Device {
                name: name.clone().try_into()?,
            }),
            _ => Err(SettingsError::MissingKey("name".to_string())),
        }
    }
}
