// Copyright (c) [2026] SUSE LLC
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

//! Representation of the connections as the system information reports them.
//!
//! It is the same tree as the configuration (see [`NetworkConnection`]), built from the same parts
//! ([`ConnectionBase`], [`IpSettings`], [`BondBase`], [`BridgeBase`] and [`PortBase`]), plus the
//! current state of every connection, nested ports included. The state of a port is not the one of
//! its controller (e.g., the backup port of an active bond is not active).
//!
//! The tree is built from the configuration one, looking up the state of each connection by its ID
//! (see [`SystemNetworkConnection::new`]).

use super::settings::{
    add_dns_searchlist_alias, BondBase, BondBondPort, BondBridgePort, BondEthernetPort, BondPort,
    BondSettings, BondVlanPort, BondWirelessPort, BridgeBase, BridgeBondPort, BridgeBridgePort,
    BridgeEthernetPort, BridgePort, BridgePortSettings, BridgeSettings, BridgeVlanPort,
    BridgeWirelessPort, ConnectionBase, IpSettings, NetworkConnection, PortBase, VlanSettings,
    WirelessSettings,
};
use super::types::ConnectionState;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Collection of connections with their current state, as the system reports them.
///
/// Like [`NetworkConnectionsCollection`](super::NetworkConnectionsCollection), it only holds the root connections.
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[schemars(rename = "SystemNetworkConnections")]
pub struct SystemNetworkConnectionsCollection(pub Vec<SystemNetworkConnection>);

/// Returns the state of the connection with the given ID.
pub type StateOf<'a> = &'a dyn Fn(&str) -> ConnectionState;

impl PortBase {
    /// Returns the state of the connection the port stands for.
    ///
    /// It is known by its ID or, when it has none, by its interface (see
    /// [`NetworkConnectionsCollection::flatten`](super::NetworkConnectionsCollection::flatten)).
    fn state(&self, state_of: StateOf) -> ConnectionState {
        state_of(
            self.id
                .as_deref()
                .or(self.interface.as_deref())
                .unwrap_or_default(),
        )
    }
}

/// A connection as the system reports it, with its current state.
///
/// The state is not part of the configuration, so only the system information reports it, for
/// every connection, nested ports included.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[schemars(deny_unknown_fields, transform = add_dns_searchlist_alias)]
pub struct SystemNetworkConnection {
    #[serde(flatten)]
    pub base: ConnectionBase,
    #[serde(flatten)]
    pub ip: IpSettings,
    /// Bonding settings if part of a bond
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bond: Option<SystemBondSettings>,
    /// Bridge settings if part of a bridge
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bridge: Option<SystemBridgeSettings>,
    /// Current state of the connection
    pub state: ConnectionState,
}

impl SystemNetworkConnection {
    /// Reports a connection and, recursively, its nested ports with their state.
    ///
    /// * `conn`: connection to report.
    /// * `state_of`: returns the state of the connection with the given ID.
    pub fn new(conn: NetworkConnection, state_of: StateOf) -> Self {
        Self {
            state: state_of(&conn.base.id),
            base: conn.base,
            ip: conn.ip,
            bond: conn.bond.map(|b| SystemBondSettings::new(b, state_of)),
            bridge: conn.bridge.map(|b| SystemBridgeSettings::new(b, state_of)),
        }
    }
}

/// Bonding configuration with the state of the ports, as the system reports it.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
#[schemars(deny_unknown_fields)]
pub struct SystemBondSettings {
    #[serde(flatten)]
    pub base: BondBase,
    /// Ports of the controller, with their current state
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub port_connections: Option<Vec<SystemBondPort>>,
}

impl SystemBondSettings {
    fn new(settings: BondSettings, state_of: StateOf) -> Self {
        Self {
            base: settings.base,
            port_connections: settings.port_connections.map(|ports| {
                ports
                    .into_iter()
                    .map(|port| SystemBondPort::new(port, state_of))
                    .collect()
            }),
        }
    }
}

