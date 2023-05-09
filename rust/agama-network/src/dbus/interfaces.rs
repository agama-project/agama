//! Network D-Bus interfaces.
//!
//! This module contains the set of D-Bus interfaces that are exposed by [D-Bus network
//! service](crate::NetworkService).
use super::service::ObjectsPaths;
use crate::{
    error::NetworkStateError,
    model::{Connection as NetworkConnection, Ipv4Config, NetworkState, WirelessConfig},
};
use std::sync::{Arc, Mutex};
use zbus::{dbus_interface, zvariant::ObjectPath};

/// D-Bus interface for the network devices collection
///
/// It offers an API to query the devices collection.
pub struct Devices {
    objects: Arc<Mutex<ObjectsPaths>>,
}

impl Devices {
    /// Creates a Devices interface object.
    ///
    /// * `objects`: Objects paths registry.
    pub fn new(objects: Arc<Mutex<ObjectsPaths>>) -> Self {
        Self { objects }
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Devices")]
impl Devices {
    /// Returns the D-Bus paths of the network devices.
    pub fn get_devices(&self) -> Vec<ObjectPath> {
        let objects = self.objects.lock().unwrap();
        objects
            .devices
            .iter()
            .filter_map(|c| ObjectPath::try_from(c.clone()).ok())
            .collect()
    }
}

/// D-Bus interface for a network device
///
/// It offers an API to query basic networking devices information (e.g., the name).
pub struct Device {
    network: Arc<Mutex<NetworkState>>,
    device_name: String,
}

impl Device {
    /// Creates an interface object.
    ///
    /// * `network`: network state.
    /// * `device_name`: device name.
    pub fn new(network: Arc<Mutex<NetworkState>>, device_name: &str) -> Self {
        Self {
            network,
            device_name: device_name.to_string(),
        }
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Device")]
impl Device {
    #[dbus_interface(property)]
    pub fn name(&self) -> &str {
        &self.device_name
    }

    #[dbus_interface(property)]
    pub fn device_type(&self) -> zbus::fdo::Result<u8> {
        let state = self.network.lock().unwrap();
        let device =
            state
                .get_device(&self.device_name)
                .ok_or(NetworkStateError::UnknownDevice(
                    self.device_name.to_string(),
                ))?;
        Ok(device.ty as u8)
    }
}

/// D-Bus interface for the set of connections.
///
/// It offers an API to query the connections collection.
pub struct Connections {
    objects: Arc<Mutex<ObjectsPaths>>,
}

impl Connections {
    /// Creates a Connections interface object.
    ///
    /// * `objects`: Objects paths registry.
    pub fn new(objects: Arc<Mutex<ObjectsPaths>>) -> Self {
        Self { objects }
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Connections")]
impl Connections {
    /// Returns the D-Bus paths of the network connections.
    pub fn get_connections(&self) -> Vec<ObjectPath> {
        let objects = self.objects.lock().unwrap();
        objects
            .connections
            .iter()
            .filter_map(|c| ObjectPath::try_from(c.clone()).ok())
            .collect()
    }
}

/// D-Bus interface for a network connection
///
/// It offers an API to query a connection.
pub struct Connection {
    conn_name: String,
}

impl Connection {
    /// Creates a Connection interface object.
    ///
    /// * `conn_name`: Connection ID.
    pub fn new(conn_name: &str) -> Self {
        Self {
            conn_name: conn_name.to_string(),
        }
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Connection")]
impl Connection {
    #[dbus_interface(property)]
    pub fn id(&self) -> &str {
        &self.conn_name
    }
}

/// D-Bus interface for IPv4 settings
pub struct Ipv4 {
    network: Arc<Mutex<NetworkState>>,
    conn_name: String,
}

impl Ipv4 {
    /// Creates a Ipv4 interface object.
    ///
    /// * `network`: network state.
    /// * `conn_name`: connection name.
    pub fn new(network: Arc<Mutex<NetworkState>>, conn_name: &str) -> Self {
        Self {
            network,
            conn_name: conn_name.to_string(),
        }
    }

    pub fn with_ipv4<T, F>(&self, func: F) -> zbus::fdo::Result<T>
    where
        F: FnOnce(&Ipv4Config) -> T,
    {
        let state = self.network.lock().unwrap();
        let conn =
            state
                .get_connection(&self.conn_name)
                .ok_or(NetworkStateError::UnknownConnection(
                    self.conn_name.to_string(),
                ))?;
        Ok(func(&conn.ipv4()))
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.IPv4")]
impl Ipv4 {
    #[dbus_interface(property)]
    pub fn addresses(&self) -> zbus::fdo::Result<Vec<(String, u32)>> {
        self.with_ipv4(|ipv4| {
            ipv4.addresses
                .iter()
                .map(|(addr, prefix)| (addr.to_string(), *prefix))
                .collect()
        })
    }

    #[dbus_interface(property)]
    pub fn method(&self) -> zbus::fdo::Result<u8> {
        self.with_ipv4(|ipv4| ipv4.method as u8)
    }

    #[dbus_interface(property)]
    pub fn nameservers(&self) -> zbus::fdo::Result<Vec<String>> {
        self.with_ipv4(|ipv4| ipv4.nameservers.iter().map(|a| a.to_string()).collect())
    }

    #[dbus_interface(property)]
    pub fn gateway(&self) -> zbus::fdo::Result<String> {
        self.with_ipv4(|ipv4| match &ipv4.gateway {
            Some(addr) => addr.to_string(),
            None => "".to_string(),
        })
    }
}
/// D-Bus interface for wireless settings
pub struct Wireless {
    network: Arc<Mutex<NetworkState>>,
    conn_name: String,
}

impl Wireless {
    /// Creates a Wireless interface object.
    ///
    /// * `network`: network state.
    /// * `conn_name`: connection name.
    pub fn new(network: Arc<Mutex<NetworkState>>, conn_name: &str) -> Self {
        Self {
            network,
            conn_name: conn_name.to_string(),
        }
    }

    pub fn with_wireless<T, F>(&self, func: F) -> zbus::fdo::Result<T>
    where
        F: FnOnce(&WirelessConfig) -> T,
    {
        let state = self.network.lock().unwrap();
        let conn =
            state
                .get_connection(&self.conn_name)
                .ok_or(NetworkStateError::UnknownConnection(
                    self.conn_name.to_string(),
                ))?;
        match conn {
            NetworkConnection::Wireless(config) => Ok(func(&config.wireless)),
            _ => Err(NetworkStateError::InvalidConnectionType(self.conn_name.to_string()).into()),
        }
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Wireless")]
impl Wireless {
    #[dbus_interface(property)]
    pub fn ssid(&self) -> zbus::fdo::Result<Vec<u8>> {
        self.with_wireless(|w| w.ssid.clone())
    }

    #[dbus_interface(property)]
    pub fn mode(&self) -> zbus::fdo::Result<u8> {
        self.with_wireless(|w| w.mode as u8)
    }

    #[dbus_interface(property)]
    pub fn password(&self) -> zbus::fdo::Result<String> {
        self.with_wireless(|w| w.password.clone().unwrap_or("".to_string()))
    }

    #[dbus_interface(property)]
    pub fn security(&self) -> zbus::fdo::Result<u8> {
        self.with_wireless(|w| w.security as u8)
    }
}
