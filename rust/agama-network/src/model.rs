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

//! Representation of the network configuration
//!
//! * This module contains the types that represent the network concepts. They are supposed to be
//!   agnostic from the real network service (e.g., NetworkManager).
use crate::error::NetworkStateError;
use crate::types::*;

use agama_utils::openapi::schemas;
use macaddr::MacAddr6;
use serde::{Deserialize, Serialize};
use serde_with::{serde_as, skip_serializing_none, DisplayFromStr};
use std::{
    collections::HashMap,
    default::Default,
    fmt,
    str::{self, FromStr},
};
use thiserror::Error;
use uuid::Uuid;

#[derive(PartialEq)]
pub struct StateConfig {
    pub access_points: bool,
    pub devices: bool,
    pub connections: bool,
    pub general_state: bool,
}

impl Default for StateConfig {
    fn default() -> Self {
        Self {
            access_points: true,
            devices: true,
            connections: true,
            general_state: true,
        }
    }
}

#[derive(Default, Clone, Debug)]
pub struct NetworkState {
    pub general_state: GeneralState,
    pub access_points: Vec<AccessPoint>,
    pub devices: Vec<Device>,
    pub connections: Vec<Connection>,
}

impl NetworkState {
    /// Returns a NetworkState struct with the given devices and connections.
    ///
    /// * `general_state`: General network configuration
    /// * `access_points`: Access points to include in the state.
    /// * `devices`: devices to include in the state.
    /// * `connections`: connections to include in the state.
    pub fn new(
        general_state: GeneralState,
        access_points: Vec<AccessPoint>,
        devices: Vec<Device>,
        connections: Vec<Connection>,
    ) -> Self {
        Self {
            general_state,
            access_points,
            devices,
            connections,
        }
    }

    /// Get device by name
    ///
    /// * `name`: device name
    pub fn get_device(&self, name: &str) -> Option<&Device> {
        self.devices.iter().find(|d| d.name == name)
    }

    /// Get connection by UUID
    ///
    /// * `uuid`: connection UUID
    pub fn get_connection_by_uuid(&self, uuid: Uuid) -> Option<&Connection> {
        self.connections.iter().find(|c| c.uuid == uuid)
    }

    /// Get connection by UUID as mutable
    ///
    /// * `uuid`: connection UUID
    pub fn get_connection_by_uuid_mut(&mut self, uuid: Uuid) -> Option<&mut Connection> {
        self.connections.iter_mut().find(|c| c.uuid == uuid)
    }

    /// Get connection by interface
    ///
    /// * `name`: connection interface name
    pub fn get_connection_by_interface(&self, name: &str) -> Option<&Connection> {
        let interface = Some(name);
        self.connections
            .iter()
            .find(|c| c.interface.as_deref() == interface)
    }

    /// Get connection by ID
    ///
    /// * `id`: connection ID
    pub fn get_connection(&self, id: &str) -> Option<&Connection> {
        self.connections.iter().find(|c| c.id == id)
    }

    /// Get connection by ID as mutable
    ///
    /// * `id`: connection ID
    pub fn get_connection_mut(&mut self, id: &str) -> Option<&mut Connection> {
        self.connections.iter_mut().find(|c| c.id == id)
    }

    /// Get a device by name as mutable
    ///
    /// * `name`: device name
    pub fn get_device_mut(&mut self, name: &str) -> Option<&mut Device> {
        self.devices.iter_mut().find(|c| c.name == name)
    }

    pub fn get_controlled_by(&mut self, uuid: Uuid) -> Vec<&Connection> {
        let uuid = Some(uuid);
        self.connections
            .iter()
            .filter(|c| c.controller == uuid)
            .collect()
    }

    /// Adds a new connection.
    ///
    /// It uses the `id` to decide whether the connection already exists.
    pub fn add_connection(&mut self, conn: Connection) -> Result<(), NetworkStateError> {
        if self.get_connection(&conn.id).is_some() {
            return Err(NetworkStateError::ConnectionExists(conn.id));
        }
        self.connections.push(conn);

        Ok(())
    }

    pub fn update_state(&mut self, config: Config) -> Result<(), NetworkStateError> {
        if let Some(connections) = config.connections {
            let mut collection: ConnectionCollection = connections.try_into()?;
            collection.0.iter_mut().for_each(|conn| {
                if let Some(current_conn) = self.get_connection(conn.id.as_str()) {
                    conn.uuid = current_conn.uuid;
                }
            });
            self.connections = collection.0;
        }
        if let Some(general_state) = config.general_state {
            self.general_state = general_state;
        }
        Ok(())
    }

    /// Updates a connection with a new one.
    ///
    /// It uses the `id` to decide which connection to update.
    ///
    /// Additionally, it registers the connection to be removed when the changes are applied.
    pub fn update_connection(&mut self, conn: Connection) -> Result<(), NetworkStateError> {
        let Some(old_conn) = self.get_connection_mut(&conn.id) else {
            return Err(NetworkStateError::UnknownConnection(conn.id.clone()));
        };
        *old_conn = conn;

        Ok(())
    }

    /// Removes a connection from the state.
    ///
    /// Additionally, it registers the connection to be removed when the changes are applied.
    pub fn remove_connection(&mut self, id: &str) -> Result<(), NetworkStateError> {
        let Some(conn) = self.get_connection_mut(id) else {
            return Err(NetworkStateError::UnknownConnection(id.to_string()));
        };

        conn.remove();
        Ok(())
    }

    pub fn add_device(&mut self, device: Device) -> Result<(), NetworkStateError> {
        self.devices.push(device);
        Ok(())
    }

    pub fn update_device(&mut self, name: &str, device: Device) -> Result<(), NetworkStateError> {
        let Some(old_device) = self.get_device_mut(name) else {
            return Err(NetworkStateError::UnknownDevice(device.name.clone()));
        };
        *old_device = device;

        Ok(())
    }

    pub fn remove_device(&mut self, name: &str) -> Result<(), NetworkStateError> {
        let Some(position) = self.devices.iter().position(|d| d.name == name) else {
            return Err(NetworkStateError::UnknownDevice(name.to_string()));
        };

        self.devices.remove(position);
        Ok(())
    }

