//! Representation of the network configuration
//!
//! * This module contains the types that represent the network concepts. They are supposed to be
//! agnostic from the real network service (e.g., NetworkManager).
use crate::network::error::NetworkStateError;
use agama_lib::network::settings::{
    BondSettings, IEEE8021XSettings, NetworkConnection, WirelessSettings,
};
use agama_lib::network::types::{BondMode, DeviceState, DeviceType, Status, SSID};
use cidr::IpInet;
use serde::{Deserialize, Serialize};
use serde_with::{serde_as, skip_serializing_none, DisplayFromStr};
use std::{
    collections::HashMap,
    default::Default,
    fmt,
    net::IpAddr,
    str::{self, FromStr},
};
use thiserror::Error;
use uuid::Uuid;
use zbus::zvariant::Value;

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
        if let ConnectionConfig::Bond(_) = &controller.config {
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
                } else if conn.controller == Some(controller.uuid) {
                    conn.controller = None;
                }
            }
            Ok(())
        } else {
            Err(NetworkStateError::NotControllerConnection(
                controller.id.to_owned(),
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::network::error::NetworkStateError;
    use uuid::Uuid;

    #[test]
    fn test_macaddress() {
        let mut val: Option<String> = None;
        assert!(matches!(
            MacAddress::try_from(&val).unwrap(),
            MacAddress::Unset
        ));

        val = Some(String::from(""));
        assert!(matches!(
            MacAddress::try_from(&val).unwrap(),
            MacAddress::Unset
        ));

        val = Some(String::from("preserve"));
        assert!(matches!(
            MacAddress::try_from(&val).unwrap(),
            MacAddress::Preserve
        ));

        val = Some(String::from("permanent"));
        assert!(matches!(
            MacAddress::try_from(&val).unwrap(),
            MacAddress::Permanent
        ));

        val = Some(String::from("random"));
        assert!(matches!(
            MacAddress::try_from(&val).unwrap(),
            MacAddress::Random
        ));

        val = Some(String::from("stable"));
        assert!(matches!(
            MacAddress::try_from(&val).unwrap(),
            MacAddress::Stable
        ));

        val = Some(String::from("This is not a MACAddr"));
        assert!(matches!(
            MacAddress::try_from(&val),
            Err(InvalidMacAddress(_))
        ));

        val = Some(String::from("de:ad:be:ef:2b:ad"));
        assert_eq!(
            MacAddress::try_from(&val).unwrap().to_string(),
            String::from("de:ad:be:ef:2b:ad").to_uppercase()
        );
    }

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

/// Network state
#[serde_as]
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct GeneralState {
    pub hostname: String,
    pub connectivity: bool,
    pub wireless_enabled: bool,
    pub networking_enabled: bool, // pub network_state: NMSTATE
}

/// Access Point
#[serde_as]
#[derive(Default, Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AccessPoint {
    #[serde_as(as = "DisplayFromStr")]
    pub ssid: SSID,
    pub hw_address: String,
    pub strength: u8,
    pub flags: u32,
    pub rsn_flags: u32,
    pub wpa_flags: u32,
}

/// Network device
#[serde_as]
#[skip_serializing_none]
#[derive(Default, Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: DeviceType,
    #[serde_as(as = "DisplayFromStr")]
    pub mac_address: MacAddress,
    pub ip_config: Option<IpConfig>,
    // Connection.id
    pub connection: Option<String>,
    pub state: DeviceState,
    pub state_reason: u8,
}

/// Represents a known network connection.
#[serde_as]
#[skip_serializing_none]
#[derive(Debug, Clone, PartialEq, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub id: String,
    pub uuid: Uuid,
    #[serde_as(as = "DisplayFromStr")]
    pub mac_address: MacAddress,
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

    pub fn set_up(&mut self) {
        self.status = Status::Up
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

        if let Some(ignore_auto_dns) = conn.ignore_auto_dns {
            connection.ip_config.ignore_auto_dns = ignore_auto_dns;
        }

        if let Some(wireless_config) = conn.wireless {
            let config = WirelessConfig::try_from(wireless_config)?;
            connection.config = config.into();
        }

        if let Some(bond_config) = conn.bond {
            let config = BondConfig::try_from(bond_config)?;
            connection.config = config.into();
        }

        if let Some(ieee_8021x_config) = conn.ieee_8021x {
            connection.ieee_8021x_config = Some(IEEE8021XConfig::try_from(ieee_8021x_config)?);
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
        let mac = conn.mac_address.to_string();
        let method4 = Some(conn.ip_config.method4.to_string());
        let method6 = Some(conn.ip_config.method6.to_string());
        let mac_address = (!mac.is_empty()).then_some(mac);
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
            mac_address,
            interface,
            addresses,
            mtu,
            ieee_8021x,
            ..Default::default()
        };

        match conn.config {
            ConnectionConfig::Wireless(config) => {
                connection.wireless = Some(WirelessSettings::try_from(config)?);
            }
            ConnectionConfig::Bond(config) => {
                connection.bond = Some(BondSettings::try_from(config)?);
            }
            _ => {}
        }

        Ok(connection)
    }
}

