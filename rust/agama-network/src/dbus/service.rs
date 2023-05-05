use crate::dbus::interfaces;
use crate::model::NetworkState;
use agama_lib::error::ServiceError;
use std::{
    error::Error,
    sync::{Arc, Mutex},
};

/// Represents the Agama networking D-Bus service
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
    /// Returns a new service around the given network configuration
    ///
    /// * `state`: network configuration
    /// * `connection`: D-Bus connection to use (TODO: move this argument to [Self::listen()])
    pub fn new(state: NetworkState, connection: zbus::Connection) -> Self {
        Self {
            state: Arc::new(Mutex::new(state)),
            connection,
        }
    }

    /// Starts listening on the D-Bus connection
    pub async fn listen(&self) -> Result<(), Box<dyn Error>> {
        self.publish_devices().await?;
        self.publish_connections().await?;
        self.connection
            .request_name("org.opensuse.Agama.Network1")
            .await?;
        Ok(())
    }

    // TODO: move this logic to a separate struct that registers all needed interfaces
    async fn publish_devices(&self) -> Result<(), Box<dyn Error>> {
        let state = self.state.lock().unwrap();

        for device in &state.devices {
            let path = format!("/org/opensuse/Agama/Network1/Device/{}", &device.name);
            self.add_interface(&path, &device.name, |s, n| interfaces::Device::new(s, n))
                .await?;
        }

        Ok(())
    }

    // TODO: move this logic to a separate struct that registers all needed interfaces
    async fn publish_connections(&self) -> Result<(), Box<dyn Error>> {
        let state = self.state.lock().unwrap();

        for (i, conn) in state.connections.iter().enumerate() {
            let path = format!("/org/opensuse/Agama/Network1/Connection/{}", i);
            self.add_interface(&path, &conn.name(), |s, n| {
                interfaces::Connection::new(s, n)
            })
            .await?;
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