    /// Sets a controller's ports.
    ///
    /// If the connection is not a controller, returns an error.
    ///
    /// * `controller`: controller to set ports on.
    /// * `ports`: list of port names (using the connection ID or the interface name).
    pub fn set_ports(
        &mut self,
        controller: &Connection,
        ports: Vec<String>,
    ) -> Result<(), NetworkStateError> {
        match &controller.config {
            ConnectionConfig::Bond(_) | ConnectionConfig::Bridge(_) => {
                let mut controlled = vec![];
                for port in ports {
                    let connection = self
                        .get_connection_by_interface(&port)
                        .or_else(|| self.get_connection(&port))
                        .ok_or(NetworkStateError::UnknownConnection(port))?;
                    controlled.push(connection.uuid);
                }

                for conn in self.connections.iter_mut() {
                    if controlled.contains(&conn.uuid) {
                        conn.controller = Some(controller.uuid);
                        if conn.interface.is_none() {
                            conn.interface = Some(conn.id.clone());
                        }
                    } else if conn.controller == Some(controller.uuid) {
                        conn.controller = None;
                    }
                }
                Ok(())
            }
            _ => Err(NetworkStateError::NotControllerConnection(
                controller.id.to_owned(),
            )),
        }
    }

    pub fn ports_for(&self, uuid: Uuid) -> Vec<String> {
        self.connections
            .iter()
            .filter(|c| c.controller == Some(uuid))
            .map(|c| {
                if let Some(interface) = c.interface.to_owned() {
                    interface
                } else {
                    c.clone().id
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::NetworkStateError;
    use uuid::Uuid;

    #[test]
    fn test_add_connection() {
        let mut state = NetworkState::default();
        let uuid = Uuid::new_v4();
        let conn0 = Connection {
            id: "eth0".to_string(),
            uuid,
            ..Default::default()
        };
        state.add_connection(conn0).unwrap();
        let found = state.get_connection("eth0").unwrap();
        assert_eq!(found.uuid, uuid);
    }

    #[test]
    fn test_add_duplicated_connection() {
        let mut state = NetworkState::default();
        let mut conn0 = Connection::new("eth0".to_string(), DeviceType::Ethernet);
        conn0.uuid = Uuid::new_v4();
        state.add_connection(conn0.clone()).unwrap();
        let error = state.add_connection(conn0).unwrap_err();
        assert!(matches!(error, NetworkStateError::ConnectionExists(_)));
    }

    #[test]
    fn test_update_connection() {
        let mut state = NetworkState::default();
        let conn0 = Connection {
            id: "eth0".to_string(),
            uuid: Uuid::new_v4(),
            ..Default::default()
        };
        state.add_connection(conn0).unwrap();

        let uuid = Uuid::new_v4();
        let conn1 = Connection {
            id: "eth0".to_string(),
            uuid,
            ..Default::default()
        };
        state.update_connection(conn1).unwrap();
        let found = state.get_connection("eth0").unwrap();
        assert_eq!(found.uuid, uuid);
    }

    #[test]
    fn test_update_unknown_connection() {
        let mut state = NetworkState::default();
        let conn0 = Connection::new("eth0".to_string(), DeviceType::Ethernet);
        let error = state.update_connection(conn0).unwrap_err();
        assert!(matches!(error, NetworkStateError::UnknownConnection(_)));
    }

    #[test]
    fn test_remove_connection() {
        let mut state = NetworkState::default();
        let conn0 = Connection::new("eth0".to_string(), DeviceType::Ethernet);
        state.add_connection(conn0).unwrap();
        state.remove_connection("eth0".as_ref()).unwrap();
        let found = state.get_connection("eth0").unwrap();
        assert!(found.is_removed());
    }

    #[test]
    fn test_remove_unknown_connection() {
        let mut state = NetworkState::default();
        let error = state.remove_connection("unknown".as_ref()).unwrap_err();
        assert!(matches!(error, NetworkStateError::UnknownConnection(_)));
    }

    #[test]
    fn test_is_loopback() {
        let conn = Connection::new("eth0".to_string(), DeviceType::Ethernet);
        assert!(!conn.is_loopback());

        let conn = Connection::new("eth0".to_string(), DeviceType::Loopback);
        assert!(conn.is_loopback());
    }

    #[test]
    fn test_set_bonding_ports() {
        let mut state = NetworkState::default();
        let eth0 = Connection {
            id: "eth0".to_string(),
            interface: Some("eth0".to_string()),
            ..Default::default()
        };
        let eth1 = Connection {
            id: "eth1".to_string(),
            interface: Some("eth1".to_string()),
            ..Default::default()
        };
        let bond0 = Connection {
            id: "bond0".to_string(),
            interface: Some("bond0".to_string()),
            config: ConnectionConfig::Bond(Default::default()),
            ..Default::default()
        };

        state.add_connection(eth0).unwrap();
        state.add_connection(eth1).unwrap();
        state.add_connection(bond0.clone()).unwrap();

        state.set_ports(&bond0, vec!["eth1".to_string()]).unwrap();

        let eth1_found = state.get_connection("eth1").unwrap();
        assert_eq!(eth1_found.controller, Some(bond0.uuid));
        let eth0_found = state.get_connection("eth0").unwrap();
        assert_eq!(eth0_found.controller, None);
    }

    #[test]
    fn test_set_bonding_missing_port() {
        let mut state = NetworkState::default();
        let bond0 = Connection {
            id: "bond0".to_string(),
            interface: Some("bond0".to_string()),
            config: ConnectionConfig::Bond(Default::default()),
            ..Default::default()
        };
        state.add_connection(bond0.clone()).unwrap();

        let error = state
            .set_ports(&bond0, vec!["eth0".to_string()])
            .unwrap_err();
        assert!(matches!(error, NetworkStateError::UnknownConnection(_)));
    }

    #[test]
    fn test_set_non_controller_ports() {
        let mut state = NetworkState::default();
        let eth0 = Connection {
            id: "eth0".to_string(),
            ..Default::default()
        };
        state.add_connection(eth0.clone()).unwrap();

        let error = state
            .set_ports(&eth0, vec!["eth1".to_string()])
            .unwrap_err();
        assert!(matches!(
            error,
            NetworkStateError::NotControllerConnection(_),
        ));
    }
}

pub const NOT_COPY_NETWORK_PATH: &str = "/run/agama/not_copy_network";

/// Represents a known network connection.
#[serde_as]
#[skip_serializing_none]
#[derive(Debug, Clone, PartialEq, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub id: String,
    pub uuid: Uuid,
    #[schema(schema_with = schemas::mac_addr6)]
    pub mac_address: Option<MacAddr6>,
    #[serde_as(as = "DisplayFromStr")]
    pub custom_mac_address: MacAddress,
    pub firewall_zone: Option<String>,
    pub mtu: u32,
    pub ip_config: IpConfig,
    pub status: Status,
    pub interface: Option<String>,
    pub controller: Option<Uuid>,
    pub port_config: PortConfig,
    pub match_config: MatchConfig,
    pub config: ConnectionConfig,
    pub ieee_8021x_config: Option<IEEE8021XConfig>,
    pub autoconnect: bool,
    pub state: ConnectionState,
    pub persistent: bool,
    pub flags: u32,
}

impl Connection {
    pub fn new(id: String, device_type: DeviceType) -> Self {
        let config = match device_type {
            DeviceType::Ethernet => ConnectionConfig::Ethernet,
            DeviceType::Wireless => ConnectionConfig::Wireless(Default::default()),
            DeviceType::Loopback => ConnectionConfig::Loopback,
            DeviceType::Dummy => ConnectionConfig::Dummy,
            DeviceType::Bond => ConnectionConfig::Bond(Default::default()),
            DeviceType::Vlan => ConnectionConfig::Vlan(Default::default()),
            DeviceType::Bridge => ConnectionConfig::Bridge(Default::default()),
        };
        Self {
            id,
            config,
            ..Default::default()
        }
    }

    pub fn remove(&mut self) {
        self.status = Status::Removed;
    }

    pub fn is_removed(&self) -> bool {
        self.status == Status::Removed
    }

    pub fn is_up(&self) -> bool {
        self.status == Status::Up
    }

    pub fn is_down(&self) -> bool {
        self.status == Status::Down
    }

    pub fn set_up(&mut self) {
        self.status = Status::Up
    }

    pub fn keep_status(&mut self) {
        self.status = Status::Keep
    }

    pub fn set_down(&mut self) {
        self.status = Status::Down
    }

    /// Determines whether it is a loopback interface.
    pub fn is_loopback(&self) -> bool {
        matches!(self.config, ConnectionConfig::Loopback)
    }

    pub fn is_ethernet(&self) -> bool {
        matches!(self.config, ConnectionConfig::Loopback)
            || matches!(self.config, ConnectionConfig::Ethernet)
            || matches!(self.config, ConnectionConfig::Dummy)
            || matches!(self.config, ConnectionConfig::Bond(_))
            || matches!(self.config, ConnectionConfig::Vlan(_))
            || matches!(self.config, ConnectionConfig::Bridge(_))
    }
}

impl Default for Connection {
    fn default() -> Self {
        Self {
            id: Default::default(),
            uuid: Uuid::new_v4(),
            mac_address: Default::default(),
            custom_mac_address: Default::default(),
            firewall_zone: Default::default(),
            mtu: Default::default(),
            ip_config: Default::default(),
            status: Default::default(),
            interface: Default::default(),
            controller: Default::default(),
            port_config: Default::default(),
            match_config: Default::default(),
            config: Default::default(),
            ieee_8021x_config: Default::default(),
            autoconnect: true,
            state: Default::default(),
            persistent: true,
            flags: Default::default(),
        }
    }
}

impl TryFrom<NetworkConnection> for Connection {
    type Error = NetworkStateError;

    fn try_from(conn: NetworkConnection) -> Result<Self, Self::Error> {
        let id = conn.clone().id;
        let mut connection = Connection::new(id, conn.device_type());

        if let Some(method) = conn.clone().method4 {
            let method: Ipv4Method = method.parse().unwrap();
            connection.ip_config.method4 = method;
        }

        if let Some(method) = conn.method6 {
            let method: Ipv6Method = method.parse().unwrap();
            connection.ip_config.method6 = method;
        }

        if let Some(status) = conn.status {
            connection.status = status;
        }

        if let Some(autoconnect) = conn.autoconnect {
            connection.autoconnect = autoconnect;
        }

        if let Some(persistent) = conn.persistent {
            connection.persistent = persistent;
        }

        if let Some(ignore_auto_dns) = conn.ignore_auto_dns {
            connection.ip_config.ignore_auto_dns = ignore_auto_dns;
        }

        if let Some(vlan_config) = conn.vlan {
            let config = VlanConfig::try_from(vlan_config)?;
            connection.config = config.into();
        }
        if let Some(wireless_config) = conn.wireless {
            let config = WirelessConfig::try_from(wireless_config)?;
            connection.config = config.into();
        }

        if let Some(bond_config) = conn.bond {
            let config = BondConfig::try_from(bond_config)?;
            connection.config = config.into();
        }
        if let Some(bridge_config) = conn.bridge {
            let config = BridgeConfig::try_from(bridge_config)?;
            connection.config = config.into();
        }

        if let Some(ieee_8021x_config) = conn.ieee_8021x {
            connection.ieee_8021x_config = Some(IEEE8021XConfig::try_from(ieee_8021x_config)?);
        }

        if let Some(mac) = conn.mac_address {
            connection.mac_address = match MacAddr6::from_str(mac.as_str()) {
                Ok(mac) => Some(mac),
                Err(_) => None,
            }
        }

        connection.ip_config.addresses = conn.addresses;
        connection.ip_config.nameservers = conn.nameservers;
        connection.ip_config.dns_searchlist = conn.dns_searchlist;
        connection.ip_config.gateway4 = conn.gateway4;
        connection.ip_config.gateway6 = conn.gateway6;
        connection.interface = conn.interface;
        connection.mtu = conn.mtu;

        Ok(connection)
    }
}

impl TryFrom<Connection> for NetworkConnection {
    type Error = NetworkStateError;

    fn try_from(conn: Connection) -> Result<Self, Self::Error> {
        let id = conn.clone().id;
        let custom_mac = conn.custom_mac_address.to_string();
        let method4 = Some(conn.ip_config.method4.to_string());
        let method6 = Some(conn.ip_config.method6.to_string());
        let mac_address = conn.mac_address.and_then(|mac| Some(mac.to_string()));
        let custom_mac_address = (!custom_mac.is_empty()).then_some(custom_mac);
        let nameservers = conn.ip_config.nameservers;
        let dns_searchlist = conn.ip_config.dns_searchlist;
        let ignore_auto_dns = Some(conn.ip_config.ignore_auto_dns);
        let addresses = conn.ip_config.addresses;
        let gateway4 = conn.ip_config.gateway4;
        let gateway6 = conn.ip_config.gateway6;
        let interface = conn.interface;
        let status = Some(conn.status);
        let mtu = conn.mtu;
        let ieee_8021x: Option<IEEE8021XSettings> = conn
            .ieee_8021x_config
            .and_then(|x| IEEE8021XSettings::try_from(x).ok());
        let autoconnect = Some(conn.autoconnect);
        let persistent = Some(conn.persistent);

        let mut connection = NetworkConnection {
            id,
            status,
            method4,
            method6,
            gateway4,
            gateway6,
            nameservers,
            dns_searchlist,
            ignore_auto_dns,
            custom_mac_address,
            mac_address,
            interface,
            addresses,
            mtu,
            ieee_8021x,
            autoconnect,
            persistent,
            ..Default::default()
        };

        match conn.config {
            ConnectionConfig::Wireless(config) => {
                connection.wireless = Some(WirelessSettings::try_from(config)?);
            }
            ConnectionConfig::Bond(config) => {
                connection.bond = Some(BondSettings::try_from(config)?);
            }
            ConnectionConfig::Bridge(config) => {
                connection.bridge = Some(BridgeSettings::try_from(config)?);
            }
            ConnectionConfig::Vlan(config) => {
                connection.vlan = Some(VlanSettings::try_from(config)?);
            }
            _ => {}
        }

        Ok(connection)
    }
}

#[derive(Default, Debug, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub enum ConnectionConfig {
    #[default]
    Ethernet,
    Wireless(WirelessConfig),
    Loopback,
    Dummy,
    Bond(BondConfig),
    Vlan(VlanConfig),
    Bridge(BridgeConfig),
    Infiniband(InfinibandConfig),
    Tun(TunConfig),
    OvsBridge(OvsBridgeConfig),
    OvsPort(OvsPortConfig),
    OvsInterface(OvsInterfaceConfig),
}

#[derive(Default, Debug, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub enum PortConfig {
    #[default]
    None,
    Bridge(BridgePortConfig),
    OvsBridge(OvsBridgePortConfig),
}

impl From<BridgeConfig> for ConnectionConfig {
    fn from(value: BridgeConfig) -> Self {
        Self::Bridge(value)
    }
}

impl From<BondConfig> for ConnectionConfig {
    fn from(value: BondConfig) -> Self {
        Self::Bond(value)
    }
}

impl From<VlanConfig> for ConnectionConfig {
    fn from(value: VlanConfig) -> Self {
        Self::Vlan(value)
    }
}

impl From<WirelessConfig> for ConnectionConfig {
    fn from(value: WirelessConfig) -> Self {
        Self::Wireless(value)
    }
}

#[skip_serializing_none]
#[derive(Debug, Default, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub struct MatchConfig {
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub driver: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub interface: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub path: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub kernel: Vec<String>,
}

