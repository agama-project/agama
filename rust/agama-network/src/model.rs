//! Representation of the network configuration
//!
//! * This module contains the types that represent the network concepts. They are supposed to be
//! agnostic from the real network service (e.g., NetworkManager).
use uuid::Uuid;

use crate::error::NetworkStateError;
use crate::nm::NetworkManagerClient;
use std::sync::Arc;
use std::{error::Error, fmt, net::Ipv4Addr};

#[derive(Debug, Clone)]
pub enum NetworkEvent {
    AddConnection(Connection),
    RemoveConnection(Uuid),
}

pub type NetworkEventCallback = dyn Fn(NetworkEvent) + Send + Sync;

#[derive(Default)]
pub struct NetworkState {
    pub devices: Vec<Device>,
    pub connections: Vec<Connection>,
    pub callbacks: Vec<Arc<NetworkEventCallback>>,
}

impl NetworkState {
    pub fn on_event(&mut self, callback: Arc<NetworkEventCallback>) {
        self.callbacks.push(callback);
    }
    /// Reads the network configuration using the NetworkManager D-Bus service.
    pub async fn from_system() -> Result<NetworkState, Box<dyn Error>> {
        let nm_client = NetworkManagerClient::from_system().await?;
        let devices = nm_client.devices().await?;
        let connections = nm_client.connections().await?;

        Ok(NetworkState {
            devices,
            connections,
            callbacks: vec![],
        })
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
    pub fn get_connection(&self, uuid: Uuid) -> Option<&Connection> {
        self.connections.iter().find(|c| c.uuid() == uuid)
    }

    /// Get connection by UUID as mutable
    ///
    /// * `uuid`: connection UUID
    pub fn get_connection_mut(&mut self, uuid: Uuid) -> Option<&mut Connection> {
        self.connections.iter_mut().find(|c| c.uuid() == uuid)
    }

    /// Adds a new connection.
    ///
    /// It uses the `id` to decide whether the connection already exists.
    /// TODO: use the UUID, so it is possible to rename connections.
    pub fn add_connection(&mut self, conn: Connection) -> Result<(), NetworkStateError> {
        if let Some(_) = self.get_connection(conn.uuid()) {
            return Err(NetworkStateError::ConnectionExists(conn.uuid()));
        }

        let event = NetworkEvent::AddConnection(conn.clone());
        self.notify_event(event);
        self.connections.push(conn);
        Ok(())
    }

    /// Updates a connection with a new one.
    ///
    /// It uses the `id` to decide which connection to update.
    /// TODO: use the UUID, so it is possible to rename connections.
    ///
    /// Additionally, it registers the connection to be removed when the changes are applied.
    pub fn update_connection(&mut self, conn: Connection) -> Result<(), NetworkStateError> {
        let Some(old_conn) = self.get_connection_mut(conn.uuid()) else {
            return Err(NetworkStateError::UnknownConnection(conn.uuid()));
        };

        *old_conn = conn;
        Ok(())
    }

    /// Removes a connection from the state.
    ///
    /// TODO: use the UUID.
    /// Additionally, it registers the connection to be removed when the changes are applied.
    pub fn remove_connection(&mut self, uuid: Uuid) -> Result<(), NetworkStateError> {
        let Some(index) = self.connections.iter().position(|i| i.uuid() == uuid) else {
            return Err(NetworkStateError::UnknownConnection(uuid));
        };

        self.notify_event(NetworkEvent::RemoveConnection(uuid));
        self.connections.swap_remove(index);
        Ok(())
    }

    fn notify_event(&self, event: NetworkEvent) {
        for cb in &self.callbacks {
            cb(event.clone())
        }
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::{BaseConnection, Connection, EthernetConnection, NetworkState};
    use crate::error::NetworkStateError;

    #[test]
    fn test_add_connection() {
        let mut state = NetworkState::default();
        let uuid = Uuid::new_v4();
        let base = BaseConnection {
            uuid,
            ..Default::default()
        };
        let conn0 = Connection::Ethernet(EthernetConnection { base });
        state.add_connection(conn0).unwrap();
        let found = state.get_connection(uuid).unwrap();
        assert_eq!(found.uuid(), uuid);
    }

    #[test]
    fn test_add_duplicated_connection() {
        let mut state = NetworkState::default();
        let uuid = Uuid::new_v4();
        let base = BaseConnection {
            uuid,
            ..Default::default()
        };
        let conn0 = Connection::Ethernet(EthernetConnection { base });
        state.add_connection(conn0.clone()).unwrap();
        let error = state.add_connection(conn0).unwrap_err();
        assert!(matches!(error, NetworkStateError::ConnectionExists(_)));
    }

    #[test]
    fn test_update_connection() {
        let mut state = NetworkState::default();
        let uuid = Uuid::new_v4();
        let base0 = BaseConnection {
            uuid: Uuid::new_v4(),
            ..Default::default()
        };
        let conn0 = Connection::Ethernet(EthernetConnection { base: base0 });
        state.add_connection(conn0).unwrap();

        let base1 = BaseConnection {
            uuid: Uuid::new_v4(),
            ..Default::default()
        };
        let conn2 = Connection::Ethernet(EthernetConnection { base: base1 });
        state.update_connection(conn2).unwrap();
        let found = state.get_connection(uuid).unwrap();
        assert_eq!(found.uuid(), uuid);
    }

    #[test]
    fn test_update_unknown_connection() {
        let mut state = NetworkState::default();
        let uuid = Uuid::new_v4();
        let base = BaseConnection {
            uuid,
            ..Default::default()
        };
        let conn0 = Connection::Ethernet(EthernetConnection { base });
        let error = state.update_connection(conn0).unwrap_err();
        assert!(matches!(error, NetworkStateError::UnknownConnection(_)));
    }

    #[test]
    fn test_remove_connection() {
        let mut state = NetworkState::default();
        let uuid = Uuid::new_v4();
        let base0 = BaseConnection {
            uuid: Uuid::new_v4(),
            ..Default::default()
        };
        let conn0 = Connection::Ethernet(EthernetConnection { base: base0 });
        state.add_connection(conn0).unwrap();
        state.remove_connection(uuid).unwrap();
        assert!(state.get_connection(uuid).is_none());
    }

    #[test]
    fn test_remove_unknown_connection() {
        let mut state = NetworkState::default();
        let error = state.remove_connection(Uuid::new_v4()).unwrap_err();
        assert!(matches!(error, NetworkStateError::UnknownConnection(_)));
    }
}

/// Network device
#[derive(Debug)]
pub struct Device {
    pub name: String,
    pub ty: DeviceType,
}

#[derive(Debug, PartialEq, Copy, Clone)]
pub enum DeviceType {
    Ethernet = 1,
    Wireless = 2,
    Unknown = 3,
}

impl TryFrom<u8> for DeviceType {
    type Error = NetworkStateError;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(DeviceType::Ethernet),
            1 => Ok(DeviceType::Wireless),
            2 => Ok(DeviceType::Unknown),
            _ => Err(NetworkStateError::InvalidDeviceType(value)),
        }
    }
}

