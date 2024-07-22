//! Representation of the network settings

use super::types::{DeviceState, DeviceType, Status};
use cidr::IpInet;
use serde::{Deserialize, Serialize};
use std::default::Default;
use std::net::IpAddr;

/// Network settings for installation
#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSettings {
    /// Connections to use in the installation
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    pub security: String,
    pub ssid: String,
    pub mode: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BondSettings {
    pub mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub ports: Vec<String>,
}

impl Default for BondSettings {
    fn default() -> Self {
        Self {
            mode: "balance-rr".to_string(),
            options: None,
            ports: vec![],
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NetworkDevice {
    pub id: String,
    pub type_: DeviceType,
    pub state: DeviceState,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
pub struct NetworkConnection {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method4: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gateway4: Option<IpAddr>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method6: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gateway6: Option<IpAddr>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub addresses: Vec<IpInet>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub nameservers: Vec<IpAddr>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub dns_searchlist: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ignore_auto_dns: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wireless: Option<WirelessSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interface: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub match_settings: Option<MatchSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bond: Option<BondSettings>,
    #[serde(rename = "mac-address", skip_serializing_if = "Option::is_none")]
    pub mac_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<Status>,
    #[serde(skip_serializing_if = "is_zero", default)]
    pub mtu: u32,
}

fn is_zero(u: &u32) -> bool {
    *u == 0
}

impl NetworkConnection {
    /// Device type expected for the network connection.
    ///
    /// Which device type to use is inferred from the included settings. For instance, if it has
    /// wireless settings, it should be applied to a wireless device.
    pub fn device_type(&self) -> DeviceType {
        if self.wireless.is_some() {
            DeviceType::Wireless
        } else if self.bond.is_some() {
            DeviceType::Bond
        } else {
            DeviceType::Ethernet
        }
    }
}