#[derive(Debug, Default, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub enum VlanProtocol {
    #[default]
    IEEE802_1Q,
    IEEE802_1ad,
}

#[derive(Debug, Error)]
#[error("Invalid VlanProtocol: {0}")]
pub struct InvalidVlanProtocol(String);

impl std::str::FromStr for VlanProtocol {
    type Err = InvalidVlanProtocol;

    fn from_str(s: &str) -> Result<VlanProtocol, Self::Err> {
        match s {
            "802.1Q" => Ok(VlanProtocol::IEEE802_1Q),
            "802.1ad" => Ok(VlanProtocol::IEEE802_1ad),
            _ => Err(InvalidVlanProtocol(s.to_string())),
        }
    }
}

impl fmt::Display for VlanProtocol {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            VlanProtocol::IEEE802_1Q => "802.1Q",
            VlanProtocol::IEEE802_1ad => "802.1ad",
        };
        write!(f, "{}", name)
    }
}

#[derive(Debug, Default, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub struct VlanConfig {
    pub parent: String,
    pub id: u32,
    pub protocol: VlanProtocol,
}

#[serde_as]
#[derive(Debug, Default, PartialEq, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WirelessConfig {
    pub mode: WirelessMode,
    #[serde_as(as = "DisplayFromStr")]
    pub ssid: SSID,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    pub security: SecurityProtocol,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub band: Option<WirelessBand>,
    pub channel: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(schema_with = schemas::mac_addr6)]
    pub bssid: Option<macaddr::MacAddr6>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wep_security: Option<WEPSecurity>,
    pub hidden: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub group_algorithms: Vec<GroupAlgorithm>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub pairwise_algorithms: Vec<PairwiseAlgorithm>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub wpa_protocol_versions: Vec<WPAProtocolVersion>,
    pub pmf: i32,
}

