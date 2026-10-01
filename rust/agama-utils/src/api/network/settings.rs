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

use super::types::{
    ConnectionState, ConnectivityState, DeviceState, DeviceType, Ipv4Method, Ipv6Method, Status,
};
use crate::openapi::schemas;
use cidr::IpInet;
use merge::Merge;
use schemars::JsonSchema;
use serde::{de::Error as _, Deserialize, Deserializer, Serialize};
use std::default::Default;
use std::net::IpAddr;

/// Collection of connections.
///
/// It only holds the root connections: the ports of a bond or a bridge are nested inside the
/// `ports` list of their controller. Use [`Self::flatten`] to go through all of them.
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct NetworkConnectionsCollection(pub Vec<NetworkConnection>);

impl NetworkConnectionsCollection {
    /// Returns every connection in the collection, ports included, parents before their ports.
    ///
    /// Ports given by name are left out, as they are not connections yet.
    pub fn flatten(&self) -> Vec<&NetworkConnection> {
        let mut all = vec![];
        for conn in &self.0 {
            conn.collect_into(&mut all);
        }
        all
    }
}

/// Network settings for installation
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSettings {
    pub connections: NetworkConnectionsCollection,
}

/// Network general settings for the installation like enabling wireless, networking and
/// allowing to enable or disable the copy of the network settings to the
/// target system
#[derive(Clone, Debug, Default, Serialize, Deserialize, Merge, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
#[merge(strategy = merge::option::overwrite_none)]
pub struct StateSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connectivity: Option<ConnectivityState>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wireless_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub networking_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub copy_network: Option<bool>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
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
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
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

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct BondSettings {
    pub mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<String>,
    /// Ports of the controller. When it is omitted, the current ports are left alone.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub ports: Option<Vec<PortEntry>>,
}

impl Default for BondSettings {
    fn default() -> Self {
        Self {
            mode: "balance-rr".to_string(),
            options: None,
            ports: None,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
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
    /// Ports of the controller. When it is omitted, the current ports are left alone.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub ports: Option<Vec<PortEntry>>,
}

/// Entry of a controller's `ports` list.
#[derive(Clone, Debug, Serialize, JsonSchema, PartialEq)]
#[serde(untagged)]
pub enum PortEntry {
    /// Interface name or ID of a connection.
    ///
    /// It is a shorthand for `{ "interface": "<name>" }`: it refers to the connection with that
    /// interface name or ID, and a new Ethernet connection is created when there is none.
    Name(String),
    /// The port connection itself.
    Connection(Box<NetworkConnection>),
}

// Written by hand because an untagged enum reports any problem in a nested port as "data did
// not match any variant", which does not help anybody fix a profile.
impl<'de> Deserialize<'de> for PortEntry {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        match serde_json::Value::deserialize(deserializer)? {
            serde_json::Value::String(name) => Ok(Self::Name(name)),
            value => serde_json::from_value(value)
                .map(|conn| Self::Connection(Box::new(conn)))
                .map_err(D::Error::custom),
        }
    }
}

/// Settings a connection has because of its membership in a controller.
///
/// Unlike the other sections, these do not describe the device itself but the role it plays in
/// the bond or bridge it belongs to. Which settings apply depends on the kind of controller.
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PortSettings {
    /// Port priority used by the Spanning Tree Protocol (bridge ports only)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<u32>,
    /// Port cost used by the Spanning Tree Protocol (bridge ports only)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path_cost: Option<u32>,
}

impl PortSettings {
    pub fn is_empty(&self) -> bool {
        !self.has_bridge_settings()
    }

