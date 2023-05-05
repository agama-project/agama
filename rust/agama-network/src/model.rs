//! Network data model

use crate::nm::{NetworkManagerClient, NmConnection, NmDevice, NmDeviceType};
use std::error::Error;

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
}

impl From<NmConnection> for Connection {
    fn from(value: NmConnection) -> Self {
        let base = BaseConnection { id: value.id };
        Connection::Ethernet(EthernetConnection { base })
    }
}

#[derive(Debug)]
pub struct BaseConnection {
    id: String,
}

#[derive(Debug)]
pub struct EthernetConnection {
    base: BaseConnection,
}
