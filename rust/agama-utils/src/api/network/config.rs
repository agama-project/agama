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

//! Representation of the network settings

use super::shared_types::{
    add_dns_searchlist_alias, BondBase, BridgeBase, BridgePortSettings, ConnectionBase, IpSettings,
    PortBase, StateSettings, VlanSettings, WirelessSettings,
};
use super::types::DeviceType;
use merge::Merge;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::default::Default;

/// Network settings
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize, Merge, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(rename = "network.Config", deny_unknown_fields)]
pub struct Config {
    /// Connections to use in the installation
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub connections: Option<NetworkConnectionsCollection>,
    /// Network general settings
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::recurse)]
    pub state: Option<StateSettings>,
}

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

/// Network settings for installation
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSettings {
    pub connections: NetworkConnectionsCollection,
}

/// Bonding configuration
///
/// The ports are given in `portConnections` or, in the deprecated form, in `ports`. When both are
/// given, `ports` is ignored.
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
#[schemars(deny_unknown_fields)]
pub struct BondSettings {
    #[serde(flatten)]
    pub base: BondBase,
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
        self.base.ports = Some(port_names(&ports));
        self.port_connections = Some(ports);
    }
}

/// Bridge configuration
///
/// The ports are given in `portConnections` or, in the deprecated form, in `ports`. When both are
/// given, `ports` is ignored.
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "camelCase")]
#[schemars(deny_unknown_fields)]
pub struct BridgeSettings {
    #[serde(flatten)]
    pub base: BridgeBase,
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
        self.base.ports = Some(port_names(&ports));
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
            BondPort::Bond(port) => Self::Connection(port.as_ref()),
            BondPort::Bridge(port) => Self::Connection(port.as_ref()),
            BondPort::Vlan(port) => Self::Connection(port.as_ref()),
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
            BridgePort::Bridge(port) => Self::Connection(port.as_ref()),
            BridgePort::Vlan(port) => Self::Connection(port.as_ref()),
            BridgePort::Wireless(port) => Self::Connection(port.as_ref()),
        }
    }
}

/// A port nested in its controller, whatever its kind (see [BondPort] and [BridgePort]).
///
/// It is a connection without IP settings, as its controller holds the IP configuration, but with
/// the settings it has as a port. Each kind of port gives the settings that every port has
/// ([`PortBase`]) and its own sections; the rest is written once here.
pub trait NestedPort: std::fmt::Debug {
    /// Settings that every port has.
    fn base(&self) -> &PortBase;

    /// Sections that only this kind of port has.
    fn sections(&self) -> PortSections<'_>;

    /// Unique identifier of the connection, if the port gives it.
    ///
    /// When it is omitted, the port refers to the connection bound to its interface, or gets the
    /// interface name as its ID.
    fn id(&self) -> Option<&str> {
        self.base().id.as_deref()
    }

    /// Network interface associated with the connection, if the port gives it.
    fn interface(&self) -> Option<&str> {
        self.base().interface.as_deref()
    }

    /// Settings that the connection has because it is a port of its controller, if it gives them.
    fn port_settings(&self) -> Option<PortSettings<'_>> {
        self.sections().port
    }

    /// Returns the connection the port stands for, with the given ID.
    ///
    /// It has no IP settings, as its controller holds them, and no port settings, which only make
    /// sense next to its controller. The ID is given because a port can omit it, and which one it
    /// gets depends on the connections that already exist.
    ///
    /// * `id`: ID of the connection.
    fn to_connection(&self, id: String) -> NetworkConnection {
        let sections = self.sections();
        NetworkConnection {
            base: self.base().to_connection_base(
                id,
                sections.vlan.cloned(),
                sections.wireless.cloned(),
            ),
            // A port has no IP settings: its controller holds them.
            ip: IpSettings::default(),
            bond: sections.bond.cloned(),
            bridge: sections.bridge.cloned(),
        }
    }
}

impl<T: NestedPort + ?Sized> PortLists for T {
    fn controller_settings(&self) -> Option<ControllerSettings<'_>> {
        let sections = self.sections();
        ControllerSettings::new(sections.bond, sections.bridge)
    }
}

/// Sections that only some kinds of ports have (see [`NestedPort::sections`]).
#[derive(Clone, Copy, Debug, Default)]
pub struct PortSections<'a> {
    pub port: Option<PortSettings<'a>>,
    pub bond: Option<&'a BondSettings>,
    pub bridge: Option<&'a BridgeSettings>,
    pub vlan: Option<&'a VlanSettings>,
    pub wireless: Option<&'a WirelessSettings>,
}

