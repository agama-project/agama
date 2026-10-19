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
use serde::{de::DeserializeOwned, de::Error as _, Deserialize, Deserializer, Serialize};
use std::default::Default;
use std::net::IpAddr;

/// Collection of connections.
///
/// It only holds the root connections: the ports of a bond or a bridge are nested inside the
/// `portConnections` list of their controller. Use [`Self::flatten`] to go through all of them.
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[schemars(rename = "NetworkConnections")]
pub struct NetworkConnectionsCollection(pub Vec<NetworkConnection>);

impl NetworkConnectionsCollection {
    /// Returns every connection in the collection, ports included, parents before their ports.
    ///
    /// The ports are returned as the connections they stand for (see
    /// [`NestedPort::to_connection`]), named after their interface when they have no ID. Ports
    /// given by name are left out, as they are not connections yet.
    pub fn flatten(&self) -> Vec<NetworkConnection> {
        let mut all = vec![];
        for conn in &self.0 {
            all.push(conn.clone());
            collect_ports(conn, &mut all);
        }
        all
    }
}

/// Collection of connections with their current state, as the system reports them.
///
/// Like [`NetworkConnectionsCollection`], it only holds the root connections.
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[schemars(rename = "NetworkConnectionsWithState")]
pub struct NetworkConnectionsWithStateCollection(pub Vec<NetworkConnectionWithState>);

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
#[schemars(deny_unknown_fields)]
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
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
#[schemars(deny_unknown_fields)]
pub struct WirelessSettings {
    /// Password of the wireless network
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    /// Security method/key management
    #[schemars(extend("enum" = [
        "none", "owe", "ieee8021x", "wpa-psk", "sae", "wpa-eap", "wpa-eap-suite-b-192"
    ]))]
    pub security: String,
    /// SSID of the wireless network
    pub ssid: String,
    /// Wireless network mode
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

/// Bonding configuration
///
/// The ports are given in `portConnections` or, in the deprecated form, in `ports`. When both are
/// given, `ports` is ignored.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
#[schemars(deny_unknown_fields)]
pub struct BondSettings {
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
    /// Ports of the controller. When neither this list nor `ports` is given, the current ports
    /// are left alone.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub port_connections: Option<Vec<BondPort>>,
}

impl BondSettings {
    /// Sets both lists of ports, as the bond is reported.
    ///
    /// The `ports` list gets the name of every port (see [`PortRef::name`]).
    pub fn set_ports(&mut self, ports: Vec<BondPort>) {
        self.ports = Some(port_names(&ports));
        self.port_connections = Some(ports);
    }
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

/// Bridge configuration
///
/// The ports are given in `portConnections` or, in the deprecated form, in `ports`. When both are
/// given, `ports` is ignored.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
#[schemars(deny_unknown_fields)]
pub struct BridgeSettings {
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
    /// Ports of the controller. When neither this list nor `ports` is given, the current ports
    /// are left alone.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub port_connections: Option<Vec<BridgePort>>,
}

impl BridgeSettings {
    /// Sets both lists of ports, as the bridge is reported.
    ///
    /// The `ports` list gets the name of every port (see [`PortRef::name`]).
    pub fn set_ports(&mut self, ports: Vec<BridgePort>) {
        self.ports = Some(port_names(&ports));
        self.port_connections = Some(ports);
    }
}

/// Returns the names of the given ports (see [`PortRef::name`]).
fn port_names<'a, P>(ports: &'a [P]) -> Vec<String>
where
    PortRef<'a>: From<&'a P>,
{
    ports
        .iter()
        .map(|port| PortRef::from(port).name().to_string())
        .collect()
}