impl TryFrom<ConnectionConfig> for WirelessConfig {
    type Error = NetworkStateError;

    fn try_from(value: ConnectionConfig) -> Result<Self, Self::Error> {
        match value {
            ConnectionConfig::Wireless(config) => Ok(config),
            _ => Err(NetworkStateError::UnexpectedConfiguration),
        }
    }
}

impl TryFrom<VlanSettings> for VlanConfig {
    type Error = NetworkStateError;

    fn try_from(settings: VlanSettings) -> Result<Self, Self::Error> {
        let id = settings.id;
        let parent = settings.parent;

        let mut config = VlanConfig {
            id,
            parent,
            ..Default::default()
        };

        if let Some(protocol) = &settings.protocol {
            config.protocol = VlanProtocol::from_str(protocol)
                .map_err(|_| NetworkStateError::InvalidVlanProtocol(protocol.to_string()))?;
        }

        Ok(config)
    }
}

impl TryFrom<VlanConfig> for VlanSettings {
    type Error = NetworkStateError;

    fn try_from(vlan: VlanConfig) -> Result<Self, Self::Error> {
        Ok(VlanSettings {
            id: vlan.id,
            parent: vlan.parent,
            protocol: Some(vlan.protocol.to_string()),
        })
    }
}

impl TryFrom<WirelessSettings> for WirelessConfig {
    type Error = NetworkStateError;

    fn try_from(settings: WirelessSettings) -> Result<Self, Self::Error> {
        let ssid = SSID(settings.ssid.as_bytes().into());
        let mode = WirelessMode::try_from(settings.mode.as_str())?;
        let security = SecurityProtocol::try_from(settings.security.as_str())?;
        let band = if let Some(band) = &settings.band {
            Some(
                WirelessBand::try_from(band.as_str())
                    .map_err(|_| NetworkStateError::InvalidWirelessBand(band.to_string()))?,
            )
        } else {
            None
        };
        let bssid = if let Some(bssid) = &settings.bssid {
            Some(
                macaddr::MacAddr6::from_str(bssid)
                    .map_err(|_| NetworkStateError::InvalidBssid(bssid.to_string()))?,
            )
        } else {
            None
        };
        let group_algorithms = settings
            .group_algorithms
            .iter()
            .map(|x| {
                GroupAlgorithm::from_str(x)
                    .map_err(|_| NetworkStateError::InvalidGroupAlgorithm(x.to_string()))
            })
            .collect::<Result<Vec<GroupAlgorithm>, NetworkStateError>>()?;
        let pairwise_algorithms = settings
            .pairwise_algorithms
            .iter()
            .map(|x| {
                PairwiseAlgorithm::from_str(x)
                    .map_err(|_| NetworkStateError::InvalidGroupAlgorithm(x.to_string()))
            })
            .collect::<Result<Vec<PairwiseAlgorithm>, NetworkStateError>>()?;
        let wpa_protocol_versions = settings
            .wpa_protocol_versions
            .iter()
            .map(|x| {
                WPAProtocolVersion::from_str(x)
                    .map_err(|_| NetworkStateError::InvalidGroupAlgorithm(x.to_string()))
            })
            .collect::<Result<Vec<WPAProtocolVersion>, NetworkStateError>>()?;

        Ok(WirelessConfig {
            ssid,
            mode,
            security,
            password: settings.password,
            band,
            channel: settings.channel,
            bssid,
            hidden: settings.hidden,
            group_algorithms,
            pairwise_algorithms,
            wpa_protocol_versions,
            pmf: settings.pmf,
            ..Default::default()
        })
    }
}

