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

use super::types::{ConnectionState, DeviceState, DeviceType, Status};
use crate::openapi::schemas;
use cidr::IpInet;
use serde::{Deserialize, Serialize};
use std::default::Default;
use std::net::IpAddr;

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
pub struct NetworkConnectionsCollection(pub Vec<NetworkConnection>);

/// Network settings for installation
#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSettings {
    pub connections: NetworkConnectionsCollection,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StateSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connectivity: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wireless_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub networking_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub copy_network: Option<bool>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
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

#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct VlanSettings {
    pub parent: String,
    pub id: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protocol: Option<String>,
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

#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
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
    #[serde(skip_serializing_if = "Option::is_none")]
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

// FIXME: found a better place for the HTTP types.
//
// TODO: If the client ignores the additional "state" field, this struct
// does not need to be here.
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct NetworkConnectionWithState {
    #[serde(flatten)]
    pub connection: NetworkConnection,
    pub state: ConnectionState,
}