/// A port of a controller, whichever of its lists gives it (see [`PortLists::ports`]).
#[derive(Clone, Copy, Debug)]
pub enum PortRef<'a> {
    /// Interface name or ID of a connection.
    Name(&'a str),
    /// The port connection itself.
    Connection(&'a dyn NestedPort),
}

impl<'a> PortRef<'a> {
    /// Returns the name the port is known by: its interface name or, when it has none, its ID.
    pub fn name(&self) -> &'a str {
        match self {
            Self::Name(name) => name,
            Self::Connection(port) => port.interface().or(port.id()).unwrap_or_default(),
        }
    }
}

impl<'a> From<&'a BondPort> for PortRef<'a> {
    fn from(port: &'a BondPort) -> Self {
        match port {
            BondPort::Name(name) => Self::Name(name),
            BondPort::Ethernet(port) => Self::Connection(port.as_ref()),
            BondPort::Wireless(port) => Self::Connection(port.as_ref()),
        }
    }
}

impl<'a> From<&'a BridgePort> for PortRef<'a> {
    fn from(port: &'a BridgePort) -> Self {
        match port {
            BridgePort::Name(name) => Self::Name(name),
            BridgePort::Ethernet(port) => Self::Connection(port.as_ref()),
            BridgePort::Bond(port) => Self::Connection(port.as_ref()),
            BridgePort::Vlan(port) => Self::Connection(port.as_ref()),
        }
    }
}

/// A port nested in its controller, whatever its kind (see [BondPort] and [BridgePort]).
///
/// It is a connection without IP settings, as its controller holds the IP configuration, but with
/// the settings it has as a port.
pub trait NestedPort: PortLists + std::fmt::Debug {
    /// Unique identifier of the connection, if the port gives it.
    ///
    /// When it is omitted, the port refers to the connection bound to its interface, or gets the
    /// interface name as its ID.
    fn id(&self) -> Option<&str>;

    /// Network interface associated with the connection, if the port gives it.
    fn interface(&self) -> Option<&str>;

    /// Settings that the connection has because it is a port of a bridge, if it gives them.
    fn port_settings(&self) -> Option<&BridgePortSettings>;

    /// Returns the connection the port stands for, with the given ID.
    ///
    /// It has no IP settings, as its controller holds them, and no port settings, which only make
    /// sense next to its controller. The ID is given because a port can omit it, and which one it
    /// gets depends on the connections that already exist.
    ///
    /// * `id`: ID of the connection.
    fn to_connection(&self, id: String) -> NetworkConnection;
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
        self.priority.is_none() && self.path_cost.is_none()
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
#[schemars(deny_unknown_fields)]
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
#[serde(rename_all = "camelCase")]
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
pub struct NetworkDevice {
    pub id: String,
    pub type_: DeviceType,
    pub state: DeviceState,
}

/// Represents the configuration details for a network connection
///
/// The ports of a bond or a bridge are nested in its controller (see [BondPort] and
/// [BridgePort]).
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
#[schemars(deny_unknown_fields, transform = add_dns_searchlist_alias)]
pub struct NetworkConnection {
    /// Unique identifier for the network connection
    pub id: String,
    /// IPv4 method used for the network connection
    ///
    /// Defaults to 'auto'.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method4: Option<Ipv4Method>,
    /// Gateway IP address for the IPv4 connection
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(extend("examples" = ["192.168.122.1"]))]
    pub gateway4: Option<IpAddr>,
    /// IPv6 method used for the network connection
    ///
    /// Defaults to 'auto'.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method6: Option<Ipv6Method>,
    /// Gateway IP address for the IPv6 connection
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
    #[serde(rename = "ieee-8021x", skip_serializing_if = "Option::is_none")]
    pub ieee_8021x: Option<IEEE8021XSettings>,
    /// Specifies if the connection should automatically connect
    #[serde(skip_serializing_if = "Option::is_none")]
    pub autoconnect: Option<bool>,
    /// Specifies whether the connection should be persisted or not
    #[serde(skip_serializing_if = "Option::is_none")]
    pub persistent: Option<bool>,
}