impl TryFrom<WirelessConfig> for WirelessSettings {
    type Error = NetworkStateError;

    fn try_from(wireless: WirelessConfig) -> Result<Self, Self::Error> {
        let band = wireless.band.map(|x| x.to_string());
        let bssid = wireless.bssid.map(|x| x.to_string());
        let group_algorithms = wireless
            .group_algorithms
            .iter()
            .map(|x| x.to_string())
            .collect::<Vec<String>>();
        let pairwise_algorithms = wireless
            .pairwise_algorithms
            .iter()
            .map(|x| x.to_string())
            .collect::<Vec<String>>();
        let wpa_protocol_versions = wireless
            .wpa_protocol_versions
            .iter()
            .map(|x| x.to_string())
            .collect::<Vec<String>>();

        Ok(WirelessSettings {
            ssid: wireless.ssid.to_string(),
            mode: wireless.mode.to_string(),
            security: wireless.security.to_string(),
            password: wireless.password,
            band,
            channel: wireless.channel,
            bssid,
            hidden: wireless.hidden,
            group_algorithms,
            pairwise_algorithms,
            wpa_protocol_versions,
            pmf: wireless.pmf,
        })
    }
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, utoipa::ToSchema)]
pub enum WirelessMode {
    Unknown = 0,
    AdHoc = 1,
    #[default]
    Infra = 2,
    AP = 3,
    Mesh = 4,
}

impl TryFrom<&str> for WirelessMode {
    type Error = NetworkStateError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "unknown" => Ok(WirelessMode::Unknown),
            "adhoc" => Ok(WirelessMode::AdHoc),
            "infrastructure" => Ok(WirelessMode::Infra),
            "ap" => Ok(WirelessMode::AP),
            "mesh" => Ok(WirelessMode::Mesh),
            _ => Err(NetworkStateError::InvalidWirelessMode(value.to_string())),
        }
    }
}

impl fmt::Display for WirelessMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            WirelessMode::Unknown => "unknown",
            WirelessMode::AdHoc => "adhoc",
            WirelessMode::Infra => "infrastructure",
            WirelessMode::AP => "ap",
            WirelessMode::Mesh => "mesh",
        };
        write!(f, "{}", name)
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, utoipa::ToSchema)]
pub enum SecurityProtocol {
    #[default]
    WEP, // No encryption or WEP ("none")
    OWE,            // Opportunistic Wireless Encryption ("owe")
    DynamicWEP,     // Dynamic WEP ("ieee8021x")
    WPA2,           // WPA2 + WPA3 personal ("wpa-psk")
    WPA3Personal,   // WPA3 personal only ("sae")
    WPA2Enterprise, // WPA2 + WPA3 Enterprise ("wpa-eap")
    WPA3Only,       // WPA3 only ("wpa-eap-suite-b-192")
}

impl fmt::Display for SecurityProtocol {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match &self {
            SecurityProtocol::WEP => "none",
            SecurityProtocol::OWE => "owe",
            SecurityProtocol::DynamicWEP => "ieee8021x",
            SecurityProtocol::WPA2 => "wpa-psk",
            SecurityProtocol::WPA3Personal => "sae",
            SecurityProtocol::WPA2Enterprise => "wpa-eap",
            SecurityProtocol::WPA3Only => "wpa-eap-suite-b-192",
        };
        write!(f, "{}", value)
    }
}

impl TryFrom<&str> for SecurityProtocol {
    type Error = NetworkStateError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "none" => Ok(SecurityProtocol::WEP),
            "owe" => Ok(SecurityProtocol::OWE),
            "ieee8021x" => Ok(SecurityProtocol::DynamicWEP),
            "wpa-psk" => Ok(SecurityProtocol::WPA2),
            "sae" => Ok(SecurityProtocol::WPA3Personal),
            "wpa-eap" => Ok(SecurityProtocol::WPA2Enterprise),
            "wpa-eap-suite-b-192" => Ok(SecurityProtocol::WPA3Only),
            _ => Err(NetworkStateError::InvalidSecurityProtocol(
                value.to_string(),
            )),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, utoipa::ToSchema)]
pub enum GroupAlgorithm {
    Wep40,
    Wep104,
    Tkip,
    Ccmp,
}

#[derive(Debug, Error)]
#[error("Invalid group algorithm: {0}")]
pub struct InvalidGroupAlgorithm(String);

impl FromStr for GroupAlgorithm {
    type Err = InvalidGroupAlgorithm;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "wep40" => Ok(GroupAlgorithm::Wep40),
            "wep104" => Ok(GroupAlgorithm::Wep104),
            "tkip" => Ok(GroupAlgorithm::Tkip),
            "ccmp" => Ok(GroupAlgorithm::Ccmp),
            _ => Err(InvalidGroupAlgorithm(value.to_string())),
        }
    }
}

impl fmt::Display for GroupAlgorithm {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            GroupAlgorithm::Wep40 => "wep40",
            GroupAlgorithm::Wep104 => "wep104",
            GroupAlgorithm::Tkip => "tkip",
            GroupAlgorithm::Ccmp => "ccmp",
        };
        write!(f, "{}", name)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, utoipa::ToSchema)]
pub enum PairwiseAlgorithm {
    Tkip,
    Ccmp,
}

#[derive(Debug, Error)]
#[error("Invalid pairwise algorithm: {0}")]
pub struct InvalidPairwiseAlgorithm(String);

