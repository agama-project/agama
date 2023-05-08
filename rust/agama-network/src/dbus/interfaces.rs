use crate::{
    error::NetworkStateError,
    model::{Ipv4Config, NetworkState},
};
use std::sync::{Arc, Mutex};
use zbus::dbus_interface;

/// Device D-Bus interface
///
/// It offers an API to query basic networking devices information (e.g., name, whether it is
/// virtual, etc.).
pub struct Device {
    network: Arc<Mutex<NetworkState>>,
    device_name: String,
}

impl Device {
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

pub struct Connection {
    network: Arc<Mutex<NetworkState>>,
    conn_id: String,
}

impl Connection {
    pub fn new(network: Arc<Mutex<NetworkState>>, conn_id: &str) -> Self {
        Self {
            network,
            conn_id: conn_id.to_string(),
        }
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Connection")]
impl Connection {
    #[dbus_interface(property)]
    pub fn id(&self) -> &str {
        &self.conn_id
    }
}

/// D-Bus interface for IPv4 settings
pub struct Ipv4 {
    network: Arc<Mutex<NetworkState>>,
    conn_name: String,
}

impl Ipv4 {
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
}
