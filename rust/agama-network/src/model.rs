//! Representation of the network configuration
//!
//! * This module contains the types that represent the network concepts. They are supposed to be
//! agnostic from the real network service (e.g., NetworkManager).
use crate::nm::NetworkManagerClient;
use std::{error::Error, fmt, net::Ipv4Addr};

#[derive(Debug)]
pub struct NetworkState {
    pub devices: Vec<Device>,
    pub connections: Vec<Connection>,
}

impl NetworkState {
    /// Reads the network configuration using the NetworkManager D-Bus service.
    pub async fn from_system() -> Result<NetworkState, Box<dyn Error>> {
        let nm_client = NetworkManagerClient::from_system().await?;
        let devices = nm_client.devices().await?;
        let connections = nm_client.connections().await?;

        Ok(NetworkState {
            devices,
            connections,
        })
    }

    /// Get device by name
    ///
    /// * `name`: device name
    pub fn get_device(&self, name: &str) -> Option<&Device> {
        self.devices.iter().find(|d| d.name == name)
    }

    /// Get connection by name
    ///
    /// * `name`: connection name
    pub fn get_connection(&self, name: &str) -> Option<&Connection> {
        self.connections.iter().find(|c| c.name() == name)
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

/// Represents an available network connection
#[derive(Debug, PartialEq)]
pub enum Connection {
    Ethernet(EthernetConnection),
    Wireless(WirelessConnection),
}

impl Connection {
    pub fn base(&self) -> &BaseConnection {
        match &self {
            Connection::Ethernet(conn) => &conn.base,
            Connection::Wireless(conn) => &conn.base,
        }
    }

    pub fn name(&self) -> &str {
        self.base().id.as_str()
    }

    pub fn ipv4(&self) -> &Ipv4Config {
        &self.base().ipv4
    }
}

#[derive(Debug, Default, PartialEq)]
pub struct BaseConnection {
    pub id: String,
    pub ipv4: Ipv4Config,
}

#[derive(Debug, Default, PartialEq)]
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

#[derive(Debug, PartialEq)]
pub struct EthernetConnection {
    pub base: BaseConnection,
}

#[derive(Debug, PartialEq)]
pub struct WirelessConnection {
    pub base: BaseConnection,
    pub wireless: WirelessConfig,
}

#[derive(Debug, Default, PartialEq)]
pub struct WirelessConfig {
    pub mode: WirelessMode,
    pub ssid: Vec<u8>,
    pub password: Option<String>,
    pub security: SecurityProtocol,
}

#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub enum WirelessMode {
    Unknown,
    AdHoc,
    #[default]
    Infra,
    AP,
    Mesh,
}

impl fmt::Display for WirelessMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            WirelessMode::Unknown => "unknown",
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
    // No encryption or WEP ("none")
    #[default]
    WEP,
    // Opportunistic Wireless Encryption ("owe")
    OWE,
    // Dynamic WEP ("ieee8021x")
    DynamicWEP,
    // WPA2 + WPA3 personal ("wpa-psk")
    WPA2,
    // WPA3 personal only ("sae")
    WPA3Personal,
    // WPA2 + WPA3 Enterprise ("wpa-eap")
    WPA2Enterprise,
    // "wpa-eap-suite-b192"
    WPA3Only,
}