#[derive(Default, Debug, PartialEq, Clone, Serialize)]
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
}

#[derive(Default, Debug, PartialEq, Clone, Serialize)]
pub enum PortConfig {
    #[default]
    None,
    Bridge(BridgePortConfig),
}

impl From<BondConfig> for ConnectionConfig {
    fn from(value: BondConfig) -> Self {
        Self::Bond(value)
    }
}

impl From<WirelessConfig> for ConnectionConfig {
    fn from(value: WirelessConfig) -> Self {
        Self::Wireless(value)
    }
}

#[derive(Debug, Error)]
#[error("Invalid MAC address: {0}")]
pub struct InvalidMacAddress(String);

#[derive(Debug, Default, Clone, PartialEq, Serialize)]
pub enum MacAddress {
    MacAddress(macaddr::MacAddr6),
    Preserve,
    Permanent,
    Random,
    Stable,
    #[default]
    Unset,
}

impl FromStr for MacAddress {
    type Err = InvalidMacAddress;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "preserve" => Ok(Self::Preserve),
            "permanent" => Ok(Self::Permanent),
            "random" => Ok(Self::Random),
            "stable" => Ok(Self::Stable),
            "" => Ok(Self::Unset),
            _ => Ok(Self::MacAddress(match macaddr::MacAddr6::from_str(s) {
                Ok(mac) => mac,
                Err(e) => return Err(InvalidMacAddress(e.to_string())),
            })),
        }
    }
}

impl TryFrom<&Option<String>> for MacAddress {
    type Error = InvalidMacAddress;

    fn try_from(value: &Option<String>) -> Result<Self, Self::Error> {
        match &value {
            Some(str) => MacAddress::from_str(str),
            None => Ok(Self::Unset),
        }
    }
}

impl fmt::Display for MacAddress {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let output = match &self {
            Self::MacAddress(mac) => mac.to_string(),
            Self::Preserve => "preserve".to_string(),
            Self::Permanent => "permanent".to_string(),
            Self::Random => "random".to_string(),
            Self::Stable => "stable".to_string(),
            Self::Unset => "".to_string(),
        };
        write!(f, "{}", output)
    }
}

impl From<InvalidMacAddress> for zbus::fdo::Error {
    fn from(value: InvalidMacAddress) -> Self {
        zbus::fdo::Error::Failed(value.to_string())
    }
}

#[skip_serializing_none]
#[derive(Default, Debug, PartialEq, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IpConfig {
    pub method4: Ipv4Method,
    pub method6: Ipv6Method,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub addresses: Vec<IpInet>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub nameservers: Vec<IpAddr>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub dns_searchlist: Vec<String>,
    pub ignore_auto_dns: bool,
    pub gateway4: Option<IpAddr>,
    pub gateway6: Option<IpAddr>,
    pub routes4: Option<Vec<IpRoute>>,
    pub routes6: Option<Vec<IpRoute>>,
}