/// Settings that a nested port has as a port of its kind of controller.
///
/// Each kind of port only takes the settings of its kind of controller (see [`NestedPort::sections`]).
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum PortSettings<'a> {
    Bridge(&'a BridgePortSettings),
}

/// Represents the configuration details for a network connection
///
/// The ports of a bond or a bridge are nested in its controller (see [BondPort] and
/// [BridgePort]).
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[schemars(deny_unknown_fields, transform = add_dns_searchlist_alias)]
pub struct NetworkConnection {
    #[serde(flatten)]
    pub base: ConnectionBase,
    #[serde(flatten)]
    pub ip: IpSettings,
    /// Bonding settings if part of a bond
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bond: Option<BondSettings>,
    /// Bridge settings if part of a bridge
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bridge: Option<BridgeSettings>,
}

impl NetworkConnection {
    /// Device type expected for the network connection.
    ///
    /// Which device type to use is inferred from the included settings. For instance, if it has
    /// wireless settings, it should be applied to a wireless device.
    pub fn device_type(&self) -> DeviceType {
        if self.base.wireless.is_some() {
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

impl From<ConnectionBase> for NetworkConnection {
    /// Returns a connection that is not a controller.
    fn from(base: ConnectionBase) -> Self {
        Self {
            base,
            ip: IpSettings::default(),
            bond: None,
            bridge: None,
        }
    }
}

// The ports of a bridge and of a bond, as the configuration gives them. Each kind is a connection
// without IP settings ([`PortBase`]) with the section that tells its kind (none for an Ethernet
// port) and, for the ports of a bridge, its settings as a port. Unknown fields are rejected, so
// that a setting that does not apply to the port is not silently ignored.

/// Port of a bridge that is an Ethernet connection, or any other kind of connection that has
/// no section of its own (e.g., InfiniBand)
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct BridgeEthernetPort {
    #[serde(flatten)]
    pub base: PortBase,
    /// Settings that this connection has because it is a port of a bridge
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<BridgePortSettings>,
}

/// Port of a bridge that is a bond itself
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct BridgeBondPort {
    #[serde(flatten)]
    pub base: PortBase,
    /// Bonding settings
    pub bond: BondSettings,
    /// Settings that this connection has because it is a port of a bridge
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<BridgePortSettings>,
}

/// Port of a bridge that is a bridge itself
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct BridgeBridgePort {
    #[serde(flatten)]
    pub base: PortBase,
    /// Bridge settings
    pub bridge: BridgeSettings,
    /// Settings that this connection has because it is a port of a bridge
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<BridgePortSettings>,
}

/// Port of a bridge that is a VLAN
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct BridgeVlanPort {
    #[serde(flatten)]
    pub base: PortBase,
    /// VLAN settings
    pub vlan: VlanSettings,
    /// Settings that this connection has because it is a port of a bridge
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<BridgePortSettings>,
}

/// Port of a bridge that is a wireless connection
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct BridgeWirelessPort {
    #[serde(flatten)]
    pub base: PortBase,
    /// Wireless settings
    pub wireless: WirelessSettings,
    /// Settings that this connection has because it is a port of a bridge
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<BridgePortSettings>,
}

/// Port of a bond that is an Ethernet connection, or any other kind of connection that has
/// no section of its own (e.g., InfiniBand)
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct BondEthernetPort {
    #[serde(flatten)]
    pub base: PortBase,
}

/// Port of a bond that is a bond itself
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct BondBondPort {
    #[serde(flatten)]
    pub base: PortBase,
    /// Bonding settings
    pub bond: BondSettings,
}

/// Port of a bond that is a bridge
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct BondBridgePort {
    #[serde(flatten)]
    pub base: PortBase,
    /// Bridge settings
    pub bridge: BridgeSettings,
}

/// Port of a bond that is a VLAN
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct BondVlanPort {
    #[serde(flatten)]
    pub base: PortBase,
    /// VLAN settings
    pub vlan: VlanSettings,
}

/// Port of a bond that is a wireless connection
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct BondWirelessPort {
    #[serde(flatten)]
    pub base: PortBase,
    /// Wireless settings
    pub wireless: WirelessSettings,
}

impl NestedPort for BridgeEthernetPort {
    fn base(&self) -> &PortBase {
        &self.base
    }

    fn sections(&self) -> PortSections<'_> {
        PortSections {
            port: self.port.as_ref().map(PortSettings::Bridge),
            ..Default::default()
        }
    }
}

impl NestedPort for BridgeBondPort {
    fn base(&self) -> &PortBase {
        &self.base
    }

    fn sections(&self) -> PortSections<'_> {
        PortSections {
            bond: Some(&self.bond),
            port: self.port.as_ref().map(PortSettings::Bridge),
            ..Default::default()
        }
    }
}

impl NestedPort for BridgeBridgePort {
    fn base(&self) -> &PortBase {
        &self.base
    }

