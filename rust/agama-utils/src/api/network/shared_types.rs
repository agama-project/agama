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

//! Types that the configuration and the system information share.
//!
//! Besides the general settings and the sections that both of them have (e.g., [`VlanSettings`]),
//! it holds the parts that their connections are built from: [`ConnectionCommon`],
//! [`IpSettings`], [`BondCommon`], [`BridgeCommon`] and [`PortCommon`]. Each one adds its own way
//! of reporting the nested ports (see [`super::config`] and [`super::system_info`]).

use super::types::{ConnectivityState, DeviceState, DeviceType, Ipv4Method, Ipv6Method, Status};
use crate::openapi::schemas;
use cidr::IpInet;
use merge::Merge;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::default::Default;
use std::net::IpAddr;

/// Network general settings for the installation like enabling wireless, networking and
/// allowing to enable or disable the copy of the network settings to the
/// target system
#[derive(Clone, Debug, Default, Serialize, Deserialize, Merge, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[merge(strategy = merge::option::overwrite_none)]
pub struct StateSettings {
    /// Network connectivity state
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(extend("readOnly" = true))]
    pub connectivity: Option<ConnectivityState>,
    /// Whether the wireless should be enabled
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wireless_enabled: Option<bool>,
    /// Whether the network should be enabled
    #[serde(skip_serializing_if = "Option::is_none")]
    pub networking_enabled: Option<bool>,
    /// Whether the network configuration should be copied to the target system
    #[serde(skip_serializing_if = "Option::is_none")]
    pub copy_network: Option<bool>,
}

/// Match settings
///
/// Identifies the network interface to apply the connection settings to.
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MatchSettings {
    /// A list of driver names to match
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub driver: Vec<String>,
    /// A list of paths to match against the ID_PATH udev property of devices
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub path: Vec<String>,
    /// A list of kernel command line arguments to match
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub kernel: Vec<String>,
    /// A list of interface names to match
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
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WirelessSettings {
    /// Password of the wireless network
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    /// Security method/key management
    #[serde(default = "default_wireless_security")]
    #[schemars(extend("enum" = [
        "none", "owe", "ieee8021x", "wpa-psk", "sae", "wpa-eap", "wpa-eap-suite-b-192"
    ]))]
    pub security: String,
    /// SSID of the wireless network
    pub ssid: String,
    /// Wireless network mode
    #[serde(default = "default_wireless_mode")]
    #[schemars(extend("enum" = ["infrastructure", "adhoc", "mesh", "ap"]))]
    pub mode: String,
    /// Frequency band of the wireless network
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(extend("enum" = ["a", "bg"]))]
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
    #[schemars(extend("items" = { "type": "string", "enum": ["wep40", "wep104", "tkip", "ccmp"] }))]
    pub group_algorithms: Vec<String>,
    /// A list of pairwise encryption algorithms
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    #[schemars(extend("items" = { "type": "string", "enum": ["tkip", "ccmp"] }))]
    pub pairwise_algorithms: Vec<String>,
    /// A list of allowed WPA protocol versions
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    #[schemars(extend("items" = { "type": "string", "enum": ["wpa", "rsn"] }))]
    pub wpa_protocol_versions: Vec<String>,
    /// Indicates whether Protected Management Frames must be enabled for the connection
    #[serde(skip_serializing_if = "is_zero", default)]
    pub pmf: i32,
}

impl Default for WirelessSettings {
    fn default() -> Self {
        Self {
            password: None,
            security: default_wireless_security(),
            ssid: String::new(),
            mode: default_wireless_mode(),
            band: None,
            channel: 0,
            bssid: None,
            hidden: false,
            group_algorithms: vec![],
            pairwise_algorithms: vec![],
            wpa_protocol_versions: vec![],
            pmf: 0,
        }
    }
}

fn default_wireless_security() -> String {
    "none".to_string()
}

fn default_wireless_mode() -> String {
    "infrastructure".to_string()
}