/// Bridge configuration with the state of the ports, as the system reports it.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
#[schemars(deny_unknown_fields)]
pub struct SystemBridgeSettings {
    #[serde(flatten)]
    pub base: BridgeBase,
    /// Ports of the controller, with their current state
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub port_connections: Option<Vec<SystemBridgePort>>,
}

impl SystemBridgeSettings {
    fn new(settings: BridgeSettings, state_of: StateOf) -> Self {
        Self {
            base: settings.base,
            port_connections: settings.port_connections.map(|ports| {
                ports
                    .into_iter()
                    .map(|port| SystemBridgePort::new(port, state_of))
                    .collect()
            }),
        }
    }
}

/// Entry of the `portConnections` list of a bridge, with the state of the port.
///
/// Like [`BridgePort`], with the state of every port given as a connection.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(untagged)]
pub enum SystemBridgePort {
    /// Interface name or ID of a connection, which reports no state.
    Name(String),
    Ethernet(Box<SystemBridgeEthernetPort>),
    Bond(Box<SystemBridgeBondPort>),
    Bridge(Box<SystemBridgeBridgePort>),
    Vlan(Box<SystemBridgeVlanPort>),
    Wireless(Box<SystemBridgeWirelessPort>),
}

impl SystemBridgePort {
    fn new(port: BridgePort, state_of: StateOf) -> Self {
        match port {
            BridgePort::Name(name) => Self::Name(name),
            BridgePort::Ethernet(port) => {
                let BridgeEthernetPort { base, port } = *port;
                Self::Ethernet(Box::new(SystemBridgeEthernetPort {
                    state: base.state(state_of),
                    base,
                    port,
                }))
            }
            BridgePort::Bond(port) => {
                let BridgeBondPort { base, bond, port } = *port;
                Self::Bond(Box::new(SystemBridgeBondPort {
                    state: base.state(state_of),
                    base,
                    bond: SystemBondSettings::new(bond, state_of),
                    port,
                }))
            }
            BridgePort::Bridge(port) => {
                let BridgeBridgePort { base, bridge, port } = *port;
                Self::Bridge(Box::new(SystemBridgeBridgePort {
                    state: base.state(state_of),
                    base,
                    bridge: SystemBridgeSettings::new(bridge, state_of),
                    port,
                }))
            }
            BridgePort::Vlan(port) => {
                let BridgeVlanPort { base, vlan, port } = *port;
                Self::Vlan(Box::new(SystemBridgeVlanPort {
                    state: base.state(state_of),
                    base,
                    vlan,
                    port,
                }))
            }
            BridgePort::Wireless(port) => {
                let BridgeWirelessPort {
                    base,
                    wireless,
                    port,
                } = *port;
                Self::Wireless(Box::new(SystemBridgeWirelessPort {
                    state: base.state(state_of),
                    base,
                    wireless,
                    port,
                }))
            }
        }
    }
}

/// Entry of the `portConnections` list of a bond, with the state of the port.
///
/// Like [`BondPort`], with the state of every port given as a connection.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(untagged)]
pub enum SystemBondPort {
    /// Interface name or ID of a connection, which reports no state.
    Name(String),
    Ethernet(Box<SystemBondEthernetPort>),
    Bond(Box<SystemBondBondPort>),
    Bridge(Box<SystemBondBridgePort>),
    Vlan(Box<SystemBondVlanPort>),
    Wireless(Box<SystemBondWirelessPort>),
}

impl SystemBondPort {
    fn new(port: BondPort, state_of: StateOf) -> Self {
        match port {
            BondPort::Name(name) => Self::Name(name),
            BondPort::Ethernet(port) => {
                let BondEthernetPort { base } = *port;
                Self::Ethernet(Box::new(SystemBondEthernetPort {
                    state: base.state(state_of),
                    base,
                }))
            }
            BondPort::Bond(port) => {
                let BondBondPort { base, bond } = *port;
                Self::Bond(Box::new(SystemBondBondPort {
                    state: base.state(state_of),
                    base,
                    bond: SystemBondSettings::new(bond, state_of),
                }))
            }
            BondPort::Bridge(port) => {
                let BondBridgePort { base, bridge } = *port;
                Self::Bridge(Box::new(SystemBondBridgePort {
                    state: base.state(state_of),
                    base,
                    bridge: SystemBridgeSettings::new(bridge, state_of),
                }))
            }
            BondPort::Vlan(port) => {
                let BondVlanPort { base, vlan } = *port;
                Self::Vlan(Box::new(SystemBondVlanPort {
                    state: base.state(state_of),
                    base,
                    vlan,
                }))
            }
            BondPort::Wireless(port) => {
                let BondWirelessPort { base, wireless } = *port;
                Self::Wireless(Box::new(SystemBondWirelessPort {
                    state: base.state(state_of),
                    base,
                    wireless,
                }))
            }
        }
    }
}