    fn sections(&self) -> PortSections<'_> {
        PortSections {
            bridge: Some(&self.bridge),
            port: self.port.as_ref().map(PortSettings::Bridge),
            ..Default::default()
        }
    }
}

impl NestedPort for BridgeVlanPort {
    fn base(&self) -> &PortBase {
        &self.base
    }

    fn sections(&self) -> PortSections<'_> {
        PortSections {
            vlan: Some(&self.vlan),
            port: self.port.as_ref().map(PortSettings::Bridge),
            ..Default::default()
        }
    }
}

impl NestedPort for BridgeWirelessPort {
    fn base(&self) -> &PortBase {
        &self.base
    }

    fn sections(&self) -> PortSections<'_> {
        PortSections {
            wireless: Some(&self.wireless),
            port: self.port.as_ref().map(PortSettings::Bridge),
            ..Default::default()
        }
    }
}

impl NestedPort for BondEthernetPort {
    fn base(&self) -> &PortBase {
        &self.base
    }

    fn sections(&self) -> PortSections<'_> {
        PortSections::default()
    }
}

impl NestedPort for BondBondPort {
    fn base(&self) -> &PortBase {
        &self.base
    }

    fn sections(&self) -> PortSections<'_> {
        PortSections {
            bond: Some(&self.bond),
            ..Default::default()
        }
    }
}

impl NestedPort for BondBridgePort {
    fn base(&self) -> &PortBase {
        &self.base
    }

    fn sections(&self) -> PortSections<'_> {
        PortSections {
            bridge: Some(&self.bridge),
            ..Default::default()
        }
    }
}

impl NestedPort for BondVlanPort {
    fn base(&self) -> &PortBase {
        &self.base
    }

    fn sections(&self) -> PortSections<'_> {
        PortSections {
            vlan: Some(&self.vlan),
            ..Default::default()
        }
    }
}

impl NestedPort for BondWirelessPort {
    fn base(&self) -> &PortBase {
        &self.base
    }

    fn sections(&self) -> PortSections<'_> {
        PortSections {
            wireless: Some(&self.wireless),
            ..Default::default()
        }
    }
}

/// Entry of the `portConnections` list of a bridge.
///
/// Any kind of connection can be a port, as NetworkManager does not restrict it. A port given as a
/// connection is told apart by the section it has: `bond`, `bridge`, `vlan`, `wireless` or none of
/// them, for an Ethernet port.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(untagged)]
pub enum BridgePort {
    /// Interface name or ID of a connection.
    ///
    /// It is a shorthand for `{ "interface": "<name>" }`: it refers to the connection with that
    /// interface name or ID, and a new Ethernet connection is created when there is none.
    Name(String),
    Ethernet(Box<BridgeEthernetPort>),
    Bond(Box<BridgeBondPort>),
    Bridge(Box<BridgeBridgePort>),
    Vlan(Box<BridgeVlanPort>),
    Wireless(Box<BridgeWirelessPort>),
}

impl BridgePort {
    /// Reports a connection as a port of a bridge.
    ///
    /// Its IP settings are dropped, as its controller holds them.
    ///
    /// * `conn`: connection to report.
    /// * `port`: settings it has as a port of the bridge.
    pub fn from_connection(conn: NetworkConnection, port: Option<BridgePortSettings>) -> Self {
        // The IP settings are dropped, as its controller holds them.
        let NetworkConnection {
            mut base,
            ip: _,
            bond,
            bridge,
        } = conn;
        let vlan = base.vlan.take();
        let wireless = base.wireless.take();
        let base = PortBase::from_connection(base);

        if let Some(bond) = bond {
            Self::Bond(Box::new(BridgeBondPort { base, bond, port }))
        } else if let Some(bridge) = bridge {
            Self::Bridge(Box::new(BridgeBridgePort { base, bridge, port }))
        } else if let Some(vlan) = vlan {
            Self::Vlan(Box::new(BridgeVlanPort { base, vlan, port }))
        } else if let Some(wireless) = wireless {
            Self::Wireless(Box::new(BridgeWirelessPort {
                base,
                wireless,
                port,
            }))
        } else {
            Self::Ethernet(Box::new(BridgeEthernetPort { base, port }))
        }
    }
}

