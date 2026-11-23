// Copyright (c) [2025] SUSE LLC
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

//! Representation of the network system information.
//!
//! The connections are the same tree as the configuration (see [`config::NetworkConnection`]),
//! built from the same parts ([`ConnectionCommon`], [`IpSettings`], [`BondCommon`],
//! [`BridgeCommon`] and [`PortCommon`]), plus the current state of every connection, nested ports
//! included. The state of a port is not the one of its controller (e.g., the backup port of an
//! active bond is not active).
//!
//! The tree is built from the configuration one, looking up the state of each connection by its ID
//! (see [`NetworkConnection::new`]).

use super::config;
use super::shared_types::{
    add_dns_searchlist_alias, BondCommon, BridgeCommon, BridgePortSettings, ConnectionCommon,
    IpSettings, PortCommon, VlanSettings, WirelessSettings,
};
use super::types::ConnectionState;
use super::{AccessPoint, Device, StateSettings};

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::default::Default;

/// Network settings for installation
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(rename = "network.SystemInfo")]
pub struct SystemInfo {
    pub access_points: Vec<AccessPoint>, // networks or access_points shold be returned
    /// Connections to use in the installation, with their current state
    pub connections: NetworkConnectionsCollection,
    pub devices: Vec<Device>,
    pub state: StateSettings,
}

/// Collection of connections with their current state, as the system reports them.
///
/// Like [`config::NetworkConnectionsCollection`], it only holds the root connections.
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[schemars(rename = "SystemNetworkConnections")]
pub struct NetworkConnectionsCollection(pub Vec<NetworkConnection>);

/// Returns the state of the connection with the given ID.
pub type StateOf<'a> = &'a dyn Fn(&str) -> ConnectionState;

