//! Configuration network settings handling
//!
//! This module implements the mechanisms to load and store the installation settings.
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
    pub password: String,
    pub security: String,
    pub ssid: Vec<u8>,
    pub mode: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct NetworkConnection {
    pub name: String,
    pub dhcp4: bool,
    pub dhcp6: bool,
    pub gateway: String,
    pub addresses: Vec<String>,
    pub nameservers: Vec<String>,
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