/// Entry of the `portConnections` list of a bond.
///
/// Any kind of connection can be a port, as NetworkManager does not restrict it. A port given as a
/// connection is told apart by the section it has: `bond`, `bridge`, `vlan`, `wireless` or none of
/// them, for an Ethernet port. Unlike the ports of a bridge, it has no port settings.
#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(untagged)]
pub enum BondPort {
    /// Interface name or ID of a connection.
    ///
    /// It is a shorthand for `{ "interface": "<name>" }`: it refers to the connection with that
    /// interface name or ID, and a new Ethernet connection is created when there is none.
    Name(String),
    Ethernet(Box<BondEthernetPort>),
    Bond(Box<BondBondPort>),
    Bridge(Box<BondBridgePort>),
    Vlan(Box<BondVlanPort>),
    Wireless(Box<BondWirelessPort>),
}

impl BondPort {
    /// Reports a connection as a port of a bond.
    ///
    /// Its IP settings are dropped, as its controller holds them.
    ///
    /// * `conn`: connection to report.
    pub fn from_connection(conn: NetworkConnection) -> Self {
        // The IP settings are dropped, as its controller holds them.
        let NetworkConnection {
            mut base,
            ip: _,
            bond,
            bridge,
        } = conn;
        let vlan = base.vlan.take();
        let wireless = base.wireless.take();
        let base = PortBase::from_connection(base);

        if let Some(bond) = bond {
            Self::Bond(Box::new(BondBondPort { base, bond }))
        } else if let Some(bridge) = bridge {
            Self::Bridge(Box::new(BondBridgePort { base, bridge }))
        } else if let Some(vlan) = vlan {
            Self::Vlan(Box::new(BondVlanPort { base, vlan }))
        } else if let Some(wireless) = wireless {
            Self::Wireless(Box::new(BondWirelessPort { base, wireless }))
        } else {
            Self::Ethernet(Box::new(BondEthernetPort { base }))
        }
    }
}

/// Settings of a connection that is a controller, which has ports.
#[derive(Clone, Copy, Debug)]
pub enum ControllerSettings<'a> {
    Bond(&'a BondSettings),
    Bridge(&'a BridgeSettings),
}

impl<'a> ControllerSettings<'a> {
    /// Returns the settings of the controller from its sections, if it has any of them.
    ///
    /// A connection is a single kind of controller, so it does not have more than one of them.
    fn new(bond: Option<&'a BondSettings>, bridge: Option<&'a BridgeSettings>) -> Option<Self> {
        bond.map(Self::Bond).or(bridge.map(Self::Bridge))
    }

    /// Returns its `ports` and `portConnections` lists.
    fn port_lists(self) -> (Option<&'a [String]>, Option<Vec<PortRef<'a>>>) {
        fn refs<'a, P>(ports: &'a Option<Vec<P>>) -> Option<Vec<PortRef<'a>>>
        where
            PortRef<'a>: From<&'a P>,
        {
            ports
                .as_ref()
                .map(|ports| ports.iter().map(PortRef::from).collect())
        }

        match self {
            Self::Bond(bond) => (bond.base.ports.as_deref(), refs(&bond.port_connections)),
            Self::Bridge(bridge) => (bridge.base.ports.as_deref(), refs(&bridge.port_connections)),
        }
    }
}

/// The lists of ports of a connection that can be a controller, whether it is at the top level
/// ([`NetworkConnection`]) or a port itself ([`NestedPort`]).
pub trait PortLists {
    /// Returns its settings as a controller, if it is one.
    fn controller_settings(&self) -> Option<ControllerSettings<'_>>;

