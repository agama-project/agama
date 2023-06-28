//! Representation of the network settings

use super::types::DeviceType;
use crate::settings::{SettingObject, Settings};
use serde::{Deserialize, Serialize};
use std::convert::TryFrom;
use std::default::Default;

/// Network settings for installation
#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSettings {
    /// Connections to use in the installation
    pub connections: Vec<NetworkConnection>,
}

impl Settings for NetworkSettings {
    fn add(&mut self, attr: &str, value: SettingObject) -> Result<(), &'static str> {
        match attr {
            "connections" => self.connections.push(value.try_into()?),
            _ => return Err("unknown attribute"),
        };
        Ok(())
    }

    fn merge(&mut self, other: &Self)
    where
        Self: Sized,
    {
        self.connections = other.connections.clone();
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct WirelessSettings {
    #[serde(skip_serializing_if = "String::is_empty")]
    pub password: String,
    pub security: String,
    pub ssid: String,
    pub mode: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct NetworkConnection {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gateway: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub addresses: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub nameservers: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wireless: Option<WirelessSettings>,
}

impl NetworkConnection {
    /// Device type expected for the network connection.
    ///
    /// Which device type to use is inferred from the included settings. For instance, if it has
    /// wireless settings, it should be applied to a wireless device.
    pub fn device_type(&self) -> DeviceType {
        if self.wireless.is_some() {
            DeviceType::Wireless
        } else {
            DeviceType::Ethernet
        }
    }
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
