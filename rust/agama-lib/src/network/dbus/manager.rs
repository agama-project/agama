//! D-Bus interfaces to expose networking settings
use crate::network::NetworkState;
use nmstate;
use std::sync::{Arc, Mutex};
use zbus::dbus_interface;

/// Manager D-Bus interface
///
/// It offers an API to modify general network settings
pub struct Manager {
    network: Arc<Mutex<NetworkState>>,
}

impl Manager {
    pub fn new(network: Arc<Mutex<NetworkState>>) -> Self {
        Self { network }
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Manager")]
impl Manager {
    pub fn apply(&self) -> zbus::fdo::Result<()> {
        let mut net_state = self.network.lock().unwrap();

        net_state.apply().unwrap();
        Ok(())
    }
}
