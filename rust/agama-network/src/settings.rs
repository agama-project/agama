// Copyright (c) [2024] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

//! Representation of the network settings

use super::types::{DeviceState, DeviceType, Status};
use agama_utils::openapi::schemas;
use cidr::IpInet;
use serde::{Deserialize, Serialize};
use std::default::Default;
use std::net::IpAddr;

/// Network settings for installation
#[derive(Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSettings {
    /// Connections to use in the installation
    pub connections: Vec<NetworkConnection>,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize, utoipa::ToSchema)]
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

/// Wireless configuration
#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WirelessSettings {
    /// Password of the wireless network
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    /// Security method/key management
    pub security: String,
    /// SSID of the wireless network
    pub ssid: String,
    /// Wireless network mode
    pub mode: String,
    /// Frequency band of the wireless network
    #[serde(skip_serializing_if = "Option::is_none")]
    pub band: Option<String>,
    /// Wireless channel of the wireless network
    #[serde(skip_serializing_if = "is_zero", default)]
    pub channel: u32,
    /// Only allow connection to this mac address
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bssid: Option<String>,
    /// Indicates that the wireless network is not broadcasting its SSID
    #[serde(skip_serializing_if = "std::ops::Not::not", default)]
    pub hidden: bool,
    /// A list of group/broadcast encryption algorithms
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub group_algorithms: Vec<String>,
    /// A list of pairwise encryption algorithms
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub pairwise_algorithms: Vec<String>,
    /// A list of allowed WPA protocol versions
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub wpa_protocol_versions: Vec<String>,
    /// Indicates whether Protected Management Frames must be enabled for the connection
    #[serde(skip_serializing_if = "is_zero", default)]
    pub pmf: i32,
}

#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
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

#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct BridgeSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stp: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub forward_delay: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hello_time: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_age: Option<u32>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub ports: Vec<String>,
}

impl Default for BridgeSettings {
    fn default() -> Self {
        Self {
            stp: None,
            priority: None,
            forward_delay: None,
            hello_time: None,
            max_age: None,
            ports: vec![],
        }
    }
}

/// VLAN flags controlling behavior
#[derive(Clone, Copy, Debug, Serialize, Deserialize, utoipa::ToSchema, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum VlanFlag {
    /// Reorder Ethernet headers to make packets look less like VLAN packets
    ReorderHeaders,
    /// GARP VLAN Registration Protocol - dynamically register/deregister VLANs
    Gvrp,
    /// Allow changing master device while connection is active
    LooseBinding,
    /// Multiple VLAN Registration Protocol - next generation of GVRP
    Mvrp,
}

impl VlanFlag {
    /// Valid bitmask for all known VLAN flags
    const VALID_MASK: u32 = 0xF; // 0x1 | 0x2 | 0x4 | 0x8

    /// Convert a slice of VlanFlags to a bitmask value for NetworkManager
    pub fn to_bitmask(flags: &[VlanFlag]) -> u32 {
        flags.iter().fold(0, |acc, flag| {
            acc | match flag {
                VlanFlag::ReorderHeaders => 0x1,
                VlanFlag::Gvrp => 0x2,
                VlanFlag::LooseBinding => 0x4,
                VlanFlag::Mvrp => 0x8,
            }
        })
    }