/// A connection as the system reports it, with its current state.
///
/// The state is not part of the configuration, so only the system information reports it. The
/// ports nested in a controller do not report it.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct NetworkConnectionWithState {
    #[serde(flatten)]
    pub connection: NetworkConnection,
    /// Current state of the connection
    pub state: ConnectionState,
}

/// Sections that only some kinds of ports have (see [`port_type`]).
#[derive(Default)]
struct PortSections<'a> {
    port: Option<&'a BridgePortSettings>,
    bond: Option<&'a BondSettings>,
    vlan: Option<&'a VlanSettings>,
    wireless: Option<&'a WirelessSettings>,
}

/// Defines a kind of port of a kind of controller.
///
/// It is a connection without IP settings, as its controller holds the IP configuration, with the
/// settings that every port has plus the given ones: the section that tells its kind (none for an
/// Ethernet port) and, when its controller has them, its settings as a port. Unknown fields are
/// rejected, so that a setting that does not apply to the port is not silently ignored.
///
/// The given fields must be named after a field of [`PortSections`].
macro_rules! port_type {
    (
        $(#[$meta:meta])*
        $name:ident {
            $( $(#[$field_meta:meta])* $field:ident: $type:ty, )*
        }
    ) => {
        $(#[$meta])*
        #[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
        #[serde(rename_all = "camelCase", deny_unknown_fields)]
        pub struct $name {
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
            $( $(#[$field_meta])* pub $field: $type, )*
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
            #[serde(rename = "ieee-8021x", skip_serializing_if = "Option::is_none")]
            pub ieee_8021x: Option<IEEE8021XSettings>,
            /// Specifies if the connection should automatically connect
            #[serde(skip_serializing_if = "Option::is_none")]
            pub autoconnect: Option<bool>,
            /// Specifies whether the connection should be persisted or not
            #[serde(skip_serializing_if = "Option::is_none")]
            pub persistent: Option<bool>,
        }

        impl $name {
            /// Reports a connection as this kind of port, with the given sections.
            ///
            /// Its IP settings are dropped, as its controller holds them, and so are its sections:
            /// the ones of the port are given.
            fn from_connection(conn: NetworkConnection, $( $field: $type, )*) -> Self {
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
                    vlan: _,
                    wireless: _,
                    interface,
                    match_settings,
                    bond: _,
                    bridge: _,
                    custom_mac_address,
                    mac_address,
                    status,
                    mtu,
                    ieee_8021x,
                    autoconnect,
                    persistent,
                } = conn;

                Self {
                    id: Some(id),
                    interface,
                    match_settings,
                    $( $field, )*
                    custom_mac_address,
                    mac_address,
                    status,
                    mtu,
                    ieee_8021x,
                    autoconnect,
                    persistent,
                }
            }

            fn sections(&self) -> PortSections<'_> {
                PortSections {
                    $( $field: (&self.$field).into(), )*
                    ..Default::default()
                }
            }
        }

        impl PortLists for $name {
            fn controller_settings(&self) -> (Option<&BondSettings>, Option<&BridgeSettings>) {
                (self.sections().bond, None)
            }
        }

        impl NestedPort for $name {
            fn id(&self) -> Option<&str> {
                self.id.as_deref()
            }

            fn interface(&self) -> Option<&str> {
                self.interface.as_deref()
            }

            fn port_settings(&self) -> Option<&BridgePortSettings> {
                self.sections().port
            }

            fn to_connection(&self, id: String) -> NetworkConnection {
                let sections = self.sections();
                NetworkConnection {
                    id,
                    vlan: sections.vlan.cloned(),
                    wireless: sections.wireless.cloned(),
                    interface: self.interface.clone(),
                    match_settings: self.match_settings.clone(),
                    bond: sections.bond.cloned(),
                    custom_mac_address: self.custom_mac_address.clone(),
                    mac_address: self.mac_address.clone(),
                    status: self.status,
                    mtu: self.mtu,
                    ieee_8021x: self.ieee_8021x.clone(),
                    autoconnect: self.autoconnect,
                    persistent: self.persistent,
                    ..Default::default()
                }
            }
        }
    };
}

port_type! {
    /// Port of a bridge that is an Ethernet connection, or any other kind of connection that has
    /// no section of its own (e.g., InfiniBand)
    #[derive(Default)]
    BridgeEthernetPort {
        /// Settings that this connection has because it is a port of a bridge
        #[serde(skip_serializing_if = "Option::is_none")]
        port: Option<BridgePortSettings>,
    }
}

port_type! {
    /// Port of a bridge that is a bond itself
    #[derive(Default)]
    BridgeBondPort {
        /// Bonding settings
        bond: BondSettings,
        /// Settings that this connection has because it is a port of a bridge
        #[serde(skip_serializing_if = "Option::is_none")]
        port: Option<BridgePortSettings>,
    }
}

port_type! {
    /// Port of a bridge that is a VLAN
    BridgeVlanPort {
        /// VLAN settings
        vlan: VlanSettings,
        /// Settings that this connection has because it is a port of a bridge
        #[serde(skip_serializing_if = "Option::is_none")]
        port: Option<BridgePortSettings>,
    }
}

port_type! {
    /// Port of a bond that is an Ethernet connection, or any other kind of connection that has
    /// no section of its own (e.g., InfiniBand)
    #[derive(Default)]
    BondEthernetPort {}
}

port_type! {
    /// Port of a bond that is a wireless connection
    #[derive(Default)]
    BondWirelessPort {
        /// Wireless settings
        wireless: WirelessSettings,
    }
}

/// Entry of the `portConnections` list of a bridge.
///
/// A port given as a connection is told apart by the section it has: `bond`, `vlan` or none of
/// them, for an Ethernet port.
#[derive(Clone, Debug, Serialize, JsonSchema, PartialEq)]
#[serde(untagged)]
pub enum BridgePort {
    /// Interface name or ID of a connection.
    ///
    /// It is a shorthand for `{ "interface": "<name>" }`: it refers to the connection with that
    /// interface name or ID, and a new Ethernet connection is created when there is none.
    Name(String),
    Ethernet(Box<BridgeEthernetPort>),
    Bond(Box<BridgeBondPort>),
    Vlan(Box<BridgeVlanPort>),
}

impl BridgePort {
    /// Reports a connection as a port of a bridge.
    ///
    /// Its IP settings are dropped, as its controller holds them. The connection is given back
    /// when it cannot be a port of a bridge.
    ///
    /// * `conn`: connection to report.
    /// * `port`: settings it has as a port of the bridge.
    pub fn from_connection(
        mut conn: NetworkConnection,
        port: Option<BridgePortSettings>,
    ) -> Result<Self, Box<NetworkConnection>> {
        if conn.bridge.is_some() || conn.wireless.is_some() {
            return Err(Box::new(conn));
        }

        let port = if let Some(bond) = conn.bond.take() {
            Self::Bond(Box::new(BridgeBondPort::from_connection(conn, bond, port)))
        } else if let Some(vlan) = conn.vlan.take() {
            Self::Vlan(Box::new(BridgeVlanPort::from_connection(conn, vlan, port)))
        } else {
            Self::Ethernet(Box::new(BridgeEthernetPort::from_connection(conn, port)))
        };
        Ok(port)
    }
}

/// Entry of the `portConnections` list of a bond.
///
/// Only physical interfaces can be the ports of a bond. A port given as a connection is told apart
/// by the section it has: `wireless` or none, for an Ethernet port.
#[derive(Clone, Debug, Serialize, JsonSchema, PartialEq)]
#[serde(untagged)]
pub enum BondPort {
    /// Interface name or ID of a connection.
    ///
    /// It is a shorthand for `{ "interface": "<name>" }`: it refers to the connection with that
    /// interface name or ID, and a new Ethernet connection is created when there is none.
    Name(String),
    Ethernet(Box<BondEthernetPort>),
    Wireless(Box<BondWirelessPort>),
}

impl BondPort {
    /// Reports a connection as a port of a bond.
    ///
    /// Its IP settings are dropped, as its controller holds them. The connection is given back
    /// when it cannot be a port of a bond.
    ///
    /// * `conn`: connection to report.
    pub fn from_connection(mut conn: NetworkConnection) -> Result<Self, Box<NetworkConnection>> {
        if conn.bond.is_some() || conn.bridge.is_some() || conn.vlan.is_some() {
            return Err(Box::new(conn));
        }

        let port = match conn.wireless.take() {
            Some(wireless) => {
                Self::Wireless(Box::new(BondWirelessPort::from_connection(conn, wireless)))
            }
            None => Self::Ethernet(Box::new(BondEthernetPort::from_connection(conn))),
        };
        Ok(port)
    }
}

// The ports are read by hand because an untagged enum reports any problem in a nested port as
// "data did not match any variant", which does not help anybody fix a profile. Instead, the kind
// of the port is told by its section, and the problems of the port are reported as they are.

impl<'de> Deserialize<'de> for BridgePort {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = serde_json::Value::deserialize(deserializer)?;
        if let serde_json::Value::String(name) = value {
            return Ok(Self::Name(name));
        }

        match port_kind(&value).map_err(D::Error::custom)? {
            None => read_port(value).map(Self::Ethernet),
            Some(PortKind::Bond) => read_port(value).map(Self::Bond),
            Some(PortKind::Vlan) => read_port(value).map(Self::Vlan),
            Some(kind) => Err(D::Error::custom(format!(
                "a port of a bridge cannot be {kind}"
            ))),
        }
    }
}

impl<'de> Deserialize<'de> for BondPort {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = serde_json::Value::deserialize(deserializer)?;
        if let serde_json::Value::String(name) = value {
            return Ok(Self::Name(name));
        }

        match port_kind(&value).map_err(D::Error::custom)? {
            None => read_port(value).map(Self::Ethernet),
            Some(PortKind::Wireless) => read_port(value).map(Self::Wireless),
            Some(kind) => Err(D::Error::custom(format!(
                "a port of a bond cannot be {kind}"
            ))),
        }
    }
}

/// Kind of a port given as a connection, told by the section it has.
#[derive(Clone, Copy, Debug, PartialEq, strum::Display)]
enum PortKind {
    #[strum(to_string = "a bond")]
    Bond,
    #[strum(to_string = "a bridge")]
    Bridge,
    #[strum(to_string = "a VLAN")]
    Vlan,
    #[strum(to_string = "a wireless connection")]
    Wireless,
}

/// Returns the kind of a port given as a connection, or `None` for an Ethernet port, which has no
/// section of its own.
fn port_kind(port: &serde_json::Value) -> Result<Option<PortKind>, String> {
    let sections = [
        ("bond", PortKind::Bond),
        ("bridge", PortKind::Bridge),
        ("vlan", PortKind::Vlan),
        ("wireless", PortKind::Wireless),
    ];
    let given: Vec<_> = sections
        .into_iter()
        .filter(|(section, _)| port.get(section).is_some())
        .collect();

    match given.as_slice() {
        [] => Ok(None),
        [(_, kind)] => Ok(Some(*kind)),
        _ => {
            let names: Vec<_> = given.iter().map(|(s, _)| format!("`{s}`")).collect();
            Err(format!(
                "a port cannot have more than one of {}",
                names.join(", ")
            ))
        }
    }
}

/// Reads a port of a known kind, reporting its problems as they are.
fn read_port<T: DeserializeOwned, E: serde::de::Error>(value: serde_json::Value) -> Result<T, E> {
    serde_json::from_value(value).map_err(E::custom)
}

/// Adds the deprecated `dnsSearchlist` alias to the schema of a connection.
///
/// schemars ignores the serde aliases, as JSON Schema has no such concept.
fn add_dns_searchlist_alias(schema: &mut schemars::Schema) {
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
/// ([`NetworkConnection`]) or a port itself ([`NestedPort`]).
pub trait PortLists {
    /// Returns its bond and bridge settings, if it has them.
    fn controller_settings(&self) -> (Option<&BondSettings>, Option<&BridgeSettings>);

    /// Returns the ports declared by the connection, if it declares any.
    ///
    /// They come from `portConnections` or, when it is not given, from `ports`, which is ignored
    /// when both are given. An empty list is not the same as no list at all: an empty list means
    /// that the controller has no ports, while no list means that its ports are not part of the
    /// payload.
    fn ports(&self) -> Option<Vec<PortRef<'_>>> {
        let (names, entries) = port_lists(self.controller_settings())?;
        if entries.is_some() {
            return entries;
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
        let mut given: Vec<&str> = entries.iter().map(PortRef::name).collect();
        names.sort_unstable();
        given.sort_unstable();
        names != given
    }
}

impl PortLists for NetworkConnection {
    fn controller_settings(&self) -> (Option<&BondSettings>, Option<&BridgeSettings>) {
        (self.bond.as_ref(), self.bridge.as_ref())
    }
}

/// Returns the `ports` and `portConnections` lists of a bond or a bridge, the bond first.
#[allow(clippy::type_complexity)]
fn port_lists<'a>(
    settings: (Option<&'a BondSettings>, Option<&'a BridgeSettings>),
) -> Option<(Option<&'a [String]>, Option<Vec<PortRef<'a>>>)> {
    fn refs<'a, P>(ports: &'a Option<Vec<P>>) -> Option<Vec<PortRef<'a>>>
    where
        PortRef<'a>: From<&'a P>,
    {
        ports
            .as_ref()
            .map(|ports| ports.iter().map(PortRef::from).collect())
    }

    match settings {
        (Some(bond), _) => Some((bond.ports.as_deref(), refs(&bond.port_connections))),
        (None, Some(bridge)) => Some((bridge.ports.as_deref(), refs(&bridge.port_connections))),
        (None, None) => None,
    }
}

/// Pushes the nested ports of a connection, recursively, to the given list, as the connections
/// they stand for.
fn collect_ports(conn: &(impl PortLists + ?Sized), all: &mut Vec<NetworkConnection>) {
    for port in conn.ports().into_iter().flatten() {
        if let PortRef::Connection(port) = port {
            let id = port.id().or(port.interface()).unwrap_or_default();
            all.push(port.to_connection(id.to_string()));
            collect_ports(port, all);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Returns the names of the given ports (see [`PortRef::name`]).
    fn names(ports: Option<Vec<PortRef<'_>>>) -> Option<Vec<&str>> {
        ports.map(|ports| ports.iter().map(PortRef::name).collect())
    }

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
    fn test_network_connection_link_local_method() {
        // "linkLocal" was the name the API used, so it is still accepted.
        for name in ["link-local", "linkLocal"] {
            let json = format!(r#"{{ "id": "eth0", "method4": "{name}", "method6": "{name}" }}"#);
            let conn: NetworkConnection = serde_json::from_str(&json).unwrap();
            assert_eq!(conn.method4, Some(Ipv4Method::LinkLocal));
            assert_eq!(conn.method6, Some(Ipv6Method::LinkLocal));

            let serialized = serde_json::to_value(&conn).unwrap();
            assert_eq!(serialized["method4"], "link-local");
            assert_eq!(serialized["method6"], "link-local");
        }
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
        assert!(matches!(ports[0], PortRef::Name("eth0")));
        let PortRef::Connection(bond0) = ports[1] else {
            panic!("bond0 is not nested");
        };
        // The ID is filled in when resolving the ports.
        assert_eq!(bond0.id(), None);
        assert_eq!(bond0.port_settings().unwrap().priority, Some(32));
        assert_eq!(names(bond0.ports()).unwrap(), ["eth1", "eth2"]);

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
        assert_eq!(names(conn.ports()).unwrap(), ["eth1", "eth0"]);
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
        let eth0 = BondEthernetPort {
            id: Some("Wired connection 1".to_string()),
            interface: Some("eth0".to_string()),
            ..Default::default()
        };
        let eth1 = BondEthernetPort {
            id: Some("eth1".to_string()),
            ..Default::default()
        };
        let mut bond = BondSettings::default();
        bond.set_ports(vec![
            BondPort::Ethernet(Box::new(eth0)),
            BondPort::Ethernet(Box::new(eth1)),
        ]);
        let bond0 = NetworkConnection {
            id: "bond0".to_string(),
            bond: Some(bond),
            ..Default::default()
        };

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
        assert!(conn.ports().is_none());

        let json = r#"{ "id": "br0", "bridge": { "stp": false, "ports": [] } }"#;
        let conn: NetworkConnection = serde_json::from_str(json).unwrap();
        assert!(conn.ports().is_some_and(|ports| ports.is_empty()));

        let json = r#"{ "id": "br0", "bridge": { "stp": false, "portConnections": [] } }"#;
        let conn: NetworkConnection = serde_json::from_str(json).unwrap();
        assert!(conn.ports().is_some_and(|ports| ports.is_empty()));
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
        let port = BridgeEthernetPort {
            interface: Some("eth0".to_string()),
            mtu: 9000,
            port: Some(BridgePortSettings {
                priority: Some(16),
                ..Default::default()
            }),
            ..Default::default()
        };
        let conn = port.to_connection("eth0".to_string());
        assert_eq!(conn.id, "eth0");
        assert_eq!(conn.mtu, 9000);
        assert!(!conn.has_ip_settings());

        let mut conn = conn;
        conn.method4 = Some(Ipv4Method::Auto);
        let BridgePort::Ethernet(port) = BridgePort::from_connection(conn, None).unwrap() else {
            panic!("eth0 is not reported as an Ethernet port");
        };
        assert_eq!(port.id.as_deref(), Some("eth0"));
        assert_eq!(port.mtu, 9000);
        assert_eq!(port.port, None);
    }

    #[test]
    fn test_a_connection_is_reported_as_its_kind_of_port() {
        let conn = |json: &str| serde_json::from_str::<NetworkConnection>(json).unwrap();
        let bond0 = conn(r#"{ "id": "bond0", "bond": { "mode": "802.3ad" } }"#);
        let br1 = conn(r#"{ "id": "br1", "bridge": {} }"#);
        let vlan = conn(r#"{ "id": "eth0.100", "vlan": { "parent": "eth0", "id": 100 } }"#);
        let wlan0 = conn(
            r#"{ "id": "wlan0", "wireless": { "ssid": "agama", "security": "none", "mode": "infrastructure" } }"#,
        );

        assert!(matches!(
            BridgePort::from_connection(bond0.clone(), None),
            Ok(BridgePort::Bond(_))
        ));
        assert!(matches!(
            BridgePort::from_connection(vlan.clone(), None),
            Ok(BridgePort::Vlan(_))
        ));
        assert!(BridgePort::from_connection(br1.clone(), None).is_err());
        assert!(BridgePort::from_connection(wlan0.clone(), None).is_err());

        assert!(matches!(
            BondPort::from_connection(wlan0),
            Ok(BondPort::Wireless(_))
        ));
        // Only physical interfaces can be the ports of a bond.
        for conn in [bond0, br1, vlan] {
            let id = conn.id.clone();
            assert_eq!(BondPort::from_connection(conn).unwrap_err().id, id);
        }
    }

    #[test]
    fn test_nested_ports_only_take_the_settings_of_their_controller() {
        let error = |json: &str| {
            serde_json::from_str::<NetworkConnection>(json)
                .unwrap_err()
                .to_string()
        };

        let json = r#"{ "id": "bond0", "bond": { "mode": "802.3ad", "portConnections": [{ "interface": "eth0", "port": { "priority": 32 } }] } }"#;
        assert!(error(json).contains("unknown field `port`"));

        let json = r#"{ "id": "br0", "bridge": { "portConnections": [{ "interface": "br1", "bridge": {} }] } }"#;
        assert!(error(json).contains("a port of a bridge cannot be a bridge"));

        let json = r#"{ "id": "bond0", "bond": { "mode": "802.3ad", "portConnections": [{ "interface": "bond1", "bond": { "mode": "802.3ad" } }] } }"#;
        assert!(error(json).contains("a port of a bond cannot be a bond"));

        // Only physical interfaces can be the ports of a bond.
        let json = r#"{ "id": "bond0", "bond": { "mode": "802.3ad", "portConnections": [{ "interface": "br0", "bridge": {} }] } }"#;
        assert!(error(json).contains("a port of a bond cannot be a bridge"));

        let json = r#"{ "id": "bond0", "bond": { "mode": "802.3ad", "portConnections": [{ "interface": "eth0.100", "vlan": { "parent": "eth0", "id": 100 } }] } }"#;
        assert!(error(json).contains("a port of a bond cannot be a VLAN"));

        let json = r#"{ "id": "br0", "bridge": { "portConnections": [{ "interface": "wlan0", "wireless": { "ssid": "agama", "security": "none", "mode": "infrastructure" } }] } }"#;
        assert!(error(json).contains("a port of a bridge cannot be a wireless connection"));

        let json = r#"{ "id": "br0", "bridge": { "portConnections": [{ "interface": "bond0", "bond": { "mode": "802.3ad" }, "vlan": { "parent": "eth0", "id": 100 } }] } }"#;
        assert!(error(json).contains("a port cannot have more than one of `bond`, `vlan`"));
    }

    #[test]
    fn test_a_nested_port_is_read_as_the_connection_it_stands_for() {
        let json = r#"{
            "id": "br0",
            "bridge": {
                "portConnections": [
                    {
                        "interface": "bond0",
                        "port": { "priority": 32 },
                        "bond": {
                            "mode": "active-backup",
                            "portConnections": [
                                { "interface": "eth0", "mtu": 9000 },
                                { "interface": "wlan0", "wireless": { "ssid": "agama", "security": "none", "mode": "infrastructure" } }
                            ]
                        }
                    },
                    { "interface": "eth1.100", "vlan": { "parent": "eth1", "id": 100 } }
                ]
            }
        }"#;
        let conn: NetworkConnection = serde_json::from_str(json).unwrap();
        let ports = conn
            .bridge
            .as_ref()
            .unwrap()
            .port_connections
            .as_ref()
            .unwrap();
        let [BridgePort::Bond(bond0), BridgePort::Vlan(vlan)] = ports.as_slice() else {
            panic!("unexpected ports: {ports:?}");
        };
        assert_eq!(bond0.port.as_ref().unwrap().priority, Some(32));
        assert_eq!(vlan.vlan.id, 100);

        let ports = bond0.bond.port_connections.as_ref().unwrap();
        let [BondPort::Ethernet(eth0), BondPort::Wireless(wlan0)] = ports.as_slice() else {
            panic!("unexpected ports: {ports:?}");
        };
        assert_eq!(eth0.mtu, 9000);
        assert_eq!(wlan0.wireless.ssid, "agama");

        let flattened = NetworkConnectionsCollection(vec![conn.clone()]).flatten();
        let ids: Vec<_> = flattened.iter().map(|c| c.id.as_str()).collect();
        assert_eq!(ids, ["br0", "bond0", "eth0", "wlan0", "eth1.100"]);
        assert_eq!(flattened[2].mtu, 9000);
        assert!(flattened[3].wireless.is_some());
        assert!(flattened[4].vlan.is_some());

        // Reported as it was given, so it can be sent back.
        let serialized = serde_json::to_value(&conn).unwrap();
        let read: NetworkConnection = serde_json::from_value(serialized).unwrap();
        assert_eq!(read, conn);
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
