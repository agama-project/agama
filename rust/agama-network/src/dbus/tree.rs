use agama_lib::error::ServiceError;
use parking_lot::Mutex;
use uuid::Uuid;

use crate::{dbus::interfaces, model::*, NetworkSystem};
use std::collections::HashMap;
use std::sync::Arc;

const CONNECTIONS_PATH: &str = "/org/opensuse/Agama/Network1/connections";
const DEVICES_PATH: &str = "/org/opensuse/Agama/Network1/devices";

/// Handle the objects in the D-Bus tree for the network state
pub struct Tree {
    connection: zbus::Connection,
    network: Arc<Mutex<NetworkSystem>>,
    objects: Arc<Mutex<ObjectsRegistry>>,
}

impl Tree {
    /// Creates a new tree handler.
    ///
    /// * `connection`: D-Bus connection to work use.
    /// * `network`: NetworkSystem instance containing the data to export over D-Bus.
    pub fn new(connection: zbus::Connection, network: Arc<Mutex<NetworkSystem>>) -> Self {
        Self {
            connection,
            network,
            objects: Default::default(),
        }
    }

    /// Populate the tree with the network data.
    pub async fn populate(&mut self) -> Result<(), ServiceError> {
        self.add_devices().await?;
        self.add_connections().await?;
        Ok(())
    }

    async fn add_devices(&mut self) -> Result<(), ServiceError> {
        let network = self.network.lock();

        for (i, dev) in network.state.devices.iter().enumerate() {
            let path = format!("{}/{}", DEVICES_PATH, i);
            self.add_interface(&path, interfaces::Device::new(dev.clone()))
                .await?;
            let mut objects = self.objects.lock();
            objects.register_device(&dev.name, &path);
        }

        self.add_interface(
            DEVICES_PATH,
            interfaces::Devices::new(Arc::clone(&self.objects)),
        )
        .await?;

        Ok(())
    }

    async fn add_connections(&self) -> Result<(), ServiceError> {
        let network = self.network.lock();

        for conn in network.state.connections.iter() {
            self.add_connection(conn).await?;
        }

        self.add_interface(
            CONNECTIONS_PATH,
            interfaces::Connections::new(Arc::clone(&self.objects), Arc::clone(&self.network)),
        )
        .await?;

        Ok(())
    }

    pub async fn add_connection(&self, conn: &Connection) -> Result<(), ServiceError> {
        let mut objects = self.objects.lock();

        let path = format!("{}/{}", CONNECTIONS_PATH, objects.connections.len());
        let cloned = Arc::new(Mutex::new(conn.clone()));
        self.add_interface(&path, interfaces::Connection::new(Arc::clone(&cloned)))
            .await?;

        self.add_interface(
            &path,
            interfaces::Ipv4::new(Arc::clone(&self.network), Arc::clone(&cloned)),
        )
        .await?;

        if let Connection::Wireless(_) = conn {
            self.add_interface(
                &path,
                interfaces::Wireless::new(Arc::clone(&self.network), Arc::clone(&cloned)),
            )
            .await?;
        }

        objects.register_connection(conn.uuid(), &path);
        Ok(())
    }

    /// Removes a connection from the tree
    pub async fn remove_connection(&mut self, uuid: Uuid) -> Result<(), ServiceError> {
        let mut objects = self.objects.lock();
        let path = objects.connection_path(uuid).unwrap();
        let object_server = self.connection.object_server();
        _ = object_server.remove::<interfaces::Wireless, _>(path).await;
        object_server.remove::<interfaces::Ipv4, _>(path).await?;
        object_server
            .remove::<interfaces::Connection, _>(path)
            .await?;
        objects.deregister_connection(uuid).unwrap();
        Ok(())
    }

    async fn add_interface<T>(&self, path: &str, iface: T) -> Result<bool, ServiceError>
    where
        T: zbus::Interface,
    {
        let object_server = self.connection.object_server();
        Ok(object_server.at(path.clone(), iface).await?)
    }
}

/// Objects paths for known devices and connections
#[derive(Debug, Default)]
pub struct ObjectsRegistry {
    pub devices: HashMap<String, String>,
    pub connections: HashMap<Uuid, String>,
}

impl ObjectsRegistry {
    /// Registers a network device.
    ///
    /// * `name`: device name.
    /// * `path`: object path.
    pub fn register_device(&mut self, name: &str, path: &str) {
        self.devices.insert(name.to_string(), path.to_string());
    }

    /// Registers a network connection.
    ///
    /// * `uuid`: connection UUID.
    /// * `path`: object path.
    pub fn register_connection(&mut self, uuid: Uuid, path: &str) {
        self.connections.insert(uuid, path.to_string());
    }

    /// Returns the path for a connection.
    ///
    /// * `uuid`: connection UUID.
    pub fn connection_path(&self, uuid: Uuid) -> Option<&str> {
        self.connections.get(&uuid).map(|p| p.as_str())
    }

    /// Deregisters a network connection.
    ///
    /// * `uuid`: connection UUID.
    pub fn deregister_connection(&mut self, uuid: Uuid) -> Option<String> {
        self.connections.remove(&uuid)
    }

    /// Returns all devices paths.
    pub fn devices_paths(&self) -> Vec<String> {
        self.devices.values().map(|p| p.to_string()).collect()
    }

    /// Returns all connection paths.
    pub fn connections_paths(&self) -> Vec<String> {
        self.connections.values().map(|p| p.to_string()).collect()
    }
}