    /// Whether any of the settings that only make sense for a bridge port is set.
    pub fn has_bridge_settings(&self) -> bool {
        self.priority.is_some() || self.path_cost.is_some()
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

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct VlanSettings {
    pub parent: String,
    pub id: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protocol: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flags: Option<Vec<VlanFlag>>,
}

/// IEEE 802.1x (EAP) settings
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
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

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
pub struct NetworkDevice {
    pub id: String,
    pub type_: DeviceType,
    pub state: DeviceState,
}

/// Represents the configuration details for a network connection
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NetworkConnection {
    /// Unique identifier for the network connection
    ///
    /// It can be omitted for a port nested in its controller, in which case the interface name
    /// is used.
    #[serde(default)]
    pub id: String,
    /// IPv4 method used for the network connection
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method4: Option<Ipv4Method>,
    /// Gateway IP address for the IPv4 connection
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gateway4: Option<IpAddr>,
    /// IPv6 method used for the network connection
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method6: Option<Ipv6Method>,
    /// Gateway IP address for the IPv6 connection
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gateway6: Option<IpAddr>,
    /// List of assigned IP addresses
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    #[schemars(with = "schemas::IpInetSchema")]
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
    /// Settings that this connection has because it is a port of a controller
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<PortSettings>,
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
    /// Current state of the connection
    ///
    /// Only reported as part of the system information. It is ignored when given.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<ConnectionState>,
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

    /// Whether the connection gives any IP setting.
    ///
    /// A port of a bond or a bridge cannot have them: its controller holds the IP configuration.
    /// `ignoreAutoDns: false` does not count, as it is the default and it is always reported.
    pub fn has_ip_settings(&self) -> bool {
        self.method4.is_some()
            || self.method6.is_some()
            || self.gateway4.is_some()
            || self.gateway6.is_some()
            || !self.addresses.is_empty()
            || !self.nameservers.is_empty()
            || !self.dns_searchlist.is_empty()
            || self.ignore_auto_dns == Some(true)
    }

    /// Drops the IP settings of the connection, e.g. to report it as a port.
    pub fn clear_ip_settings(&mut self) {
        self.method4 = None;
        self.method6 = None;
        self.gateway4 = None;
        self.gateway6 = None;
        self.addresses.clear();
        self.nameservers.clear();
        self.dns_searchlist.clear();
        self.ignore_auto_dns = None;
    }

    /// Returns the ports declared by the connection, if it declares any.
    ///
    /// An empty list is not the same as no list at all: an empty list means that the controller
    /// has no ports, while no list means that its ports are not part of the payload.
    pub fn ports(&self) -> Option<&[PortEntry]> {
        match (&self.bond, &self.bridge) {
            (Some(bond), _) => bond.ports.as_deref(),
            (None, Some(bridge)) => bridge.ports.as_deref(),
            (None, None) => None,
        }
    }

    /// Mutable version of [`Self::ports`].
    pub fn ports_mut(&mut self) -> Option<&mut Vec<PortEntry>> {
        match (&mut self.bond, &mut self.bridge) {
            (Some(bond), _) => bond.ports.as_mut(),
            (None, Some(bridge)) => bridge.ports.as_mut(),
            (None, None) => None,
        }
    }

    /// Sets the ports of the connection, if it is a bond or a bridge.
    pub fn set_ports(&mut self, ports: Option<Vec<PortEntry>>) {
        match (&mut self.bond, &mut self.bridge) {
            (Some(bond), _) => bond.ports = ports,
            (None, Some(bridge)) => bridge.ports = ports,
            (None, None) => {}
        }
    }

    /// Pushes the connection and its nested ports, recursively, to the given list.
    fn collect_into<'a>(&'a self, all: &mut Vec<&'a NetworkConnection>) {
        all.push(self);
        for port in self.ports().into_iter().flatten() {
            if let PortEntry::Connection(conn) = port {
                conn.collect_into(all);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_network_connection_dns_searchlist_serialization() {
        let json = r#"{
            "id": "eth0",
            "dnsSearchList": ["example.com"]
        }"#;
        let conn: NetworkConnection = serde_json::from_str(json).unwrap();
        assert_eq!(conn.dns_searchlist, vec!["example.com"]);

        let serialized = serde_json::to_string(&conn).unwrap();
        assert!(serialized.contains("\"dnsSearchList\":[\"example.com\"]"));
        assert!(!serialized.contains("\"dnsSearchlist\""));
    }

    #[test]
    fn test_network_connection_dns_searchlist_alias() {
        let json = r#"{
            "id": "eth0",
            "dnsSearchlist": ["example.org"]
        }"#;
        let conn: NetworkConnection = serde_json::from_str(json).unwrap();
        assert_eq!(conn.dns_searchlist, vec!["example.org"]);
    }

    #[test]
    fn test_network_connection_ieee8021x_serialization() {
        let json = r#"{
            "id": "eth0",
            "ieee8021x": { "eap": ["tls"], "identity": "jane" }
        }"#;
        let conn: NetworkConnection = serde_json::from_str(json).unwrap();
        assert_eq!(
            conn.ieee_8021x.as_ref().unwrap().identity.as_deref(),
            Some("jane")
        );

        let serialized = serde_json::to_string(&conn).unwrap();
        assert!(serialized.contains("\"ieee8021x\":"));
        assert!(!serialized.contains("\"ieee-8021x\""));
    }

    #[test]
    fn test_network_connection_ieee8021x_alias() {
        let json = r#"{
            "id": "eth0",
            "ieee-8021x": { "eap": ["tls"], "identity": "jane" }
        }"#;
        let conn: NetworkConnection = serde_json::from_str(json).unwrap();
        assert_eq!(
            conn.ieee_8021x.as_ref().unwrap().identity.as_deref(),
            Some("jane")
        );
    }

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