/// Represents an available network connection
#[derive(Debug, PartialEq, Clone)]
pub enum Connection {
    Ethernet(EthernetConnection),
    Wireless(WirelessConnection),
}

impl Connection {
    pub fn new(id: String, device_type: DeviceType) -> Self {
        let base = BaseConnection {
            id: id.to_string(),
            ..Default::default()
        };
        match device_type {
            DeviceType::Wireless => Connection::Wireless(WirelessConnection {
                base,
                ..Default::default()
            }),
            _ => Connection::Ethernet(EthernetConnection { base }),
        }
    }

    pub fn base(&self) -> &BaseConnection {
        match &self {
            Connection::Ethernet(conn) => &conn.base,
            Connection::Wireless(conn) => &conn.base,
        }
    }

    pub fn base_mut(&mut self) -> &mut BaseConnection {
        match self {
            Connection::Ethernet(conn) => &mut conn.base,
            Connection::Wireless(conn) => &mut conn.base,
        }
    }

    pub fn id(&self) -> &str {
        self.base().id.as_str()
    }

    pub fn uuid(&self) -> Uuid {
        self.base().uuid
    }

    pub fn ipv4(&self) -> &Ipv4Config {
        &self.base().ipv4
    }

    pub fn ipv4_mut(&mut self) -> &mut Ipv4Config {
        &mut self.base_mut().ipv4
    }
}

#[derive(Debug, Default, PartialEq, Clone)]
pub struct BaseConnection {
    pub id: String,
    pub uuid: Uuid,
    pub ipv4: Ipv4Config,
}

#[derive(Debug, Default, PartialEq, Clone)]
pub struct Ipv4Config {
    pub method: IpMethod,
    pub addresses: Vec<(Ipv4Addr, u32)>,
    pub nameservers: Vec<Ipv4Addr>,
    pub gateway: Option<Ipv4Addr>,
}

#[derive(Debug, Default, Copy, Clone, PartialEq)]
pub enum IpMethod {
    #[default]
    Auto = 0,
    Manual = 1,
    Unknown = 2,
}
impl fmt::Display for IpMethod {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            IpMethod::Auto => "auto",
            IpMethod::Manual => "manual",
            IpMethod::Unknown => "auto",
        };
        write!(f, "{}", name)
    }
}

// NOTE: we could use num-derive.
impl TryFrom<u8> for IpMethod {
    type Error = NetworkStateError;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(IpMethod::Auto),
            1 => Ok(IpMethod::Manual),
            2 => Ok(IpMethod::Unknown),
            _ => Err(NetworkStateError::InvalidIpMethod(value)),
        }
    }
}

#[derive(Debug, Default, PartialEq, Clone)]
pub struct EthernetConnection {
    pub base: BaseConnection,
}

#[derive(Debug, Default, PartialEq, Clone)]
pub struct WirelessConnection {
    pub base: BaseConnection,
    pub wireless: WirelessConfig,
}

#[derive(Debug, Default, PartialEq, Clone)]
pub struct WirelessConfig {
    pub mode: WirelessMode,
    pub ssid: Vec<u8>,
    pub password: Option<String>,
    pub security: SecurityProtocol,
}

#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub enum WirelessMode {
    #[default]
    Infra = 0,
    AdHoc = 1,
    Mesh = 2,
    AP = 3,
    Other = 4,
}

impl TryFrom<u8> for WirelessMode {
    type Error = NetworkStateError;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            1 => Ok(WirelessMode::AdHoc),
            2 => Ok(WirelessMode::Infra),
            3 => Ok(WirelessMode::AP),
            4 => Ok(WirelessMode::Mesh),
            _ => Err(NetworkStateError::InvalidWirelessMode(value)),
        }
    }
}

impl fmt::Display for WirelessMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            WirelessMode::Other => "unknown",
            WirelessMode::AdHoc => "adhoc",
            WirelessMode::Infra => "infra",
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