#[skip_serializing_none]
#[derive(Debug, Default, PartialEq, Clone, Serialize)]
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

#[derive(Debug, Error)]
#[error("Unknown IP configuration method name: {0}")]
pub struct UnknownIpMethod(String);

#[derive(Debug, Default, Copy, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Ipv4Method {
    #[default]
    Disabled = 0,
    Auto = 1,
    Manual = 2,
    LinkLocal = 3,
}

impl fmt::Display for Ipv4Method {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            Ipv4Method::Disabled => "disabled",
            Ipv4Method::Auto => "auto",
            Ipv4Method::Manual => "manual",
            Ipv4Method::LinkLocal => "link-local",
        };
        write!(f, "{}", name)
    }
}

impl FromStr for Ipv4Method {
    type Err = UnknownIpMethod;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "disabled" => Ok(Ipv4Method::Disabled),
            "auto" => Ok(Ipv4Method::Auto),
            "manual" => Ok(Ipv4Method::Manual),
            "link-local" => Ok(Ipv4Method::LinkLocal),
            _ => Err(UnknownIpMethod(s.to_string())),
        }
    }
}

#[derive(Debug, Default, Copy, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Ipv6Method {
    #[default]
    Disabled = 0,
    Auto = 1,
    Manual = 2,
    LinkLocal = 3,
    Ignore = 4,
    Dhcp = 5,
}

impl fmt::Display for Ipv6Method {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            Ipv6Method::Disabled => "disabled",
            Ipv6Method::Auto => "auto",
            Ipv6Method::Manual => "manual",
            Ipv6Method::LinkLocal => "link-local",
            Ipv6Method::Ignore => "ignore",
            Ipv6Method::Dhcp => "dhcp",
        };
        write!(f, "{}", name)
    }
}

impl FromStr for Ipv6Method {
    type Err = UnknownIpMethod;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "disabled" => Ok(Ipv6Method::Disabled),
            "auto" => Ok(Ipv6Method::Auto),
            "manual" => Ok(Ipv6Method::Manual),
            "link-local" => Ok(Ipv6Method::LinkLocal),
            "ignore" => Ok(Ipv6Method::Ignore),
            "dhcp" => Ok(Ipv6Method::Dhcp),
            _ => Err(UnknownIpMethod(s.to_string())),
        }
    }
}

impl From<UnknownIpMethod> for zbus::fdo::Error {
    fn from(value: UnknownIpMethod) -> zbus::fdo::Error {
        zbus::fdo::Error::Failed(value.to_string())
    }
}

#[derive(Debug, PartialEq, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IpRoute {
    pub destination: IpInet,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_hop: Option<IpAddr>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metric: Option<u32>,
}

impl From<&IpRoute> for HashMap<&str, Value<'_>> {
    fn from(route: &IpRoute) -> Self {
        let mut map: HashMap<&str, Value> = HashMap::from([
            ("dest", Value::new(route.destination.address().to_string())),
            (
                "prefix",
                Value::new(route.destination.network_length() as u32),
            ),
        ]);
        if let Some(next_hop) = route.next_hop {
            map.insert("next-hop", Value::new(next_hop.to_string()));
        }
        if let Some(metric) = route.metric {
            map.insert("metric", Value::new(metric));
        }
        map
    }
}

#[derive(Debug, Default, PartialEq, Clone, Serialize)]
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

#[derive(Debug, Default, PartialEq, Clone, Serialize)]
pub struct VlanConfig {
    pub parent: String,
    pub id: u32,
    pub protocol: VlanProtocol,
}

#[serde_as]
#[derive(Debug, Default, PartialEq, Clone, Serialize)]
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bssid: Option<macaddr::MacAddr6>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wep_security: Option<WEPSecurity>,
    pub hidden: bool,
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

impl TryFrom<WirelessSettings> for WirelessConfig {
    type Error = NetworkStateError;