/// Bonding settings except the nested ports, which the configuration and the system information
/// report differently (see [`config::BondSettings`](super::config::BondSettings) and
/// [`system_info::BondSettings`](super::system_info::BondSettings)).
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BondCommon {
    /// Bonding mode
    #[schemars(extend("enum" = [
        "balance-rr", "active-backup", "balance-xor", "broadcast", "802.3ad", "balance-tlb",
        "balance-alb"
    ]))]
    pub mode: String,
    /// Bonding options, separated by spaces (e.g., "miimon=100 primary=eth0")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<String>,
    /// Interface names or IDs of the ports of the controller.
    ///
    /// DEPRECATED: replaced by `portConnections`, which also takes names. It keeps working, and it
    /// is still reported for the clients that read it. When both lists are given,
    /// `portConnections` is used and this one is ignored.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    #[schemars(extend("deprecated" = true))]
    pub ports: Option<Vec<String>>,
}

impl Default for BondCommon {
    fn default() -> Self {
        Self {
            mode: "balance-rr".to_string(),
            options: None,
            ports: None,
        }
    }
}

/// Bridge settings except the nested ports, which the configuration and the system information
/// report differently (see [`config::BridgeSettings`](super::config::BridgeSettings) and
/// [`system_info::BridgeSettings`](super::system_info::BridgeSettings)).
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BridgeCommon {
    /// Whether the Spanning Tree Protocol is enabled or not
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stp: Option<bool>,
    /// Spanning Tree Protocol priority (lower values are 'better')
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<u32>,
    /// Spanning Tree Protocol forward delay, in seconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub forward_delay: Option<u32>,
    /// Spanning Tree Protocol hello time, in seconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hello_time: Option<u32>,
    /// Spanning Tree Protocol maximum message age, in seconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_age: Option<u32>,
    /// Interface names or IDs of the ports of the controller.
    ///
    /// DEPRECATED: replaced by `portConnections`, which also takes names. It keeps working, and it
    /// is still reported for the clients that read it. When both lists are given,
    /// `portConnections` is used and this one is ignored.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    #[schemars(extend("deprecated" = true))]
    pub ports: Option<Vec<String>>,
}

/// Settings a connection has because of its membership in a bridge.
///
/// Unlike the other sections, these do not describe the device itself but the role it plays in
/// the bridge it belongs to.
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BridgePortSettings {
    /// Port priority used by the Spanning Tree Protocol
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<u32>,
    /// Port cost used by the Spanning Tree Protocol
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path_cost: Option<u32>,
}

impl BridgePortSettings {
    pub fn is_empty(&self) -> bool {
        self == &Self::default()
    }
}

/// VLAN flags controlling behavior
#[derive(Clone, Copy, Debug, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
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

/// VLAN configuration
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VlanSettings {
    /// Parent interface
    pub parent: String,
    /// VLAN identifier
    #[schemars(range(max = 4094))]
    pub id: u32,
    /// VLAN protocol for encapsulation
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(extend("enum" = ["802.1Q", "802.1ad"], "default" = "802.1Q"))]
    pub protocol: Option<String>,
    /// VLAN flags
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flags: Option<Vec<VlanFlag>>,
}

/// IEEE 802.1x (EAP) settings
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct IEEE8021XSettings {
    /// List of EAP methods used
    #[serde(skip_serializing_if = "Vec::is_empty")]
    #[schemars(extend("items" = {
        "type": "string",
        "enum": ["leap", "md5", "tls", "peap", "ttls", "pwd", "fast"]
    }))]
    pub eap: Vec<String>,
    /// Phase 2 inner auth method
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(extend("enum" = ["pap", "chap", "mschap", "mschapv2", "gtc", "otp", "md5", "tls"]))]
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
    #[schemars(extend("enum" = ["0", "1"]))]
    pub peap_version: Option<String>,
    /// Force the use of the new PEAP label during key derivation
    #[serde(skip_serializing_if = "std::ops::Not::not", default)]
    pub peap_label: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NetworkDevice {
    pub id: String,
    pub type_: DeviceType,
    pub state: DeviceState,
}