    #[test]
    fn test_ports_can_be_given_by_name_or_nested() {
        let json = r#"{
            "id": "br0",
            "bridge": {
                "ports": [
                    "eth0",
                    {
                        "interface": "bond0",
                        "port": { "priority": 32 },
                        "bond": { "mode": "802.3ad", "ports": ["eth1", { "interface": "eth2" }] }
                    }
                ]
            }
        }"#;
        let conn: NetworkConnection = serde_json::from_str(json).unwrap();

        let ports = conn.ports().unwrap();
        assert_eq!(ports[0], PortEntry::Name("eth0".to_string()));
        let PortEntry::Connection(bond0) = &ports[1] else {
            panic!("bond0 is not nested");
        };
        // The ID is filled in when resolving the ports.
        assert_eq!(bond0.id, "");
        assert_eq!(bond0.port.as_ref().unwrap().priority, Some(32));

        let collection = NetworkConnectionsCollection(vec![conn.clone()]);
        let interfaces: Vec<_> = collection
            .flatten()
            .iter()
            .map(|c| c.interface.as_deref().unwrap_or(&c.id))
            .collect();
        // Ports given by name are not connections, so eth0 and eth1 are left out.
        assert_eq!(interfaces, ["br0", "bond0", "eth2"]);

        let serialized = serde_json::to_value(&conn).unwrap();
        assert_eq!(serialized["bridge"]["ports"][0], "eth0");
        assert_eq!(serialized["bridge"]["ports"][1]["interface"], "bond0");
    }

    #[test]
    fn test_omitted_ports_are_not_an_empty_list() {
        let json = r#"{ "id": "br0", "bridge": { "stp": false } }"#;
        let conn: NetworkConnection = serde_json::from_str(json).unwrap();
        assert_eq!(conn.ports(), None);

        let json = r#"{ "id": "br0", "bridge": { "stp": false, "ports": [] } }"#;
        let conn: NetworkConnection = serde_json::from_str(json).unwrap();
        assert_eq!(conn.ports(), Some([].as_slice()));
    }

    #[test]
    fn test_an_invalid_nested_port_reports_the_actual_problem() {
        let json =
            r#"{ "id": "bond0", "bond": { "mode": "802.3ad", "ports": [{ "mtu": "big" }] } }"#;
        let error = serde_json::from_str::<NetworkConnection>(json)
            .unwrap_err()
            .to_string();
        assert!(error.contains("invalid type"), "unexpected error: {error}");
    }
}
