use crate::{error::NetworkStateError, model::NetworkState};
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