/// Settings of a connection except its IP settings ([`IpSettings`]) and its `bond` and `bridge`
/// sections, which hold the nested ports.
///
/// The configuration and the system information report the ports differently (see
/// [`config::NetworkConnection`](super::config::NetworkConnection) and
/// [`system_info::NetworkConnection`](super::system_info::NetworkConnection)), so they share
/// these settings and add their own sections.
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionCommon {
    /// Unique identifier for the network connection
    pub id: String,
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
    /// Custom MAC address of the connection's interface
    ///
    /// Can also be 'preserve', 'permanent', 'random' or 'stable'.
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
    #[serde(
        rename = "ieee8021x",
        alias = "ieee-8021x",
        skip_serializing_if = "Option::is_none"
    )]
    pub ieee_8021x: Option<IEEE8021XSettings>,
    /// Specifies if the connection should automatically connect
    #[serde(skip_serializing_if = "Option::is_none")]
    pub autoconnect: Option<bool>,
    /// Specifies whether the connection should be persisted or not
    #[serde(skip_serializing_if = "Option::is_none")]
    pub persistent: Option<bool>,
}

/// IP settings of a connection.
///
/// A port of a bond or a bridge cannot have them, as its controller holds the IP configuration, so
/// the nested ports do not include them (see [`PortCommon`]).
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct IpSettings {
    /// IPv4 method used for the network connection
    ///
    /// Defaults to 'auto'.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method4: Option<Ipv4Method>,
    /// Gateway IP address for the IPv4 connection
    #[schemars(example = &"192.168.122.1")]
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(extend("examples" = ["192.168.122.1"]))]
    pub gateway4: Option<IpAddr>,
    /// IPv6 method used for the network connection
    ///
    /// Defaults to 'auto'.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method6: Option<Ipv6Method>,
    /// Gateway IP address for the IPv6 connection
    #[schemars(example = &"::ffff:c0a8:7a01")]
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(extend("examples" = ["::ffff:c0a8:7a01"]))]
    pub gateway6: Option<IpAddr>,
    /// List of assigned IP addresses
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    #[schemars(with = "Vec<schemas::IpInetSchema>")]
    pub addresses: Vec<IpInet>,
    /// List of DNS server IP addresses
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub nameservers: Vec<IpAddr>,
    /// List of search domains for DNS resolution
    #[serde(
        skip_serializing_if = "Vec::is_empty",
        default,
        rename = "dnsSearchList",
        alias = "dnsSearchlist"
    )]
    pub dns_searchlist: Vec<String>,
    /// Specifies whether to ignore automatically assigned DNS settings
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ignore_auto_dns: Option<bool>,
}

impl IpSettings {
    /// Whether no IP setting is given.
    ///
    /// `ignoreAutoDns: false` does not count, as it is the default and it is always reported.
    pub fn is_empty(&self) -> bool {
        self.method4.is_none()
            && self.method6.is_none()
            && self.gateway4.is_none()
            && self.gateway6.is_none()
            && self.addresses.is_empty()
            && self.nameservers.is_empty()
            && self.dns_searchlist.is_empty()
            && self.ignore_auto_dns != Some(true)
    }
}

