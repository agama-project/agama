//! D-Bus interfaces to expose networking settings
use crate::network::NetworkState;
use std::sync::{Arc, Mutex};
use zbus::dbus_interface;

/// Device D-Bus interface
/// virtual, etc.).

/// D-Bus interface for DNS settings
///
/// It offers an API to query basic networking dns information (e.g., nameservers)
pub struct Dns {
    network: Arc<Mutex<NetworkState>>,
}

impl Dns {
    pub fn new(network: Arc<Mutex<NetworkState>>) -> Self {
        Self { network }
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Dns")]
impl Dns {
    #[dbus_interface(property)]
    pub async fn nameservers(&self) -> zbus::fdo::Result<Vec<String>> {
        let state = self.network.lock().unwrap();
        let servers = match &state.dns().config {
            Some(state) => match &state.server {
                Some(servers) => servers.clone(),
                None => vec![],
            },
            None => vec![],
        };

        Ok(servers.clone())
    }

    #[dbus_interface(property)]
    pub async fn set_nameservers(&mut self, nameservers: Vec<String>) -> zbus::fdo::Result<()> {
        let mut state = self.network.lock().unwrap();
        let dns_client_state = state.dns_mut().config.get_or_insert(Default::default());
        dns_client_state.server = Some(nameservers);
        Ok(())
    }

    #[dbus_interface(property)]
    pub async fn search_list(&self) -> zbus::fdo::Result<Vec<String>> {
        let state = self.network.lock().unwrap();
        let servers = match &state.dns().config {
            Some(state) => match &state.search {
                Some(list) => list.clone(),
                None => vec![],
            },
            None => vec![],
        };

        Ok(servers.clone())
    }

    #[dbus_interface(property)]
    pub async fn set_search_list(&mut self, search_list: Vec<String>) -> zbus::fdo::Result<()> {
        let mut state = self.network.lock().unwrap();
        let dns_client_state = state.dns_mut().config.get_or_insert(Default::default());
        dns_client_state.search = Some(search_list);
        Ok(())
    }
}
