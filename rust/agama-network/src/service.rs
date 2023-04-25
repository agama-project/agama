use crate::dbus::dns;
use crate::dbus::interface;
use crate::state::NetworkState;
use agama_lib::error::ServiceError;
use nmstate;
use std::error::Error;
use std::sync::{Arc, Mutex};

/// Represents the Agama networking service
///
/// It is responsible for:
///
/// * Reading the current state.
/// * Publishing the objects in the D-Bus API.
#[derive(Debug)]
pub struct NetworkService {
    state: Arc<Mutex<NetworkState>>,
    connection: zbus::Connection,
}

impl NetworkService {
    pub fn new(state: NetworkState, connection: zbus::Connection) -> Self {
        Self {
            state: Arc::new(Mutex::new(state)),
            connection,
        }
    }

    pub async fn listen(&self) -> Result<(), Box<dyn Error>> {
        self.publish_devices().await?;
        self.connection
            .object_server()
            .at(
                "/org/opensuse/Agama/Network1/Dns",
                dns::Dns::new(Arc::clone(&self.state)),
            )
            .await?;
        self.connection
            .request_name("org.opensuse.Agama.Network1")
            .await?;
        Ok(())
    }

    // TODO: move this logic to a separate struct that registers all needed interfaces
    async fn publish_devices(&self) -> Result<(), Box<dyn Error>> {
        let state = self.state.lock().unwrap();

        for device in state.interfaces() {
            let path = format!("/org/opensuse/Agama/Network1/Device/{}", device.name());
            let name = &device.name();
            match device {
                nmstate::Interface::Ethernet(_) => {
                    self.add_interface(&path, name, |s, n| interface::Device::new(s, n))
                        .await?;
                    self.add_interface(&path, name, |s, n| interface::Ipv4::new(s, n))
                        .await?;
                }
                _ => {
                    eprintln!(
                        "Ignoring interface '{}' (unknown type '{}')",
                        &device.name(),
                        &device.iface_type()
                    );
                }
            }
        }

        Ok(())
    }

    async fn add_interface<F, T>(&self, path: &str, name: &str, f: F) -> Result<bool, ServiceError>
    where
        F: Fn(Arc<Mutex<NetworkState>>, &str) -> T,
        T: zbus::Interface,
    {
        let object_server = self.connection.object_server();
        let iface = f(Arc::clone(&self.state), name);
        Ok(object_server.at(path.clone(), iface).await?)
    }
}
