//! Network data model

use crate::nm::{
    NetworkManagerClient, NmConnection, NmDevice, NmDeviceType, NmIp4Config, NmMethod,
};
use std::{error::Error, net::Ipv4Addr};

pub async fn read_network_state() -> Result<NetworkState, Box<dyn Error>> {
    let nm_client = NetworkManagerClient::from_system().await?;

    let nm_devices = nm_client.devices().await?;
    let devices: Vec<Device> = nm_devices.into_iter().map(|d| d.into()).collect();

    let nm_conns = nm_client.connections().await?;
    let connections: Vec<Connection> = nm_conns.into_iter().map(|d| d.into()).collect();

    Ok(NetworkState {
        devices,
        connections,
    })
}

#[derive(Debug)]
pub struct NetworkState {
    pub devices: Vec<Device>,
    pub connections: Vec<Connection>,
}

impl NetworkState {
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

impl From<NmDevice> for Device {
    fn from(value: NmDevice) -> Self {
        Self {
            name: value.iface,
            ty: value.device_type.into(),
        }
    }
}

#[cfg(test)]
mod test {
    use super::{Device, DeviceType};
    use crate::nm::{NmDevice, NmDeviceType};

    #[test]
    fn test_from_nm_device() {
        let nm_device = NmDevice {
            iface: "eth0".to_string(),
            device_type: NmDeviceType(2),
            ..Default::default()
        };

        let device: Device = nm_device.into();
        assert_eq!(device.name.as_str(), "eth0");
        assert_eq!(device.ty, DeviceType::Wireless);
    }
}

#[derive(Debug, PartialEq, Copy, Clone)]
pub enum DeviceType {
    Ethernet = 1,
    Wireless = 2,
    Unknown = 3,
}

impl From<NmDeviceType> for DeviceType {
    fn from(value: NmDeviceType) -> Self {
        match value {
            NmDeviceType(1) => DeviceType::Ethernet,
            NmDeviceType(2) => DeviceType::Wireless,
            _ => DeviceType::Unknown,
        }
    }
}

/// Represents an available network connection
#[derive(Debug)]
pub enum Connection {
    Ethernet(EthernetConnection),
}

impl Connection {
    pub fn base(&self) -> &BaseConnection {
        match &self {
            Connection::Ethernet(conn) => &conn.base,
        }
    }

    pub fn name(&self) -> &str {
        self.base().id.as_str()
    }

    pub fn ipv4(&self) -> &Ipv4Config {
        &self.base().ipv4
    }
}

impl From<NmConnection> for Connection {
    fn from(value: NmConnection) -> Self {
        let mut base = BaseConnection {
            id: value.id,
            ..Default::default()
        };

        if let Some(nm_ipv4) = value.ipv4 {
            base.ipv4 = nm_ipv4.into();
        }

        Connection::Ethernet(EthernetConnection { base })
    }
}

#[derive(Debug, Default)]
pub struct BaseConnection {
    id: String,
    ipv4: Ipv4Config,
}

#[derive(Debug, Default, PartialEq)]
pub struct Ipv4Config {
    pub method: IpMethod,
    pub addresses: Vec<(Ipv4Addr, u32)>,
    pub nameservers: Vec<Ipv4Addr>,
    pub gateway: Option<Ipv4Addr>,
}

impl From<NmIp4Config> for Ipv4Config {
    fn from(value: NmIp4Config) -> Self {
        let addresses: Vec<(Ipv4Addr, u32)> = value
            .addresses
            .into_iter()
            .filter_map(|(addr, prefix)| addr.parse().ok().map(|i| (i, prefix)))
            .collect();

        let nameservers = value
            .nameservers
            .into_iter()
            .filter_map(|ns| ns.parse().ok())
            .collect();

        let gateway = value.gateway.map(|g| g.parse::<Ipv4Addr>().unwrap());

        Ipv4Config {
            method: value.method.into(),
            addresses,
            nameservers,
            gateway,
            ..Default::default()
        }
    }
}

#[derive(Debug, Default, Copy, Clone, PartialEq)]
pub enum IpMethod {
    #[default]
    Auto = 0,
    Manual = 1,
    Unknown = 2,
}

impl From<NmMethod> for IpMethod {
    fn from(value: NmMethod) -> Self {
        match value.as_str() {
            "auto" => IpMethod::Auto,
            "manual" => IpMethod::Manual,
            _ => IpMethod::Unknown,
        }
    }
}

#[derive(Debug)]
pub struct EthernetConnection {
    base: BaseConnection,
}
