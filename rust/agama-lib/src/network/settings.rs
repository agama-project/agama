//! Representation of the software settings

use crate::settings::{SettingObject, Settings};
use agama_derive::Settings;
use serde::{Deserialize, Serialize};
use std::convert::TryFrom;
use std::default::Default;

/// Network settings for installation
#[derive(Debug, Default, Settings, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSettings {
    /// Connections to use in the installation
    #[collection_setting]
    pub connections: Vec<NetworkConnection>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct WirelessSettings {
    #[serde(skip_serializing_if = "String::is_empty")]
    pub password: String,
    pub security: String,
    pub ssid: String,
    pub mode: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct NetworkConnection {
    pub name: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gateway: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub addresses: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub nameservers: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wireless: Option<WirelessSettings>,
}

impl TryFrom<SettingObject> for NetworkConnection {
    type Error = &'static str;

    fn try_from(value: SettingObject) -> Result<Self, Self::Error> {
        match value.0.get("name") {
            Some(name) => Ok(NetworkConnection {
                name: name.clone().try_into()?,
                ..Default::default()
            }),
            None => Err("'name' key not found"),
        }
    }
}