    /// Convert a bitmask value from NetworkManager to a Vec of VlanFlags
    ///
    /// Unknown flag bits are silently ignored to maintain forward compatibility
    /// with future NetworkManager versions.
    pub fn from_bitmask(bitmask: u32) -> Vec<VlanFlag> {
        let mut flags = Vec::new();
        if bitmask & 0x1 != 0 {
            flags.push(VlanFlag::ReorderHeaders);
        }
        if bitmask & 0x2 != 0 {
            flags.push(VlanFlag::Gvrp);
        }
        if bitmask & 0x4 != 0 {
            flags.push(VlanFlag::LooseBinding);
        }
        if bitmask & 0x8 != 0 {
            flags.push(VlanFlag::Mvrp);
        }

        // Log warning if unknown bits are set
        if bitmask & !Self::VALID_MASK != 0 {
            tracing::warn!(
                "Unknown VLAN flags in bitmask: {:#x} (unknown bits: {:#x})",
                bitmask,
                bitmask & !Self::VALID_MASK
            );
        }

        flags
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct VlanSettings {
    pub parent: String,
    pub id: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protocol: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flags: Option<Vec<VlanFlag>>,
}

/// IEEE 802.1x (EAP) settings
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IEEE8021XSettings {
    /// List of EAP methods used
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub eap: Vec<String>,
    /// Phase 2 inner auth method
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phase2_auth: Option<String>,
    /// Identity string, often for example the user's login name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identity: Option<String>,
    /// Password string used for EAP authentication
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    /// Path to CA certificate
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ca_cert: Option<String>,
    /// Password string for CA certificate if it is encrypted
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ca_cert_password: Option<String>,
    /// Path to client certificate
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_cert: Option<String>,
    /// Password string for client certificate if it is encrypted
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_cert_password: Option<String>,
    /// Path to private key
    #[serde(skip_serializing_if = "Option::is_none")]
    pub private_key: Option<String>,
    /// Password string for private key if it is encrypted
    #[serde(skip_serializing_if = "Option::is_none")]
    pub private_key_password: Option<String>,
    /// Anonymous identity string for EAP authentication methods
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anonymous_identity: Option<String>,
    /// Which PEAP version is used when PEAP is set as the EAP method in the 'eap' property
    #[serde(skip_serializing_if = "Option::is_none")]
    pub peap_version: Option<String>,
    /// Force the use of the new PEAP label during key derivation
    #[serde(skip_serializing_if = "std::ops::Not::not", default)]
    pub peap_label: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NetworkDevice {
    pub id: String,
    pub type_: DeviceType,
    pub state: DeviceState,
}

/// Represents the configuration details for a network connection
#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct NetworkConnection {
    /// Unique identifier for the network connection
    pub id: String,
    /// IPv4 method used for the network connection
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method4: Option<String>,
    /// Gateway IP address for the IPv4 connection
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(schema_with = schemas::ip_addr_ref)]
    pub gateway4: Option<IpAddr>,
    /// IPv6 method used for the network connection
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method6: Option<String>,
    /// Gateway IP address for the IPv6 connection
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(schema_with = schemas::ip_addr_ref)]
    pub gateway6: Option<IpAddr>,
    /// List of assigned IP addresses
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    #[schema(schema_with = schemas::ip_inet_array)]
    pub addresses: Vec<IpInet>,
    /// List of DNS server IP addresses
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    #[schema(schema_with = schemas::ip_addr_array)]
    pub nameservers: Vec<IpAddr>,
    /// List of search domains for DNS resolution
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub dns_searchlist: Vec<String>,
    /// Specifies whether to ignore automatically assigned DNS settings
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ignore_auto_dns: Option<bool>,
    /// VLAN settings for the connection
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vlan: Option<VlanSettings>,
    /// Wireless settings for the connection
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wireless: Option<WirelessSettings>,
    /// Network interface associated with the connection
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interface: Option<String>,
    /// Match settings for the network connection
    #[serde(rename = "match", skip_serializing_if = "Option::is_none")]
    pub match_settings: Option<MatchSettings>,
    /// Identifier for the parent connection, if this connection is part of a bond
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent: Option<String>,
    /// Bonding settings if part of a bond
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bond: Option<BondSettings>,
    /// Bridge settings if part of a bridge
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bridge: Option<BridgeSettings>,
    /// Custom MAC address of the connection's interface
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_mac_address: Option<String>,
    /// MAC address of the connection's interface
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mac_address: Option<String>,
    /// Current status of the network connection
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<Status>,
    /// Maximum Transmission Unit (MTU) for the connection
    #[serde(skip_serializing_if = "is_zero", default)]
    pub mtu: u32,
    /// IEEE 802.1X settings
    #[serde(rename = "ieee-8021x", skip_serializing_if = "Option::is_none")]
    pub ieee_8021x: Option<IEEE8021XSettings>,
    /// Specifies if the connection should automatically connect
    #[serde(skip_serializing_if = "Option::is_none")]
    pub autoconnect: Option<bool>,
    /// Specifies whether the connection should be persisted or not
    #[serde(skip_serializing_if = "Option::is_none")]
    pub persistent: Option<bool>,
}

fn is_zero<T: PartialEq + From<u16>>(u: &T) -> bool {
    *u == T::from(0)
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
        } else if self.bridge.is_some() {
            DeviceType::Bridge
        } else {
            DeviceType::Ethernet
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_network_connection_match_settings_round_trip() {
        // Test round-trip: deserialize and serialize match settings
        let json = r#"{
            "id": "eth0",
            "ignoreAutoDns": false,
            "status": "up",
            "match": {
                "interface": ["eth0"],
                "driver": ["e1000e"],
                "path": ["pci-0000:00:1f.6"],
                "kernel": ["eth*"]
            },
            "autoconnect": true,
            "persistent": false
        }"#;

        // 1. Verify deserialization with the "match" key and all fields
        let conn: NetworkConnection = serde_json::from_str(json).unwrap();
        assert!(conn.match_settings.is_some());
        let match_settings = conn.match_settings.as_ref().unwrap();
        assert_eq!(match_settings.interface, vec!["eth0"]);
        assert_eq!(match_settings.driver, vec!["e1000e"]);
        assert_eq!(match_settings.path, vec!["pci-0000:00:1f.6"]);
        assert_eq!(match_settings.kernel, vec!["eth*"]);

        // 2. Verify serialization back uses "match" and does not contain "matchSettings"
        let serialized = serde_json::to_string(&conn).unwrap();
        assert!(serialized.contains("\"match\":"));
        assert!(!serialized.contains("\"matchSettings\""));

        // 3. Verify second-pass deserialization preserves identical settings
        let conn2: NetworkConnection = serde_json::from_str(&serialized).unwrap();
        assert_eq!(conn.match_settings, conn2.match_settings);
    }
}