/// Settings that every nested port has, whatever its kind and whatever reports it.
///
/// It is a connection without IP settings, as its controller holds the IP configuration, and
/// without the sections that tell its kind. Each kind of port flattens it and adds its own
/// sections, both in the configuration (e.g.,
/// [`config::BondBondPort`](super::config::BondBondPort)) and in the system information (e.g.,
/// [`system_info::BondBondPort`](super::system_info::BondBondPort)).
///
/// The ports reject unknown fields, so this struct must not flatten any other one: serde does not
/// see the fields of a flattened struct that flattens another one, and the port would reject them
/// as unknown.
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PortCommon {
    /// Unique identifier for the network connection
    ///
    /// When it is omitted, the port refers to the connection bound to its interface, or
    /// gets the interface name as its ID.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    /// Network interface associated with the connection
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interface: Option<String>,
    /// Match settings for the network connection
    #[serde(rename = "match", skip_serializing_if = "Option::is_none")]
    pub match_settings: Option<MatchSettings>,
    /// Custom MAC address of the connection's interface
    ///
    /// Can also be 'preserve', 'permanent', 'random' or 'stable'.
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
    #[serde(
        rename = "ieee8021x",
        alias = "ieee-8021x",
        skip_serializing_if = "Option::is_none"
    )]
    pub ieee_8021x: Option<IEEE8021XSettings>,
    /// Specifies if the connection should automatically connect
    #[serde(skip_serializing_if = "Option::is_none")]
    pub autoconnect: Option<bool>,
    /// Specifies whether the connection should be persisted or not
    #[serde(skip_serializing_if = "Option::is_none")]
    pub persistent: Option<bool>,
}

impl PortCommon {
    /// Takes the settings every port has from a connection.
    ///
    /// The IP settings are not part of it, and its `vlan` and `wireless` sections are dropped: the
    /// caller takes the ones its kind of port has before.
    pub(super) fn from_connection(common: ConnectionCommon) -> Self {
        let ConnectionCommon {
            id,
            vlan: _,
            wireless: _,
            interface,
            match_settings,
            custom_mac_address,
            mac_address,
            status,
            mtu,
            ieee_8021x,
            autoconnect,
            persistent,
        } = common;

        Self {
            id: Some(id),
            interface,
            match_settings,
            custom_mac_address,
            mac_address,
            status,
            mtu,
            ieee_8021x,
            autoconnect,
            persistent,
        }
    }

    /// Returns the settings of the connection the port stands for, with the given ID and
    /// sections, and without IP settings.
    pub(super) fn to_connection_common(
        &self,
        id: String,
        vlan: Option<VlanSettings>,
        wireless: Option<WirelessSettings>,
    ) -> ConnectionCommon {
        ConnectionCommon {
            id,
            vlan,
            wireless,
            interface: self.interface.clone(),
            match_settings: self.match_settings.clone(),
            custom_mac_address: self.custom_mac_address.clone(),
            mac_address: self.mac_address.clone(),
            status: self.status,
            mtu: self.mtu,
            ieee_8021x: self.ieee_8021x.clone(),
            autoconnect: self.autoconnect,
            persistent: self.persistent,
        }
    }
}

/// Adds the deprecated `dnsSearchlist` alias to the schema of a connection.
///
/// schemars ignores the serde aliases, as JSON Schema has no such concept.
pub(super) fn add_dns_searchlist_alias(schema: &mut schemars::Schema) {
    let Some(properties) = schema.get_mut("properties").and_then(|p| p.as_object_mut()) else {
        return;
    };
    if let Some(mut alias) = properties.get("dnsSearchList").cloned() {
        if let Some(alias) = alias.as_object_mut() {
            alias.insert("deprecated".to_string(), serde_json::json!(true));
        }
        properties.insert("dnsSearchlist".to_string(), alias);
    }
}

fn is_zero<T: PartialEq + From<u16>>(u: &T) -> bool {
    *u == T::from(0)
}

#[cfg(test)]
mod tests {
    use super::WirelessSettings;

    #[test]
    fn test_wireless_settings_defaults() {
        let settings: WirelessSettings = serde_json::from_str(r#"{ "ssid": "MyWiFi" }"#).unwrap();
        assert_eq!(settings.mode, "infrastructure");
        assert_eq!(settings.security, "none");
        assert_eq!(
            settings,
            WirelessSettings {
                ssid: "MyWiFi".to_string(),
                ..Default::default()
            }
        );
    }
}