impl PortCommon {
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
#[schemars(rename = "SystemNetworkConnection")]
#[schemars(deny_unknown_fields, transform = add_dns_searchlist_alias)]
pub struct NetworkConnection {
    #[serde(flatten)]
    pub common: ConnectionCommon,
    #[serde(flatten)]
    pub ip: IpSettings,
    /// Bonding settings if part of a bond
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bond: Option<BondSettings>,
    /// Bridge settings if part of a bridge
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bridge: Option<BridgeSettings>,
    /// Current state of the connection
    pub state: ConnectionState,
}

impl NetworkConnection {
    /// Reports a connection and, recursively, its nested ports with their state.
    ///
    /// * `conn`: connection to report.
    /// * `state_of`: returns the state of the connection with the given ID.
    pub fn new(conn: config::NetworkConnection, state_of: StateOf) -> Self {
        Self {
            state: state_of(&conn.common.id),
            common: conn.common,
            ip: conn.ip,
            bond: conn.bond.map(|b| BondSettings::new(b, state_of)),
            bridge: conn.bridge.map(|b| BridgeSettings::new(b, state_of)),
        }
    }
}

/// Bonding configuration with the state of the ports, as the system reports it.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
#[schemars(rename = "SystemBondSettings", deny_unknown_fields)]
pub struct BondSettings {
    #[serde(flatten)]
    pub common: BondCommon,
    /// Ports of the controller, with their current state
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub port_connections: Option<Vec<BondPort>>,
}

impl BondSettings {
    fn new(settings: config::BondSettings, state_of: StateOf) -> Self {
        Self {
            common: settings.common,
            port_connections: settings.port_connections.map(|ports| {
                ports
                    .into_iter()
                    .map(|port| BondPort::new(port, state_of))
                    .collect()
            }),
        }
    }
}

/// Bridge configuration with the state of the ports, as the system reports it.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
#[schemars(rename = "SystemBridgeSettings", deny_unknown_fields)]
pub struct BridgeSettings {
    #[serde(flatten)]
    pub common: BridgeCommon,
    /// Ports of the controller, with their current state
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub port_connections: Option<Vec<BridgePort>>,
}

impl BridgeSettings {
    fn new(settings: config::BridgeSettings, state_of: StateOf) -> Self {
        Self {
            common: settings.common,
            port_connections: settings.port_connections.map(|ports| {
                ports
                    .into_iter()
                    .map(|port| BridgePort::new(port, state_of))
                    .collect()
            }),
        }
    }
}

/// Entry of the `portConnections` list of a bridge, with the state of the port.
///
/// Like [`config::BridgePort`], with the state of every port given as a connection.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(untagged)]
#[schemars(rename = "SystemBridgePort")]
pub enum BridgePort {
    /// Interface name or ID of a connection, which reports no state.
    Name(String),
    Ethernet(Box<BridgeEthernetPort>),
    Bond(Box<BridgeBondPort>),
    Bridge(Box<BridgeBridgePort>),
    Vlan(Box<BridgeVlanPort>),
    Wireless(Box<BridgeWirelessPort>),
}

impl BridgePort {
    fn new(port: config::BridgePort, state_of: StateOf) -> Self {
        match port {
            config::BridgePort::Name(name) => Self::Name(name),
            config::BridgePort::Ethernet(port) => {
                let config::BridgeEthernetPort { common, port } = *port;
                Self::Ethernet(Box::new(BridgeEthernetPort {
                    state: common.state(state_of),
                    common,
                    port,
                }))
            }
            config::BridgePort::Bond(port) => {
                let config::BridgeBondPort { common, bond, port } = *port;
                Self::Bond(Box::new(BridgeBondPort {
                    state: common.state(state_of),
                    common,
                    bond: BondSettings::new(bond, state_of),
                    port,
                }))
            }
            config::BridgePort::Bridge(port) => {
                let config::BridgeBridgePort {
                    common,
                    bridge,
                    port,
                } = *port;
                Self::Bridge(Box::new(BridgeBridgePort {
                    state: common.state(state_of),
                    common,
                    bridge: BridgeSettings::new(bridge, state_of),
                    port,
                }))
            }
            config::BridgePort::Vlan(port) => {
                let config::BridgeVlanPort { common, vlan, port } = *port;
                Self::Vlan(Box::new(BridgeVlanPort {
                    state: common.state(state_of),
                    common,
                    vlan,
                    port,
                }))
            }
            config::BridgePort::Wireless(port) => {
                let config::BridgeWirelessPort {
                    common,
                    wireless,
                    port,
                } = *port;
                Self::Wireless(Box::new(BridgeWirelessPort {
                    state: common.state(state_of),
                    common,
                    wireless,
                    port,
                }))
            }
        }
    }
}

/// Entry of the `portConnections` list of a bond, with the state of the port.
///
/// Like [`config::BondPort`], with the state of every port given as a connection.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(untagged)]
#[schemars(rename = "SystemBondPort")]
pub enum BondPort {
    /// Interface name or ID of a connection, which reports no state.
    Name(String),
    Ethernet(Box<BondEthernetPort>),
    Bond(Box<BondBondPort>),
    Bridge(Box<BondBridgePort>),
    Vlan(Box<BondVlanPort>),
    Wireless(Box<BondWirelessPort>),
}

impl BondPort {
    fn new(port: config::BondPort, state_of: StateOf) -> Self {
        match port {
            config::BondPort::Name(name) => Self::Name(name),
            config::BondPort::Ethernet(port) => {
                let config::BondEthernetPort { common } = *port;
                Self::Ethernet(Box::new(BondEthernetPort {
                    state: common.state(state_of),
                    common,
                }))
            }
            config::BondPort::Bond(port) => {
                let config::BondBondPort { common, bond } = *port;
                Self::Bond(Box::new(BondBondPort {
                    state: common.state(state_of),
                    common,
                    bond: BondSettings::new(bond, state_of),
                }))
            }
            config::BondPort::Bridge(port) => {
                let config::BondBridgePort { common, bridge } = *port;
                Self::Bridge(Box::new(BondBridgePort {
                    state: common.state(state_of),
                    common,
                    bridge: BridgeSettings::new(bridge, state_of),
                }))
            }
            config::BondPort::Vlan(port) => {
                let config::BondVlanPort { common, vlan } = *port;
                Self::Vlan(Box::new(BondVlanPort {
                    state: common.state(state_of),
                    common,
                    vlan,
                }))
            }
            config::BondPort::Wireless(port) => {
                let config::BondWirelessPort { common, wireless } = *port;
                Self::Wireless(Box::new(BondWirelessPort {
                    state: common.state(state_of),
                    common,
                    wireless,
                }))
            }
        }
    }
}

// The ports with their state. Each one mirrors the port of the configuration with the same name
// and adds the state. Like those, it flattens [`PortCommon`] directly (not the port of the
// configuration, which flattens it too) and rejects unknown fields, so that each kind of port is
// told apart from the others when it is read back.

/// Port of a bridge that is an Ethernet connection, with its current state
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
#[schemars(rename = "SystemBridgeEthernetPort")]
pub struct BridgeEthernetPort {
    #[serde(flatten)]
    pub common: PortCommon,
    /// Settings that this connection has because it is a port of a bridge
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<BridgePortSettings>,
    /// Current state of the connection
    pub state: ConnectionState,
}

/// Port of a bridge that is a bond itself, with its current state and the one of its ports
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
#[schemars(rename = "SystemBridgeBondPort")]
pub struct BridgeBondPort {
    #[serde(flatten)]
    pub common: PortCommon,
    /// Bonding settings
    pub bond: BondSettings,
    /// Settings that this connection has because it is a port of a bridge
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<BridgePortSettings>,
    /// Current state of the connection
    pub state: ConnectionState,
}

/// Port of a bridge that is a bridge itself, with its current state and the one of its ports
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
#[schemars(rename = "SystemBridgeBridgePort")]
pub struct BridgeBridgePort {
    #[serde(flatten)]
    pub common: PortCommon,
    /// Bridge settings
    pub bridge: BridgeSettings,
    /// Settings that this connection has because it is a port of a bridge
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<BridgePortSettings>,
    /// Current state of the connection
    pub state: ConnectionState,
}

/// Port of a bridge that is a VLAN, with its current state
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
#[schemars(rename = "SystemBridgeVlanPort")]
pub struct BridgeVlanPort {
    #[serde(flatten)]
    pub common: PortCommon,
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
#[schemars(rename = "SystemBridgeWirelessPort")]
pub struct BridgeWirelessPort {
    #[serde(flatten)]
    pub common: PortCommon,
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
#[schemars(rename = "SystemBondEthernetPort")]
pub struct BondEthernetPort {
    #[serde(flatten)]
    pub common: PortCommon,
    /// Current state of the connection
    pub state: ConnectionState,
}

/// Port of a bond that is a bond itself, with its current state and the one of its ports
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
#[schemars(rename = "SystemBondBondPort")]
pub struct BondBondPort {
    #[serde(flatten)]
    pub common: PortCommon,
    /// Bonding settings
    pub bond: BondSettings,
    /// Current state of the connection
    pub state: ConnectionState,
}

/// Port of a bond that is a bridge, with its current state and the one of its ports
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
#[schemars(rename = "SystemBondBridgePort")]
pub struct BondBridgePort {
    #[serde(flatten)]
    pub common: PortCommon,
    /// Bridge settings
    pub bridge: BridgeSettings,
    /// Current state of the connection
    pub state: ConnectionState,
}

/// Port of a bond that is a VLAN, with its current state
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
#[schemars(rename = "SystemBondVlanPort")]
pub struct BondVlanPort {
    #[serde(flatten)]
    pub common: PortCommon,
    /// VLAN settings
    pub vlan: VlanSettings,
    /// Current state of the connection
    pub state: ConnectionState,
}

/// Port of a bond that is a wireless connection, with its current state
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
#[schemars(rename = "SystemBondWirelessPort")]
pub struct BondWirelessPort {
    #[serde(flatten)]
    pub common: PortCommon,
    /// Wireless settings
    pub wireless: WirelessSettings,
    /// Current state of the connection
    pub state: ConnectionState,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_the_state_of_every_kind_of_port_is_read_and_written_back() {
        let json = serde_json::json!({
            "id": "br0",
            "bridge": {
                "stp": false,
                "portConnections": [
                    "eth9",
                    { "id": "eth0", "port": { "priority": 16 }, "state": "activated" },
                    {
                        "id": "bond0",
                        "bond": {
                            "mode": "active-backup",
                            "portConnections": [
                                { "id": "eth1", "state": "activated" },
                                { "id": "eth2", "state": "deactivated" },
                                { "id": "br1", "bridge": { "portConnections": [] }, "state": "activating" },
                                { "id": "eth3.10", "vlan": { "parent": "eth3", "id": 10 }, "state": "activated" }
                            ]
                        },
                        "port": { "priority": 32 },
                        "state": "activated"
                    },
                    {
                        "id": "wlan0",
                        "wireless": { "ssid": "agama", "security": "none", "mode": "infrastructure" },
                        "state": "deactivated"
                    }
                ]
            },
            "state": "activated"
        });
        let conn: NetworkConnection = serde_json::from_value(json.clone()).unwrap();

        let bridge = conn.bridge.as_ref().unwrap();
        assert_eq!(bridge.common.stp, Some(false));
        let ports = bridge.port_connections.as_ref().unwrap();
        let [BridgePort::Name(_), BridgePort::Ethernet(eth0), BridgePort::Bond(bond0), BridgePort::Wireless(wlan0)] =
            ports.as_slice()
        else {
            panic!("unexpected ports: {ports:?}");
        };
        assert_eq!(eth0.state, ConnectionState::Activated);
        assert_eq!(eth0.port.as_ref().unwrap().priority, Some(16));
        assert_eq!(bond0.port.as_ref().unwrap().priority, Some(32));
        assert_eq!(wlan0.state, ConnectionState::Deactivated);
        let ports = bond0.bond.port_connections.as_ref().unwrap();
        let [BondPort::Ethernet(_), BondPort::Ethernet(eth2), BondPort::Bridge(br1), BondPort::Vlan(_)] =
            ports.as_slice()
        else {
            panic!("unexpected ports: {ports:?}");
        };
        assert_eq!(eth2.state, ConnectionState::Deactivated);
        assert_eq!(br1.state, ConnectionState::Activating);

        // Written back as it was read.
        assert_eq!(serde_json::to_value(&conn).unwrap(), json);
    }