impl FromStr for PairwiseAlgorithm {
    type Err = InvalidPairwiseAlgorithm;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "tkip" => Ok(PairwiseAlgorithm::Tkip),
            "ccmp" => Ok(PairwiseAlgorithm::Ccmp),
            _ => Err(InvalidPairwiseAlgorithm(value.to_string())),
        }
    }
}

impl fmt::Display for PairwiseAlgorithm {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            PairwiseAlgorithm::Tkip => "tkip",
            PairwiseAlgorithm::Ccmp => "ccmp",
        };
        write!(f, "{}", name)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, utoipa::ToSchema)]
pub enum WPAProtocolVersion {
    Wpa,
    Rsn,
}

#[derive(Debug, Error)]
#[error("Invalid WPA protocol version: {0}")]
pub struct InvalidWPAProtocolVersion(String);

impl FromStr for WPAProtocolVersion {
    type Err = InvalidWPAProtocolVersion;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "wpa" => Ok(WPAProtocolVersion::Wpa),
            "rsn" => Ok(WPAProtocolVersion::Rsn),
            _ => Err(InvalidWPAProtocolVersion(value.to_string())),
        }
    }
}

impl fmt::Display for WPAProtocolVersion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            WPAProtocolVersion::Wpa => "wpa",
            WPAProtocolVersion::Rsn => "rsn",
        };
        write!(f, "{}", name)
    }
}

#[derive(Debug, Default, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub struct WEPSecurity {
    pub auth_alg: WEPAuthAlg,
    pub wep_key_type: WEPKeyType,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub keys: Vec<String>,
    pub wep_key_index: u32,
}

#[derive(Debug, Default, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub enum WEPKeyType {
    #[default]
    Unknown = 0,
    Key = 1,
    Passphrase = 2,
}

impl TryFrom<u32> for WEPKeyType {
    type Error = NetworkStateError;

    fn try_from(value: u32) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(WEPKeyType::Unknown),
            1 => Ok(WEPKeyType::Key),
            2 => Ok(WEPKeyType::Passphrase),
            _ => Err(NetworkStateError::InvalidWEPKeyType(value)),
        }
    }
}

#[derive(Debug, Default, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub enum WEPAuthAlg {
    #[default]
    Unset,
    Open,
    Shared,
    Leap,
}

impl TryFrom<&str> for WEPAuthAlg {
    type Error = NetworkStateError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "open" => Ok(WEPAuthAlg::Open),
            "shared" => Ok(WEPAuthAlg::Shared),
            "leap" => Ok(WEPAuthAlg::Leap),
            "" => Ok(WEPAuthAlg::Unset),
            _ => Err(NetworkStateError::InvalidWEPAuthAlg(value.to_string())),
        }
    }
}

impl fmt::Display for WEPAuthAlg {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            WEPAuthAlg::Open => "open",
            WEPAuthAlg::Shared => "shared",
            WEPAuthAlg::Leap => "shared",
            WEPAuthAlg::Unset => "",
        };
        write!(f, "{}", name)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, utoipa::ToSchema)]
pub enum WirelessBand {
    A,  // 5GHz
    BG, // 2.4GHz
}

impl fmt::Display for WirelessBand {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match &self {
            WirelessBand::A => "a",
            WirelessBand::BG => "bg",
        };
        write!(f, "{}", value)
    }
}

impl TryFrom<&str> for WirelessBand {
    type Error = NetworkStateError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "a" => Ok(WirelessBand::A),
            "bg" => Ok(WirelessBand::BG),
            _ => Err(NetworkStateError::InvalidWirelessBand(value.to_string())),
        }
    }
}

#[derive(Debug, Default, Clone, PartialEq, Serialize, utoipa::ToSchema)]
pub struct BondOptions(pub HashMap<String, String>);

impl TryFrom<&str> for BondOptions {
    type Error = NetworkStateError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        let mut options = HashMap::new();

        for opt in value.split_whitespace() {
            let (key, value) = opt
                .trim()
                .split_once('=')
                .ok_or(NetworkStateError::InvalidBondOptions)?;
            options.insert(key.to_string(), value.to_string());
        }

        Ok(BondOptions(options))
    }
}

impl fmt::Display for BondOptions {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let opts = &self
            .0
            .iter()
            .map(|(key, value)| format!("{key}={value}"))
            .collect::<Vec<_>>();

        write!(f, "{}", opts.join(" "))
    }
}

#[derive(Debug, Default, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub struct BondConfig {
    pub mode: BondMode,
    pub options: BondOptions,
}

#[derive(Clone, Debug, Default)]
pub struct ConnectionCollection(pub Vec<Connection>);

impl ConnectionCollection {
    pub fn ports_for(&self, uuid: Uuid) -> Vec<String> {
        self.0
            .iter()
            .filter(|c| c.controller == Some(uuid))
            .map(|c| {
                if let Some(interface) = c.interface.to_owned() {
                    interface
                } else {
                    c.clone().id
                }
            })
            .collect()
    }
}

impl TryFrom<ConnectionCollection> for NetworkConnectionsCollection {
    type Error = NetworkStateError;

    fn try_from(collection: ConnectionCollection) -> Result<Self, Self::Error> {
        let network_connections = collection
            .0
            .iter()
            .filter(|c| c.controller.is_none())
            .map(|c| {
                let mut conn = NetworkConnection::try_from(c.clone()).unwrap();
                if let Some(ref mut bond) = conn.bond {
                    bond.ports = collection.ports_for(c.uuid);
                }
                if let Some(ref mut bridge) = conn.bridge {
                    bridge.ports = collection.ports_for(c.uuid);
                };
                conn
            })
            .collect();

        Ok(NetworkConnectionsCollection(network_connections))
    }
}

impl TryFrom<NetworkConnectionsCollection> for ConnectionCollection {
    type Error = NetworkStateError;

    fn try_from(collection: NetworkConnectionsCollection) -> Result<Self, Self::Error> {
        let network_connections = collection
            .0
            .iter()
            .map(|c| Connection::try_from(c.clone()).unwrap())
            .collect();

        Ok(ConnectionCollection(network_connections))
    }
}

impl TryFrom<NetworkState> for NetworkConnectionsCollection {
    type Error = NetworkStateError;

    fn try_from(state: NetworkState) -> Result<Self, Self::Error> {
        let network_connections = state
            .connections
            .iter()
            .filter(|c| c.controller.is_none())
            .map(|c| {
                let mut conn = NetworkConnection::try_from(c.clone()).unwrap();
                if let Some(ref mut bond) = conn.bond {
                    bond.ports = state.ports_for(c.uuid);
                }
                if let Some(ref mut bridge) = conn.bridge {
                    bridge.ports = state.ports_for(c.uuid);
                };
                conn
            })
            .collect();

        Ok(NetworkConnectionsCollection(network_connections))
    }
}