// The ports with their state. Each one mirrors the port of the configuration with the same name
// and adds the state. Like those, it flattens [`PortBase`] directly (not the port of the
// configuration, which flattens it too) and rejects unknown fields, so that each kind of port is
// told apart from the others when it is read back.

/// Port of a bridge that is an Ethernet connection, with its current state
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SystemBridgeEthernetPort {
    #[serde(flatten)]
    pub base: PortBase,
    /// Settings that this connection has because it is a port of a bridge
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<BridgePortSettings>,
    /// Current state of the connection
    pub state: ConnectionState,
}

/// Port of a bridge that is a bond itself, with its current state and the one of its ports
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SystemBridgeBondPort {
    #[serde(flatten)]
    pub base: PortBase,
    /// Bonding settings
    pub bond: SystemBondSettings,
    /// Settings that this connection has because it is a port of a bridge
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<BridgePortSettings>,
    /// Current state of the connection
    pub state: ConnectionState,
}

/// Port of a bridge that is a bridge itself, with its current state and the one of its ports
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SystemBridgeBridgePort {
    #[serde(flatten)]
    pub base: PortBase,
    /// Bridge settings
    pub bridge: SystemBridgeSettings,
    /// Settings that this connection has because it is a port of a bridge
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<BridgePortSettings>,
    /// Current state of the connection
    pub state: ConnectionState,
}

/// Port of a bridge that is a VLAN, with its current state
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SystemBridgeVlanPort {
    #[serde(flatten)]
    pub base: PortBase,
    /// VLAN settings
    pub vlan: VlanSettings,
    /// Settings that this connection has because it is a port of a bridge
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<BridgePortSettings>,
    /// Current state of the connection
    pub state: ConnectionState,
}

/// Port of a bridge that is a wireless connection, with its current state
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SystemBridgeWirelessPort {
    #[serde(flatten)]
    pub base: PortBase,
    /// Wireless settings
    pub wireless: WirelessSettings,
    /// Settings that this connection has because it is a port of a bridge
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<BridgePortSettings>,
    /// Current state of the connection
    pub state: ConnectionState,
}

/// Port of a bond that is an Ethernet connection, with its current state
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SystemBondEthernetPort {
    #[serde(flatten)]
    pub base: PortBase,
    /// Current state of the connection
    pub state: ConnectionState,
}

/// Port of a bond that is a bond itself, with its current state and the one of its ports
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SystemBondBondPort {
    #[serde(flatten)]
    pub base: PortBase,
    /// Bonding settings
    pub bond: SystemBondSettings,
    /// Current state of the connection
    pub state: ConnectionState,
}

/// Port of a bond that is a bridge, with its current state and the one of its ports
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SystemBondBridgePort {
    #[serde(flatten)]
    pub base: PortBase,
    /// Bridge settings
    pub bridge: SystemBridgeSettings,
    /// Current state of the connection
    pub state: ConnectionState,
}

/// Port of a bond that is a VLAN, with its current state
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SystemBondVlanPort {
    #[serde(flatten)]
    pub base: PortBase,
    /// VLAN settings
    pub vlan: VlanSettings,
    /// Current state of the connection
    pub state: ConnectionState,
}

/// Port of a bond that is a wireless connection, with its current state
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SystemBondWirelessPort {
    #[serde(flatten)]
    pub base: PortBase,
    /// Wireless settings
    pub wireless: WirelessSettings,
    /// Current state of the connection
    pub state: ConnectionState,
}