    #[test]
    fn test_the_ports_with_state_reject_unknown_fields() {
        for port in [
            r#"{ "id": "eth0", "state": "activated", "unknown": true }"#,
            r#"{ "id": "bond1", "bond": { "mode": "802.3ad" }, "state": "activated", "unknown": true }"#,
            // Only the ports of a bridge have port settings.
            r#"{ "id": "eth0", "port": { "priority": 32 }, "state": "activated" }"#,
            // A port is a single kind of connection.
            r#"{ "id": "bond1", "bond": { "mode": "802.3ad" }, "vlan": { "parent": "eth0", "id": 10 }, "state": "activated" }"#,
            // A port has no IP settings.
            r#"{ "id": "eth0", "method4": "auto", "state": "activated" }"#,
        ] {
            let json = format!(
                r#"{{ "id": "bond0", "bond": {{ "mode": "802.3ad", "portConnections": [{port}] }}, "state": "activated" }}"#
            );
            assert!(
                serde_json::from_str::<NetworkConnection>(&json).is_err(),
                "{port}"
            );
        }
    }

    #[test]
    fn test_the_schema_with_state_documents_the_state_of_every_connection() {
        let schema = schemars::schema_for!(NetworkConnection);
        let json = serde_json::to_value(&schema).unwrap();
        let defs = json["$defs"].as_object().unwrap();

        assert!(json["properties"].get("state").is_some());
        assert_eq!(json["required"], serde_json::json!(["id", "state"]));
        assert_eq!(json["additionalProperties"], false);
        let bond = &json["properties"]["bond"]["anyOf"][0]["$ref"];
        assert_eq!(bond, "#/$defs/SystemBondSettings");
        let bridge = &json["properties"]["bridge"]["anyOf"][0]["$ref"];
        assert_eq!(bridge, "#/$defs/SystemBridgeSettings");
        let ports = &defs["SystemBondSettings"]["properties"]["portConnections"]["items"];
        assert_eq!(ports["$ref"], "#/$defs/SystemBondPort");
        let ports = &defs["SystemBridgeSettings"]["properties"]["portConnections"]["items"];
        assert_eq!(ports["$ref"], "#/$defs/SystemBridgePort");
        // Every port with state, but the port enums themselves.
        let ports: Vec<_> = defs
            .iter()
            .filter(|(name, def)| {
                name.starts_with("System") && name.ends_with("Port") && def.get("anyOf").is_none()
            })
            .collect();
        assert_eq!(ports.len(), 10);
        for (name, def) in ports {
            assert!(def["properties"].get("state").is_some(), "{name}");
            assert_eq!(def["additionalProperties"], false, "{name}");
        }
        // The shared parts are flattened, so they are not definitions of their own.
        for part in [
            "ConnectionCommon",
            "BondCommon",
            "BridgeCommon",
            "PortCommon",
        ] {
            assert!(!defs.contains_key(part), "{part}");
        }
    }
}