impl TryFrom<NetworkState> for NetworkSettings {
    type Error = NetworkStateError;

    fn try_from(state: NetworkState) -> Result<Self, Self::Error> {
        let connections: NetworkConnectionsCollection = state.try_into()?;

        Ok(NetworkSettings { connections })
    }
}

impl TryFrom<NetworkState> for Config {
    type Error = NetworkStateError;

    fn try_from(state: NetworkState) -> Result<Self, Self::Error> {
        let connections: NetworkConnectionsCollection =
            ConnectionCollection(state.connections).try_into()?;

        Ok(Config {
            connections: Some(connections),
            general_state: Some(state.general_state),
        })
    }
}

impl TryFrom<NetworkState> for SystemInfo {
    type Error = NetworkStateError;

    fn try_from(state: NetworkState) -> Result<Self, Self::Error> {
        let connections: NetworkConnectionsCollection =
            ConnectionCollection(state.connections).try_into()?;

        Ok(SystemInfo {
            access_points: state.access_points,
            connections,
            devices: state.devices,
            general_state: state.general_state,
        })
    }
}

impl TryFrom<NetworkState> for Proposal {
    type Error = NetworkStateError;

    fn try_from(state: NetworkState) -> Result<Self, Self::Error> {
        let connections: NetworkConnectionsCollection =
            ConnectionCollection(state.connections).try_into()?;

        Ok(Proposal {
            connections,
            general_state: state.general_state,
        })
    }
}

impl TryFrom<ConnectionConfig> for BondConfig {
    type Error = NetworkStateError;

    fn try_from(value: ConnectionConfig) -> Result<Self, Self::Error> {
        match value {
            ConnectionConfig::Bond(config) => Ok(config),
            _ => Err(NetworkStateError::UnexpectedConfiguration),
        }
    }
}

impl TryFrom<BondSettings> for BondConfig {
    type Error = NetworkStateError;

    fn try_from(settings: BondSettings) -> Result<Self, Self::Error> {
        let mode = BondMode::try_from(settings.mode.as_str())
            .map_err(|_| NetworkStateError::InvalidBondMode(settings.mode))?;
        let mut options = BondOptions::default();
        if let Some(setting_options) = settings.options {
            options = BondOptions::try_from(setting_options.as_str())?;
        }

        Ok(BondConfig { mode, options })
    }
}

impl TryFrom<BondConfig> for BondSettings {
    type Error = NetworkStateError;

    fn try_from(bond: BondConfig) -> Result<Self, Self::Error> {
        Ok(BondSettings {
            mode: bond.mode.to_string(),
            options: Some(bond.options.to_string()),
            ..Default::default()
        })
    }
}

#[skip_serializing_none]
#[derive(Debug, Default, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub struct BridgeConfig {
    pub stp: Option<bool>,
    pub priority: Option<u32>,
    pub forward_delay: Option<u32>,
    pub hello_time: Option<u32>,
    pub max_age: Option<u32>,
    pub ageing_time: Option<u32>,
}

impl TryFrom<ConnectionConfig> for BridgeConfig {
    type Error = NetworkStateError;

    fn try_from(value: ConnectionConfig) -> Result<Self, Self::Error> {
        match value {
            ConnectionConfig::Bridge(config) => Ok(config),
            _ => Err(NetworkStateError::UnexpectedConfiguration),
        }
    }
}

impl TryFrom<BridgeSettings> for BridgeConfig {
    type Error = NetworkStateError;

    fn try_from(settings: BridgeSettings) -> Result<Self, Self::Error> {
        let stp = settings.stp;
        let priority = settings.priority;
        let forward_delay = settings.forward_delay;
        let hello_time = settings.forward_delay;

        Ok(BridgeConfig {
            stp,
            priority,
            forward_delay,
            hello_time,
            ..Default::default()
        })
    }
}

impl TryFrom<BridgeConfig> for BridgeSettings {
    type Error = NetworkStateError;

    fn try_from(bridge: BridgeConfig) -> Result<Self, Self::Error> {
        Ok(BridgeSettings {
            stp: bridge.stp,
            priority: bridge.priority,
            forward_delay: bridge.forward_delay,
            hello_time: bridge.hello_time,
            ..Default::default()
        })
    }
}
#[derive(Debug, Default, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub struct BridgePortConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path_cost: Option<u32>,
}

#[derive(Default, Debug, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub struct InfinibandConfig {
    pub p_key: Option<i32>,
    pub parent: Option<String>,
    pub transport_mode: InfinibandTransportMode,
}

#[derive(Default, Debug, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub enum InfinibandTransportMode {
    #[default]
    Datagram,
    Connected,
}

#[derive(Debug, Error)]
#[error("Invalid infiniband transport-mode: {0}")]
pub struct InvalidInfinibandTransportMode(String);

impl FromStr for InfinibandTransportMode {
    type Err = InvalidInfinibandTransportMode;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "datagram" => Ok(Self::Datagram),
            "connected" => Ok(Self::Connected),
            _ => Err(InvalidInfinibandTransportMode(s.to_string())),
        }
    }
}

impl fmt::Display for InfinibandTransportMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            InfinibandTransportMode::Datagram => "datagram",
            InfinibandTransportMode::Connected => "connected",
        };
        write!(f, "{}", name)
    }
}

#[derive(Default, Debug, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub enum TunMode {
    #[default]
    Tun = 1,
    Tap = 2,
}

#[derive(Default, Debug, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub struct TunConfig {
    pub mode: TunMode,
    pub group: Option<String>,
    pub owner: Option<String>,
}

/// Represents a network change.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum NetworkChange {
    /// A new device has been added.
    DeviceAdded(Device),
    /// A device has been removed.
    DeviceRemoved(String),
    /// The device has been updated. The String corresponds to the
    /// original device name, which is especially useful if the
    /// device gets renamed.
    DeviceUpdated(String, Device),
    /// A connection state has changed.
    ConnectionStateChanged { id: String, state: ConnectionState },
}

#[derive(Default, Debug, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub struct IEEE8021XConfig {
    pub eap: Vec<EAPMethod>,
    pub phase2_auth: Option<Phase2AuthMethod>,
    pub identity: Option<String>,
    pub password: Option<String>,
    pub ca_cert: Option<String>,
    pub ca_cert_password: Option<String>,
    pub client_cert: Option<String>,
    pub client_cert_password: Option<String>,
    pub private_key: Option<String>,
    pub private_key_password: Option<String>,
    pub anonymous_identity: Option<String>,
    pub peap_version: Option<String>,
    pub peap_label: bool,
}