    fn try_from(settings: WirelessSettings) -> Result<Self, Self::Error> {
        let ssid = SSID(settings.ssid.as_bytes().into());
        let mode = WirelessMode::try_from(settings.mode.as_str())?;
        let security = SecurityProtocol::try_from(settings.security.as_str())?;
        Ok(WirelessConfig {
            ssid,
            mode,
            security,
            password: settings.password,
            ..Default::default()
        })
    }
}

impl TryFrom<WirelessConfig> for WirelessSettings {
    type Error = NetworkStateError;

    fn try_from(wireless: WirelessConfig) -> Result<Self, Self::Error> {
        Ok(WirelessSettings {
            ssid: wireless.ssid.to_string(),
            mode: wireless.mode.to_string(),
            security: wireless.security.to_string(),
            password: wireless.password,
        })
    }
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize)]
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

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize)]
pub enum SecurityProtocol {
    #[default]
    WEP, // No encryption or WEP ("none")
    OWE,            // Opportunistic Wireless Encryption ("owe")
    DynamicWEP,     // Dynamic WEP ("ieee8021x")
    WPA2,           // WPA2 + WPA3 personal ("wpa-psk")
    WPA3Personal,   // WPA3 personal only ("sae")
    WPA2Enterprise, // WPA2 + WPA3 Enterprise ("wpa-eap")
    WPA3Only,       // WPA3 only ("wpa-eap-suite-b192")
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
            SecurityProtocol::WPA3Only => "wpa-eap-suite-b192",
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
            "wpa-eap-suite-b192" => Ok(SecurityProtocol::WPA3Only),
            _ => Err(NetworkStateError::InvalidSecurityProtocol(
                value.to_string(),
            )),
        }
    }
}

#[derive(Debug, Default, PartialEq, Clone, Serialize)]
pub struct WEPSecurity {
    pub auth_alg: WEPAuthAlg,
    pub wep_key_type: WEPKeyType,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub keys: Vec<String>,
    pub wep_key_index: u32,
}

#[derive(Debug, Default, PartialEq, Clone, Serialize)]
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

#[derive(Debug, Default, PartialEq, Clone, Serialize)]
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

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
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
    type Error = anyhow::Error;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "a" => Ok(WirelessBand::A),
            "bg" => Ok(WirelessBand::BG),
            _ => Err(anyhow::anyhow!("Invalid band: {}", value)),
        }
    }
}

#[derive(Debug, Default, Clone, PartialEq, Serialize)]
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

#[derive(Debug, Default, PartialEq, Clone, Serialize)]
pub struct BondConfig {
    pub mode: BondMode,
    pub options: BondOptions,
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

#[derive(Debug, Default, PartialEq, Clone, Serialize)]
pub struct BridgeConfig {
    pub stp: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub forward_delay: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hello_time: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_age: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ageing_time: Option<u32>,
}

#[derive(Debug, Default, PartialEq, Clone, Serialize)]
pub struct BridgePortConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path_cost: Option<u32>,
}

#[derive(Default, Debug, PartialEq, Clone, Serialize)]
pub struct InfinibandConfig {
    pub p_key: Option<i32>,
    pub parent: Option<String>,
    pub transport_mode: InfinibandTransportMode,
}

#[derive(Default, Debug, PartialEq, Clone, Serialize)]
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

#[derive(Default, Debug, PartialEq, Clone, Serialize)]
pub enum TunMode {
    #[default]
    Tun = 1,
    Tap = 2,
}

#[derive(Default, Debug, PartialEq, Clone, Serialize)]
pub struct TunConfig {
    pub mode: TunMode,
    pub group: Option<String>,
    pub owner: Option<String>,
}

/// Represents a network change.
#[derive(Debug, Clone, Serialize)]
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
}

#[derive(Default, Debug, PartialEq, Clone, Serialize)]
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

#[derive(Debug, PartialEq, Clone, Serialize)]
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

#[derive(Debug, PartialEq, Clone, Serialize)]
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
