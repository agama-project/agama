//! Representation of the network settings

use super::types::DeviceType;
use agama_settings::error::ConversionError;
use agama_settings::{SettingObject, SettingValue, Settings};
use cidr::{Cidr, IpCidr};
use serde::{Deserialize, Serialize};
use std::convert::TryFrom;
use std::default::Default;
use std::net::IpAddr;

/// Network settings for installation
#[derive(Debug, Default, Settings, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSettings {
    /// Connections to use in the installation
    #[settings(collection)]
    pub connections: Vec<NetworkConnection>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct MatchSettings {
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub driver: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub path: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub kernel: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub interface: Vec<String>,
}

impl MatchSettings {
    pub fn is_empty(&self) -> bool {
        self.path.is_empty()
            && self.driver.is_empty()
            && self.kernel.is_empty()
            && self.interface.is_empty()
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
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gateway: Option<IpAddr>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub addresses: Vec<IpCidr>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub nameservers: Vec<IpAddr>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wireless: Option<WirelessSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interface: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub match_settings: Option<MatchSettings>,
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
    type Error = ConversionError;

    fn try_from(value: SettingObject) -> Result<Self, Self::Error> {
        let Some(id) = value.get("id") else {
            return Err(ConversionError::MissingKey("id".to_string()));
        };

        let default_method = SettingValue("disabled".to_string());
        let method = value.get("method").unwrap_or(&default_method);

        let conn = NetworkConnection {
            id: id.clone().try_into()?,
            method: method.clone().try_into()?,
            ..Default::default()
        };

        Ok(conn)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agama_settings::{settings::Settings, SettingObject, SettingValue};
    use std::collections::HashMap;

    #[test]
    fn test_device_type() {
        let eth = NetworkConnection::default();
        assert_eq!(eth.device_type(), DeviceType::Ethernet);

        let wlan = NetworkConnection {
            wireless: Some(WirelessSettings::default()),
            ..Default::default()
        };
        assert_eq!(wlan.device_type(), DeviceType::Wireless);
    }

    #[test]
    fn test_add_connection_to_setting() {
        let name = SettingValue("Ethernet 1".to_string());
        let method = SettingValue("auto".to_string());
        let conn = HashMap::from([("id".to_string(), name), ("method".to_string(), method)]);
        let conn = SettingObject(conn);

        let mut settings = NetworkSettings::default();
        settings.add("connections", conn).unwrap();
        assert_eq!(settings.connections.len(), 1);
    }

    #[test]
    fn test_setting_object_to_network_connection() {
        let name = SettingValue("Ethernet 1".to_string());
        let method = SettingValue("auto".to_string());
        let settings = HashMap::from([("id".to_string(), name), ("method".to_string(), method)]);
        let settings = SettingObject(settings);
        let conn: NetworkConnection = settings.try_into().unwrap();
        assert_eq!(conn.id, "Ethernet 1");
        assert_eq!(conn.method, Some("auto".to_string()));
    }
}