impl TryFrom<IEEE8021XSettings> for IEEE8021XConfig {
    type Error = NetworkStateError;

    fn try_from(value: IEEE8021XSettings) -> Result<Self, Self::Error> {
        let eap = value
            .eap
            .iter()
            .map(|x| {
                EAPMethod::from_str(x)
                    .map_err(|_| NetworkStateError::InvalidEAPMethod(x.to_string()))
            })
            .collect::<Result<Vec<EAPMethod>, NetworkStateError>>()?;
        let phase2_auth =
            if let Some(phase2_auth) = &value.phase2_auth {
                Some(Phase2AuthMethod::from_str(phase2_auth).map_err(|_| {
                    NetworkStateError::InvalidPhase2AuthMethod(phase2_auth.to_string())
                })?)
            } else {
                None
            };

        Ok(IEEE8021XConfig {
            eap,
            phase2_auth,
            identity: value.identity,
            password: value.password,
            ca_cert: value.ca_cert,
            ca_cert_password: value.ca_cert_password,
            client_cert: value.client_cert,
            client_cert_password: value.client_cert_password,
            private_key: value.private_key,
            private_key_password: value.private_key_password,
            anonymous_identity: value.anonymous_identity,
            peap_version: value.peap_version,
            peap_label: value.peap_label,
        })
    }
}

impl TryFrom<IEEE8021XConfig> for IEEE8021XSettings {
    type Error = NetworkStateError;

    fn try_from(value: IEEE8021XConfig) -> Result<Self, Self::Error> {
        let eap = value
            .eap
            .iter()
            .map(|x| x.to_string())
            .collect::<Vec<String>>();
        let phase2_auth = value.phase2_auth.map(|phase2_auth| phase2_auth.to_string());

        Ok(IEEE8021XSettings {
            eap,
            phase2_auth,
            identity: value.identity,
            password: value.password,
            ca_cert: value.ca_cert,
            ca_cert_password: value.ca_cert_password,
            client_cert: value.client_cert,
            client_cert_password: value.client_cert_password,
            private_key: value.private_key,
            private_key_password: value.private_key_password,
            anonymous_identity: value.anonymous_identity,
            peap_version: value.peap_version,
            peap_label: value.peap_label,
        })
    }
}

#[derive(Debug, Error)]
#[error("Invalid eap method: {0}")]
pub struct InvalidEAPMethod(String);

#[derive(Debug, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub enum EAPMethod {
    LEAP,
    MD5,
    TLS,
    PEAP,
    TTLS,
    PWD,
    FAST,
}

impl FromStr for EAPMethod {
    type Err = InvalidEAPMethod;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "leap" => Ok(Self::LEAP),
            "md5" => Ok(Self::MD5),
            "tls" => Ok(Self::TLS),
            "peap" => Ok(Self::PEAP),
            "ttls" => Ok(Self::TTLS),
            "pwd" => Ok(Self::PWD),
            "fast" => Ok(Self::FAST),
            _ => Err(InvalidEAPMethod(s.to_string())),
        }
    }
}

impl fmt::Display for EAPMethod {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match &self {
            Self::LEAP => "leap",
            Self::MD5 => "md5",
            Self::TLS => "tls",
            Self::PEAP => "peap",
            Self::TTLS => "ttls",
            Self::PWD => "pwd",
            Self::FAST => "fast",
        };
        write!(f, "{}", value)
    }
}

#[derive(Debug, Error)]
#[error("Invalid phase2-auth method: {0}")]
pub struct InvalidPhase2AuthMethod(String);

#[derive(Debug, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub enum Phase2AuthMethod {
    PAP,
    CHAP,
    MSCHAP,
    MSCHAPV2,
    GTC,
    OTP,
    MD5,
    TLS,
}

impl FromStr for Phase2AuthMethod {
    type Err = InvalidPhase2AuthMethod;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "pap" => Ok(Self::PAP),
            "chap" => Ok(Self::CHAP),
            "mschap" => Ok(Self::MSCHAP),
            "mschapv2" => Ok(Self::MSCHAPV2),
            "gtc" => Ok(Self::GTC),
            "otp" => Ok(Self::OTP),
            "md5" => Ok(Self::MD5),
            "tls" => Ok(Self::TLS),
            _ => Err(InvalidPhase2AuthMethod(s.to_string())),
        }
    }
}

impl fmt::Display for Phase2AuthMethod {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match self {
            Self::PAP => "pap",
            Self::CHAP => "chap",
            Self::MSCHAP => "mschap",
            Self::MSCHAPV2 => "mschapv2",
            Self::GTC => "gtc",
            Self::OTP => "otp",
            Self::MD5 => "md5",
            Self::TLS => "tls",
        };
        write!(f, "{}", value)
    }
}

#[derive(Debug, Default, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub struct OvsBridgeConfig {
    pub mcast_snooping_enable: Option<bool>,
    pub rstp_enable: Option<bool>,
    pub stp_enable: Option<bool>,
}

#[derive(Debug, Default, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub struct OvsPortConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag: Option<u16>,
}

#[derive(Debug, Error)]
#[error("Invalid OvsInterfaceType: {0}")]
pub struct InvalidOvsInterfaceType(String);

impl FromStr for OvsInterfaceType {
    type Err = InvalidOvsInterfaceType;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "" => Ok(Self::Empty),
            "internal" => Ok(Self::Internal),
            "system" => Ok(Self::System),
            "patch" => Ok(Self::Patch),
            "dpdk" => Ok(Self::Dpdk),
            _ => Err(InvalidOvsInterfaceType(s.to_string())),
        }
    }
}

impl From<InvalidOvsInterfaceType> for zbus::fdo::Error {
    fn from(value: InvalidOvsInterfaceType) -> Self {
        zbus::fdo::Error::Failed(value.to_string())
    }
}

impl fmt::Display for OvsInterfaceType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match self {
            Self::Empty => "",
            Self::Internal => "internal",
            Self::System => "system",
            Self::Patch => "patch",
            Self::Dpdk => "dpdk",
        };
        write!(f, "{}", value)
    }
}
#[derive(Default, Debug, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub enum OvsInterfaceType {
    #[default]
    Empty,
    Internal,
    System,
    Patch,
    Dpdk,
}

#[derive(Debug, Default, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub struct OvsInterfaceConfig {
    pub interface_type: OvsInterfaceType,
}

#[derive(Debug, Default, PartialEq, Clone, Serialize, utoipa::ToSchema)]
pub struct OvsBridgePortConfig {}