    /// Returns the ports declared by the connection, if it declares any.
    ///
    /// They come from `portConnections` or, when it is not given, from `ports`, which is ignored
    /// when both are given. An empty list is not the same as no list at all: an empty list means
    /// that the controller has no ports, while no list means that its ports are not part of the
    /// payload.
    fn ports(&self) -> Option<Vec<PortRef<'_>>> {
        let (names, entries) = self.controller_settings()?.port_lists();
        if entries.is_some() {
            return entries;
        }
        names.map(|names| names.iter().map(|n| PortRef::Name(n)).collect())
    }

    /// Whether the connection gives both `ports` and `portConnections` and they do not name the
    /// same ports, regardless of the order. `ports` is ignored in that case.
    fn has_ignored_port_names(&self) -> bool {
        let Some((Some(names), Some(entries))) = self
            .controller_settings()
            .map(ControllerSettings::port_lists)
        else {
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
    fn controller_settings(&self) -> Option<ControllerSettings<'_>> {
        ControllerSettings::new(self.bond.as_ref(), self.bridge.as_ref())
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
    use crate::api::network::types::{ConnectivityState, Ipv4Method, Ipv6Method};

    #[test]
    fn test_merge_network_config() {
        // The `updated` config that will be merged into
        let mut updated = Config {
            connections: Some(NetworkConnectionsCollection(vec![NetworkConnection {
                base: ConnectionBase {
                    id: "eth0".to_string(),
                    mtu: 1500,
                    ..Default::default()
                },
                ip: IpSettings {
                    method4: Some(Ipv4Method::Auto),
                    addresses: vec![],
                    nameservers: vec![],
                    dns_searchlist: vec![],
                    ..Default::default()
                },
                ..Default::default()
            }])),
            state: Some(StateSettings {
                connectivity: Some(ConnectivityState::Full),
                wireless_enabled: Some(true),
                networking_enabled: Some(true),
                copy_network: None,
            }),
        };

        // The `original` config to merge from
        let original = Config {
            connections: Some(NetworkConnectionsCollection(vec![
                NetworkConnection {
                    base: ConnectionBase {
                        id: "eth1".to_string(),
                        mtu: 0, // default
                        ..Default::default()
                    },
                    ip: IpSettings {
                        method4: Some(Ipv4Method::Manual),
                        addresses: vec!["192.168.1.10/24".parse().unwrap()],
                        nameservers: vec!["8.8.8.8".parse().unwrap()],
                        dns_searchlist: vec!["example.com".to_string()],
                        ..Default::default()
                    },
                    ..Default::default()
                },
                NetworkConnection {
                    base: ConnectionBase {
                        id: "wifi0".to_string(),
                        wireless: Some(WirelessSettings {
                            ssid: "MyWiFi".to_string(),
                            security: "wpa2".to_string(),
                            ..Default::default()
                        }),
                        ..Default::default()
                    },
                    ip: IpSettings {
                        method4: Some(Ipv4Method::Auto),
                        ..Default::default()
                    },
                    ..Default::default()
                },
            ])),
            state: Some(StateSettings {
                connectivity: Some(ConnectivityState::None), // This should NOT overwrite updated's true
                wireless_enabled: None, // This should NOT overwrite updated's true
                networking_enabled: Some(false), // This should NOT overwrite updated's true
                copy_network: Some(true), // This SHOULD overwrite updated's None
            }),
        };

        // Perform the merge
        updated.merge(original.clone());

        // Assertions for connections
        // NetworkConnectionsCollection has overwrite_empty strategy.
        // This means the vector is only replaced if the destination vector is empty.
        // Since updated.connections was not empty, it is NOT overwritten.
        assert_eq!(updated.connections.as_ref().unwrap().0.len(), 1);
        assert_eq!(updated.connections.as_ref().unwrap().0[0].base.id, "eth0");

        // Assertions for state (StateSettings has overwrite_none strategy)
        let merged_state = updated.state.unwrap();
        assert_eq!(merged_state.connectivity, Some(ConnectivityState::Full)); // from updated, not overwritten by original.Some(false)
        assert_eq!(merged_state.wireless_enabled, Some(true)); // from updated, not overwritten by original.None
        assert_eq!(merged_state.networking_enabled, Some(true)); // from updated, not overwritten by original.Some(false)
        assert_eq!(merged_state.copy_network, Some(true)); // from original, overwritten updated.None

        // Test with a list of connections
        let mut updated1 = Config {
            connections: Some(NetworkConnectionsCollection(vec![NetworkConnection::from(
                ConnectionBase {
                    id: "eth1".to_string(),
                    ..Default::default()
                },
            )])),
            state: None,
        };
        let original1 = Config {
            connections: Some(NetworkConnectionsCollection(vec![NetworkConnection::from(
                ConnectionBase {
                    id: "eth0".to_string(),
                    ..Default::default()
                },
            )])), // empty vec
            state: None,
        };
        let original2 = original1.clone();

        updated1.merge(original1);
        assert_eq!(updated1.connections.as_ref().unwrap().0.len(), 1); // use the updated1 list
        let connections = updated1.connections.unwrap();
        let connection = connections.0.first().unwrap();
        assert_eq!(&connection.base.id, "eth1");

        // Test without a list of connections
        let mut updated2 = Config {
            connections: None,
            state: None,
        };
        updated2.merge(original2);
        assert_eq!(updated2.connections.unwrap().0.len(), 1); // should be empty, as updated was None
    }

    #[test]
    fn test_merge_network_config_with_nones() {
        // Case 1: `updated` has Some, `original` has None -> `updated` should be preserved
        let mut updated = Config {
            connections: Some(NetworkConnectionsCollection(vec![NetworkConnection::from(
                ConnectionBase {
                    id: "conn1".to_string(),
                    ..Default::default()
                },
            )])),
            state: Some(StateSettings {
                connectivity: Some(ConnectivityState::Full),
                ..Default::default()
            }),
        };
        let updated_clone = updated.clone();
        let original = Config {
            connections: None,
            state: None,
        };

        updated.merge(original);
        assert_eq!(updated.connections, updated_clone.connections);
        assert_eq!(updated.state, updated_clone.state);

        // Case 2: `updated` has None, `original` has Some -> `updated` should be replaced by `original`
        let mut updated1 = Config {
            connections: None,
            state: None,
        };
        let original1 = Config {
            connections: Some(NetworkConnectionsCollection(vec![NetworkConnection::from(
                ConnectionBase {
                    id: "conn2".to_string(),
                    ..Default::default()
                },
            )])),
            state: Some(StateSettings {
                wireless_enabled: Some(false),
                ..Default::default()
            }),
        };
        let original1_clone = original1.clone();

        updated1.merge(original1);
        assert_eq!(updated1.connections, original1_clone.connections);
        assert_eq!(updated1.state, original1_clone.state);

        // Case 3: Both None -> remains None
        let mut updated2 = Config {
            connections: None,
            state: None,
        };
        let original2 = Config {
            connections: None,
            state: None,
        };
        updated2.merge(original2);
        assert_eq!(updated2.connections, None);
        assert_eq!(updated2.state, None);
    }

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
        assert_eq!(conn.ip.dns_searchlist, vec!["example.com"]);

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
        assert_eq!(conn.ip.dns_searchlist, vec!["example.org"]);
    }

    #[test]
    fn test_network_connection_link_local_method() {
        // "linkLocal" was the name the API used, so it is still accepted.
        for name in ["link-local", "linkLocal"] {
            let json = format!(r#"{{ "id": "eth0", "method4": "{name}", "method6": "{name}" }}"#);
            let conn: NetworkConnection = serde_json::from_str(&json).unwrap();
            assert_eq!(conn.ip.method4, Some(Ipv4Method::LinkLocal));
            assert_eq!(conn.ip.method6, Some(Ipv6Method::LinkLocal));

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
        assert!(conn.base.match_settings.is_some());
        let match_settings = conn.base.match_settings.as_ref().unwrap();
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
        assert_eq!(conn.base.match_settings, conn2.base.match_settings);
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
        let Some(PortSettings::Bridge(settings)) = bond0.port_settings() else {
            panic!("bond0 has no bridge port settings");
        };
        assert_eq!(settings.priority, Some(32));
        assert_eq!(names(bond0.ports()).unwrap(), ["eth1", "eth2"]);

        let collection = NetworkConnectionsCollection(vec![conn.clone()]);
        let all = collection.flatten();
        let interfaces: Vec<_> = all
            .iter()
            .map(|c| c.base.interface.as_deref().unwrap_or(&c.base.id))
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
            base: PortBase {
                id: Some("Wired connection 1".to_string()),
                interface: Some("eth0".to_string()),
                ..Default::default()
            },
        };
        let eth1 = BondEthernetPort {
            base: PortBase {
                id: Some("eth1".to_string()),
                ..Default::default()
            },
        };
        let mut bond = BondSettings::default();
        bond.set_ports(vec![
            BondPort::Ethernet(Box::new(eth0)),
            BondPort::Ethernet(Box::new(eth1)),
        ]);
        let bond0 = NetworkConnection {
            base: ConnectionBase {
                id: "bond0".to_string(),
                ..Default::default()
            },
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
            assert!(
                serde_json::from_str::<NetworkConnection>(&json).is_err(),
                "{setting}"
            );
        }
    }

    #[test]
    fn test_a_port_stands_for_a_connection_without_ip_settings() {
        let port = BridgeEthernetPort {
            base: PortBase {
                interface: Some("eth0".to_string()),
                mtu: 9000,
                ..Default::default()
            },
            port: Some(BridgePortSettings {
                priority: Some(16),
                ..Default::default()
            }),
        };
        let conn = port.to_connection("eth0".to_string());
        assert_eq!(conn.base.id, "eth0");
        assert_eq!(conn.base.mtu, 9000);
        assert!(conn.ip.is_empty());

        let mut conn = conn;
        conn.ip.method4 = Some(Ipv4Method::Auto);
        let BridgePort::Ethernet(port) = BridgePort::from_connection(conn, None) else {
            panic!("eth0 is not reported as an Ethernet port");
        };
        assert_eq!(port.base.id.as_deref(), Some("eth0"));
        assert_eq!(port.base.mtu, 9000);
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

        // NetworkManager does not restrict the kind of the ports, so any connection can be one.
        let port = BridgePort::from_connection;
        assert!(matches!(port(bond0.clone(), None), BridgePort::Bond(_)));
        assert!(matches!(port(br1.clone(), None), BridgePort::Bridge(_)));
        assert!(matches!(port(vlan.clone(), None), BridgePort::Vlan(_)));
        assert!(matches!(port(wlan0.clone(), None), BridgePort::Wireless(_)));

        let port = BondPort::from_connection;
        assert!(matches!(port(bond0), BondPort::Bond(_)));
        assert!(matches!(port(br1), BondPort::Bridge(_)));
        assert!(matches!(port(vlan), BondPort::Vlan(_)));
        assert!(matches!(port(wlan0), BondPort::Wireless(_)));
    }

    #[test]
    fn test_nested_ports_only_take_the_settings_of_their_controller() {
        for json in [
            // Only the ports of a bridge have port settings.
            r#"{ "id": "bond0", "bond": { "mode": "802.3ad", "portConnections": [{ "interface": "eth0", "port": { "priority": 32 } }] } }"#,
            r#"{ "id": "bond0", "bond": { "mode": "802.3ad", "portConnections": [{ "interface": "eth0.100", "vlan": { "parent": "eth0", "id": 100 }, "port": { "priority": 32 } }] } }"#,
            // A port is a single kind of connection.
            r#"{ "id": "br0", "bridge": { "portConnections": [{ "interface": "bond0", "bond": { "mode": "802.3ad" }, "vlan": { "parent": "eth0", "id": 100 } }] } }"#,
        ] {
            assert!(
                serde_json::from_str::<NetworkConnection>(json).is_err(),
                "{json}"
            );
        }
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
        assert_eq!(eth0.base.mtu, 9000);
        assert_eq!(wlan0.wireless.ssid, "agama");

        let flattened = NetworkConnectionsCollection(vec![conn.clone()]).flatten();
        let ids: Vec<_> = flattened.iter().map(|c| c.base.id.as_str()).collect();
        assert_eq!(ids, ["br0", "bond0", "eth0", "wlan0", "eth1.100"]);
        assert_eq!(flattened[2].base.mtu, 9000);
        assert!(flattened[3].base.wireless.is_some());
        assert!(flattened[4].base.vlan.is_some());

        // Reported as it was given, so it can be sent back.
        let serialized = serde_json::to_value(&conn).unwrap();
        let read: NetworkConnection = serde_json::from_value(serialized).unwrap();
        assert_eq!(read, conn);
    }

    #[test]
    fn test_a_nested_port_does_not_take_the_state() {
        for port in [
            r#"{ "interface": "eth0", "state": "activated" }"#,
            r#"{ "interface": "bond1", "bond": { "mode": "802.3ad" }, "state": "activated" }"#,
        ] {
            let json = format!(
                r#"{{ "id": "bond0", "bond": {{ "mode": "802.3ad", "portConnections": [{port}] }} }}"#
            );
            assert!(
                serde_json::from_str::<NetworkConnection>(&json).is_err(),
                "{port}"
            );
        }
    }
}
