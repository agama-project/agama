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
/// `portConnections` list of their controller. Use [`Self::flatten`] to go through all of them.
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct NetworkConnectionsCollection(pub Vec<NetworkConnection>);

impl NetworkConnectionsCollection {
    /// Returns every connection in the collection, ports included, parents before their ports.
    ///
    /// The ports are returned as the connections they stand for (see
    /// [`NetworkConnection::from`]). Ports given by name are left out, as they are not connections
    /// yet.
    pub fn flatten(&self) -> Vec<NetworkConnection> {
        let mut all = vec![];
        for conn in &self.0 {
            all.push(conn.clone());
            collect_ports(conn, &mut all);
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
#[serde(rename_all = "camelCase")]
pub struct BondSettings {
    pub mode: String,
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
    /// Ports of the controller. When neither this list nor `ports` is given, the current ports
    /// are left alone.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub port_connections: Option<Vec<PortEntry>>,
}

impl Default for BondSettings {
    fn default() -> Self {
        Self {
            mode: "balance-rr".to_string(),
            options: None,
            ports: None,
            port_connections: None,
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
    /// Interface names or IDs of the ports of the controller.
    ///
    /// DEPRECATED: replaced by `portConnections`, which also takes names. It keeps working, and it
    /// is still reported for the clients that read it. When both lists are given,
    /// `portConnections` is used and this one is ignored.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    #[schemars(extend("deprecated" = true))]
    pub ports: Option<Vec<String>>,
    /// Ports of the controller. When neither this list nor `ports` is given, the current ports
    /// are left alone.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub port_connections: Option<Vec<PortEntry>>,
}

/// Entry of a controller's `portConnections` list.
#[derive(Clone, Debug, Serialize, JsonSchema, PartialEq)]
#[serde(untagged)]
pub enum PortEntry {
    /// Interface name or ID of a connection.
    ///
    /// It is a shorthand for `{ "interface": "<name>" }`: it refers to the connection with that
    /// interface name or ID, and a new Ethernet connection is created when there is none.
    Name(String),
    /// The port connection itself.
    Connection(Box<PortConnection>),
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

/// A port of a controller, whichever of its lists gives it (see [`PortLists::ports`]).
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum PortRef<'a> {
    /// Interface name or ID of a connection.
    Name(&'a str),
    /// The port connection itself.
    Connection(&'a PortConnection),
}

impl<'a> PortRef<'a> {
    /// Returns the name the port is known by: its interface name or, when it has none, its ID.
    pub fn name(&self) -> &'a str {
        match self {
            Self::Name(name) => name,
            Self::Connection(conn) => conn
                .interface
                .as_deref()
                .or(conn.id.as_deref())
                .unwrap_or_default(),
        }
    }
}

impl<'a> From<&'a PortEntry> for PortRef<'a> {
    fn from(entry: &'a PortEntry) -> Self {
        match entry {
            PortEntry::Name(name) => Self::Name(name),
            PortEntry::Connection(conn) => Self::Connection(conn),
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
    /// Current state of the connection
    ///
    /// Only reported as part of the system information. It is ignored when given.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<ConnectionState>,
}

/// A port of a bond or a bridge, nested in its controller.
///
/// It is a connection without IP settings, as its controller holds the IP configuration, but with
/// the settings it has as a port. Unknown fields are rejected, so that IP settings given to a port
/// are not silently ignored.
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PortConnection {
    /// Unique identifier for the network connection
    ///
    /// When it is omitted, the port refers to the connection bound to its interface, or gets the
    /// interface name as its ID.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
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
    /// Settings that this connection has because it is a port of its controller
    ///
    /// Only the ports of a bridge have them.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<PortSettings>,
    /// Bonding settings, for a port that is a bond itself
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bond: Option<BondSettings>,
    /// Bridge settings, for a port that is a bridge itself
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
    /// Current state of the connection
    ///
    /// Only reported as part of the system information. It is ignored when given.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<ConnectionState>,
}

impl From<&PortConnection> for NetworkConnection {
    /// Returns the connection a port stands for.
    ///
    /// It has no IP settings, as its controller holds them, and no port settings, which only make
    /// sense next to its controller. A port without an ID gets an empty one.
    fn from(port: &PortConnection) -> Self {
        let PortConnection {
            id,
            vlan,
            wireless,
            interface,
            match_settings,
            port: _,
            bond,
            bridge,
            custom_mac_address,
            mac_address,
            status,
            mtu,
            ieee_8021x,
            autoconnect,
            persistent,
            state,
        } = port.clone();

        Self {
            id: id.unwrap_or_default(),
            vlan,
            wireless,
            interface,
            match_settings,
            bond,
            bridge,
            custom_mac_address,
            mac_address,
            status,
            mtu,
            ieee_8021x,
            autoconnect,
            persistent,
            state,
            ..Default::default()
        }
    }
}

impl From<NetworkConnection> for PortConnection {
    /// Reports a connection as a port.
    ///
    /// Its IP settings are dropped, as its controller holds them. Its port settings are not part
    /// of the connection, so they are left empty.
    fn from(conn: NetworkConnection) -> Self {
        let NetworkConnection {
            id,
            method4: _,
            gateway4: _,
            method6: _,
            gateway6: _,
            addresses: _,
            nameservers: _,
            dns_searchlist: _,
            ignore_auto_dns: _,
            vlan,
            wireless,
            interface,
            match_settings,
            bond,
            bridge,
            custom_mac_address,
            mac_address,
            status,
            mtu,
            ieee_8021x,
            autoconnect,
            persistent,
            state,
        } = conn;

        Self {
            id: Some(id),
            vlan,
            wireless,
            interface,
            match_settings,
            port: None,
            bond,
            bridge,
            custom_mac_address,
            mac_address,
            status,
            mtu,
            ieee_8021x,
            autoconnect,
            persistent,
            state,
        }
    }
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
}

/// The lists of ports of a connection that can be a bond or a bridge, whether it is at the top level
/// ([`NetworkConnection`]) or a port itself ([`PortConnection`]).
pub trait PortLists {
    /// Returns its bond and bridge settings, if it has them.
    fn controller_settings(&self) -> (Option<&BondSettings>, Option<&BridgeSettings>);

    /// Mutable version of [`Self::controller_settings`].
    fn controller_settings_mut(
        &mut self,
    ) -> (Option<&mut BondSettings>, Option<&mut BridgeSettings>);

    /// Returns the ports declared by the connection, if it declares any.
    ///
    /// They come from `portConnections` or, when it is not given, from `ports`, which is ignored
    /// when both are given. An empty list is not the same as no list at all: an empty list means
    /// that the controller has no ports, while no list means that its ports are not part of the
    /// payload.
    fn ports(&self) -> Option<Vec<PortRef<'_>>> {
        let (names, entries) = port_lists(self.controller_settings())?;
        if let Some(entries) = entries {
            return Some(entries.iter().map(PortRef::from).collect());
        }
        names.map(|names| names.iter().map(|n| PortRef::Name(n)).collect())
    }

    /// Whether the connection gives both `ports` and `portConnections` and they do not name the
    /// same ports, regardless of the order. `ports` is ignored in that case.
    fn has_ignored_port_names(&self) -> bool {
        let Some((Some(names), Some(entries))) = port_lists(self.controller_settings()) else {
            return false;
        };
        let mut names: Vec<&str> = names.iter().map(String::as_str).collect();
        let mut given: Vec<&str> = entries.iter().map(|e| PortRef::from(e).name()).collect();
        names.sort_unstable();
        given.sort_unstable();
        names != given
    }

    /// Returns the `portConnections` list, if it is given.
    fn port_connections_mut(&mut self) -> Option<&mut Vec<PortEntry>> {
        match self.controller_settings_mut() {
            (Some(bond), _) => bond.port_connections.as_mut(),
            (None, Some(bridge)) => bridge.port_connections.as_mut(),
            (None, None) => None,
        }
    }

    /// Sets the `portConnections` list, if the connection is a bond or a bridge.
    ///
    /// The `ports` list is left alone.
    fn set_port_connections(&mut self, ports: Option<Vec<PortEntry>>) {
        match self.controller_settings_mut() {
            (Some(bond), _) => bond.port_connections = ports,
            (None, Some(bridge)) => bridge.port_connections = ports,
            (None, None) => {}
        }
    }

    /// Sets both lists of ports, as the connection is reported, if it is a bond or a bridge.
    ///
    /// The `ports` list gets the interface name (or the ID, when there is none) of every port.
    fn set_ports(&mut self, ports: Option<Vec<PortEntry>>) {
        let names = ports.as_ref().map(|ports| {
            ports
                .iter()
                .map(|port| PortRef::from(port).name().to_string())
                .collect()
        });
        match self.controller_settings_mut() {
            (Some(bond), _) => {
                bond.ports = names;
                bond.port_connections = ports;
            }
            (None, Some(bridge)) => {
                bridge.ports = names;
                bridge.port_connections = ports;
            }
            (None, None) => {}
        }
    }
}

impl PortLists for NetworkConnection {
    fn controller_settings(&self) -> (Option<&BondSettings>, Option<&BridgeSettings>) {
        (self.bond.as_ref(), self.bridge.as_ref())
    }

    fn controller_settings_mut(
        &mut self,
    ) -> (Option<&mut BondSettings>, Option<&mut BridgeSettings>) {
        (self.bond.as_mut(), self.bridge.as_mut())
    }
}

impl PortLists for PortConnection {
    fn controller_settings(&self) -> (Option<&BondSettings>, Option<&BridgeSettings>) {
        (self.bond.as_ref(), self.bridge.as_ref())
    }

    fn controller_settings_mut(
        &mut self,
    ) -> (Option<&mut BondSettings>, Option<&mut BridgeSettings>) {
        (self.bond.as_mut(), self.bridge.as_mut())
    }
}

/// Returns the `ports` and `portConnections` lists of a bond or a bridge, the bond first.
#[allow(clippy::type_complexity)]
fn port_lists<'a>(
    settings: (Option<&'a BondSettings>, Option<&'a BridgeSettings>),
) -> Option<(Option<&'a [String]>, Option<&'a [PortEntry]>)> {
    match settings {
        (Some(bond), _) => Some((bond.ports.as_deref(), bond.port_connections.as_deref())),
        (None, Some(bridge)) => Some((bridge.ports.as_deref(), bridge.port_connections.as_deref())),
        (None, None) => None,
    }
}

/// Pushes the nested ports of a connection, recursively, to the given list, as the connections
/// they stand for.
fn collect_ports(conn: &impl PortLists, all: &mut Vec<NetworkConnection>) {
    for port in conn.ports().into_iter().flatten() {
        if let PortRef::Connection(port) = port {
            all.push(NetworkConnection::from(port));
            collect_ports(port, all);
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
    fn test_port_connections_can_be_given_by_name_or_nested() {
        let json = r#"{
            "id": "br0",
            "bridge": {
                "portConnections": [
                    "eth0",
                    {
                        "interface": "bond0",
                        "port": { "priority": 32 },
                        "bond": { "mode": "802.3ad", "ports": ["eth1", "eth2"] }
                    }
                ]
            }
        }"#;
        let conn: NetworkConnection = serde_json::from_str(json).unwrap();

        let ports = conn.ports().unwrap();
        assert_eq!(ports[0], PortRef::Name("eth0"));
        let PortRef::Connection(bond0) = ports[1] else {
            panic!("bond0 is not nested");
        };
        // The ID is filled in when resolving the ports.
        assert_eq!(bond0.id, None);
        assert_eq!(bond0.port.as_ref().unwrap().priority, Some(32));
        assert_eq!(
            bond0.ports().unwrap(),
            [PortRef::Name("eth1"), PortRef::Name("eth2")]
        );

        let collection = NetworkConnectionsCollection(vec![conn.clone()]);
        let all = collection.flatten();
        let interfaces: Vec<_> = all
            .iter()
            .map(|c| c.interface.as_deref().unwrap_or(&c.id))
            .collect();
        // Ports given by name are not connections, so eth0, eth1 and eth2 are left out.
        assert_eq!(interfaces, ["br0", "bond0"]);

        // What the client sent is kept as it is.
        let serialized = serde_json::to_value(&conn).unwrap();
        assert_eq!(serialized["bridge"]["portConnections"][0], "eth0");
        assert_eq!(
            serialized["bridge"]["portConnections"][1]["interface"],
            "bond0"
        );
        assert!(serialized["bridge"].get("ports").is_none());
        assert_eq!(
            serialized["bridge"]["portConnections"][1]["bond"]["ports"],
            serde_json::json!(["eth1", "eth2"])
        );
    }

    #[test]
    fn test_ports_only_take_names() {
        let json = r#"{ "id": "bond0", "bond": { "mode": "802.3ad", "ports": [{ "interface": "eth0" }] } }"#;
        assert!(serde_json::from_str::<NetworkConnection>(json).is_err());
    }

    #[test]
    fn test_port_connections_take_precedence_over_ports() {
        let json = r#"{
            "id": "bond0",
            "bond": { "mode": "802.3ad", "ports": ["eth0"], "portConnections": ["eth1", "eth0"] }
        }"#;
        let conn: NetworkConnection = serde_json::from_str(json).unwrap();
        assert_eq!(
            conn.ports().unwrap(),
            [PortRef::Name("eth1"), PortRef::Name("eth0")]
        );
        assert!(conn.has_ignored_port_names());

        // The same ports in another order, as a client may send them back.
        let json = r#"{
            "id": "bond0",
            "bond": { "mode": "802.3ad", "ports": ["eth0", "eth1"], "portConnections": ["eth1", "eth0"] }
        }"#;
        let conn: NetworkConnection = serde_json::from_str(json).unwrap();
        assert!(!conn.has_ignored_port_names());

        let json = r#"{ "id": "bond0", "bond": { "mode": "802.3ad", "ports": ["eth0"] } }"#;
        let conn: NetworkConnection = serde_json::from_str(json).unwrap();
        assert!(!conn.has_ignored_port_names());
    }

    #[test]
    fn test_set_ports_reports_both_lists() {
        let mut bond0 = NetworkConnection {
            id: "bond0".to_string(),
            bond: Some(BondSettings::default()),
            ..Default::default()
        };
        let eth0 = PortConnection {
            id: Some("Wired connection 1".to_string()),
            interface: Some("eth0".to_string()),
            ..Default::default()
        };
        let eth1 = PortConnection {
            id: Some("eth1".to_string()),
            ..Default::default()
        };
        bond0.set_ports(Some(vec![
            PortEntry::Connection(Box::new(eth0)),
            PortEntry::Connection(Box::new(eth1)),
        ]));

        let serialized = serde_json::to_value(&bond0).unwrap();
        assert_eq!(
            serialized["bond"]["ports"],
            serde_json::json!(["eth0", "eth1"])
        );
        assert_eq!(
            serialized["bond"]["portConnections"][0]["id"],
            "Wired connection 1"
        );
        assert_eq!(serialized["bond"]["portConnections"][1]["id"], "eth1");
    }

    #[test]
    fn test_omitted_ports_are_not_an_empty_list() {
        let json = r#"{ "id": "br0", "bridge": { "stp": false } }"#;
        let conn: NetworkConnection = serde_json::from_str(json).unwrap();
        assert_eq!(conn.ports(), None);

        let json = r#"{ "id": "br0", "bridge": { "stp": false, "ports": [] } }"#;
        let conn: NetworkConnection = serde_json::from_str(json).unwrap();
        assert_eq!(conn.ports(), Some(vec![]));

        let json = r#"{ "id": "br0", "bridge": { "stp": false, "portConnections": [] } }"#;
        let conn: NetworkConnection = serde_json::from_str(json).unwrap();
        assert_eq!(conn.ports(), Some(vec![]));
    }

    #[test]
    fn test_a_nested_port_cannot_have_ip_settings() {
        for setting in [
            r#""method4": "auto""#,
            r#""addresses": ["192.168.1.2/24"]"#,
            r#""dnsSearchlist": ["example.lan"]"#,
        ] {
            let json = format!(
                r#"{{ "id": "bond0", "bond": {{ "mode": "802.3ad", "portConnections": [{{ "interface": "eth0", {setting} }}] }} }}"#
            );
            let error = serde_json::from_str::<NetworkConnection>(&json)
                .unwrap_err()
                .to_string();
            assert!(error.contains("unknown field"), "{setting}: {error}");
        }
    }

    #[test]
    fn test_a_port_stands_for_a_connection_without_ip_settings() {
        let port = PortConnection {
            interface: Some("eth0".to_string()),
            mtu: 9000,
            port: Some(PortSettings {
                priority: Some(16),
                ..Default::default()
            }),
            ..Default::default()
        };
        let conn = NetworkConnection::from(&port);
        assert_eq!(conn.id, "");
        assert_eq!(conn.mtu, 9000);
        assert!(!conn.has_ip_settings());

        let mut conn = conn;
        conn.id = "eth0".to_string();
        conn.method4 = Some(Ipv4Method::Auto);
        let port = PortConnection::from(conn);
        assert_eq!(port.id.as_deref(), Some("eth0"));
        assert_eq!(port.mtu, 9000);
        // The port settings are not part of the connection.
        assert_eq!(port.port, None);
    }

    #[test]
    fn test_an_invalid_nested_port_reports_the_actual_problem() {
        let json = r#"{ "id": "bond0", "bond": { "mode": "802.3ad", "portConnections": [{ "mtu": "big" }] } }"#;
        let error = serde_json::from_str::<NetworkConnection>(json)
            .unwrap_err()
            .to_string();
        assert!(error.contains("invalid type"), "unexpected error: {error}");
    }
}
