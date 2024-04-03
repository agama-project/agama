//! Representation of the network configuration
//!
//! * This module contains the types that represent the network concepts. They are supposed to be
//! agnostic from the real network service (e.g., NetworkManager).
use crate::network::error::NetworkStateError;
use agama_lib::network::types::{BondMode, DeviceType, SSID};
use cidr::IpInet;
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

#[derive(Default, Clone, Debug)]
pub struct NetworkState {
    pub devices: Vec<Device>,
    pub connections: Vec<Connection>,
}

impl NetworkState {
    /// Returns a NetworkState struct with the given devices and connections.
    ///
    /// * `devices`: devices to include in the state.
    /// * `connections`: connections to include in the state.
    pub fn new(devices: Vec<Device>, connections: Vec<Connection>) -> Self {
        Self {
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
    pub fn remove_connection(&mut self, uuid: Uuid) -> Result<(), NetworkStateError> {
        let Some(conn) = self.get_connection_by_uuid_mut(uuid) else {
            return Err(NetworkStateError::UnknownConnection(uuid.to_string()));
        };

        conn.remove();
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
        let uuid = conn0.uuid;
        state.add_connection(conn0).unwrap();
        state.remove_connection(uuid).unwrap();
        let found = state.get_connection("eth0").unwrap();
        assert!(found.is_removed());
    }

    #[test]
    fn test_remove_unknown_connection() {
        let mut state = NetworkState::default();
        let error = state.remove_connection(Uuid::new_v4()).unwrap_err();
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

/// Network device
#[derive(Debug, Clone)]
pub struct Device {
    pub name: String,
    pub type_: DeviceType,
}

/// Represents an availble network connection.
#[derive(Debug, Clone, PartialEq)]
pub struct Connection {
    pub id: String,
    pub uuid: Uuid,
    pub mac_address: MacAddress,
    pub ip_config: IpConfig,
    pub status: Status,
    pub interface: Option<String>,
    pub controller: Option<Uuid>,
    pub port_config: PortConfig,
    pub match_config: MatchConfig,
    pub config: ConnectionConfig,
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
            ip_config: Default::default(),
            status: Default::default(),
            interface: Default::default(),
            controller: Default::default(),
            port_config: Default::default(),
            match_config: Default::default(),
            config: Default::default(),
        }
    }
}

#[derive(Default, Debug, PartialEq, Clone)]
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
}

#[derive(Default, Debug, PartialEq, Clone)]
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

#[derive(Debug, Default, Clone, PartialEq)]
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

#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub enum Status {
    #[default]
    Up,
    Down,
    Removed,
}

#[derive(Default, Debug, PartialEq, Clone)]
pub struct IpConfig {
    pub method4: Ipv4Method,
    pub method6: Ipv6Method,
    pub addresses: Vec<IpInet>,
    pub nameservers: Vec<IpAddr>,
    pub gateway4: Option<IpAddr>,
    pub gateway6: Option<IpAddr>,
    pub routes4: Option<Vec<IpRoute>>,
    pub routes6: Option<Vec<IpRoute>>,
}

#[derive(Debug, Default, PartialEq, Clone)]
pub struct MatchConfig {
    pub driver: Vec<String>,
    pub interface: Vec<String>,
    pub path: Vec<String>,
    pub kernel: Vec<String>,
}

#[derive(Debug, Error)]
#[error("Unknown IP configuration method name: {0}")]
pub struct UnknownIpMethod(String);

#[derive(Debug, Default, Copy, Clone, PartialEq)]
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

#[derive(Debug, Default, Copy, Clone, PartialEq)]
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

#[derive(Debug, PartialEq, Clone)]
pub struct IpRoute {
    pub destination: IpInet,
    pub next_hop: Option<IpAddr>,
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

#[derive(Debug, Default, PartialEq, Clone)]
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

#[derive(Debug, Default, PartialEq, Clone)]
pub struct VlanConfig {
    pub parent: String,
    pub id: u32,
    pub protocol: VlanProtocol,
}

#[derive(Debug, Default, PartialEq, Clone)]
pub struct WirelessConfig {
    pub mode: WirelessMode,
    pub ssid: SSID,
    pub password: Option<String>,
    pub security: SecurityProtocol,
    pub band: Option<WirelessBand>,
    pub channel: Option<u32>,
    pub bssid: Option<macaddr::MacAddr6>,
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

#[derive(Debug, Default, Clone, Copy, PartialEq)]
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

#[derive(Debug, Clone, Copy, Default, PartialEq)]
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

#[derive(Debug, Default, PartialEq, Clone)]
pub struct WEPSecurity {
    pub auth_alg: WEPAuthAlg,
    pub wep_key_type: WEPKeyType,
    pub keys: Vec<String>,
    pub wep_key_index: u32,
}

#[derive(Debug, Default, PartialEq, Clone)]
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

#[derive(Debug, Default, PartialEq, Clone)]
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

#[derive(Debug, Clone, Copy, PartialEq)]
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

#[derive(Debug, Default, Clone, PartialEq)]
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

#[derive(Debug, Default, PartialEq, Clone)]
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

#[derive(Debug, Default, PartialEq, Clone)]
pub struct BridgeConfig {
    pub stp: bool,
    pub priority: Option<u32>,
    pub forward_delay: Option<u32>,
    pub hello_time: Option<u32>,
    pub max_age: Option<u32>,
    pub ageing_time: Option<u32>,
}

#[derive(Debug, Default, PartialEq, Clone)]
pub struct BridgePortConfig {
    pub priority: Option<u32>,
    pub path_cost: Option<u32>,
}

#[derive(Default, Debug, PartialEq, Clone)]
pub struct InfinibandConfig {
    pub p_key: Option<i32>,
    pub parent: Option<String>,
    pub transport_mode: InfinibandTransportMode,
}

#[derive(Default, Debug, PartialEq, Clone)]
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
