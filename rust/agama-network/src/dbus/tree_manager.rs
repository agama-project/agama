use agama_lib::error::ServiceError;
use uuid::Uuid;

use crate::{dbus::interfaces, model::*, NetworkSystem};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Handle the objects in the D-Bus tree for the network state
pub struct TreeManager {
    connection: zbus::Connection,
    network: Arc<Mutex<NetworkSystem>>,
    objects: Arc<Mutex<ObjectsRegistry>>,
}

impl TreeManager {
    pub fn new(connection: zbus::Connection, network: Arc<Mutex<NetworkSystem>>) -> Self {
        Self {
            connection,
            network,
            objects: Default::default(),
        }
    }

    pub async fn populate(&mut self) -> Result<(), ServiceError> {
        self.add_devices().await?;
        self.add_connections().await?;
        Ok(())
    }

    async fn add_devices(&mut self) -> Result<(), ServiceError> {
        let network = self.network.lock().unwrap();

        for (i, dev) in network.state.devices.iter().enumerate() {
            let path = format!("/org/opensuse/Agama/Network1/devices/{}", i);
            self.add_interface(
                &path,
                interfaces::Device::new(Arc::clone(&self.network), &dev.name),
            )
            .await?;
            let mut objects = self.objects.lock().unwrap();
            objects.register_device(&dev.name, &path);
        }

        self.add_interface(
            "/org/opensuse/Agama/Network1/devices",
            interfaces::Devices::new(Arc::clone(&self.objects)),
        )
        .await?;

        Ok(())
    }

    async fn add_connections(&self) -> Result<(), ServiceError> {
        let network = self.network.lock().unwrap();

        for conn in network.state.connections.iter() {
            self.add_connection(conn).await?;
        }

        self.add_interface(
            "/org/opensuse/Agama/Network1/connections",
            interfaces::Connections::new(Arc::clone(&self.objects), Arc::clone(&self.network)),
        )
        .await?;

        Ok(())
    }

    pub async fn add_connection(&self, conn: &Connection) -> Result<(), ServiceError> {
        let mut objects = self.objects.lock().unwrap();

        let path = format!(
            "/org/opensuse/Agama/Network1/connections/{}",
            objects.connections.len()
        );
        self.add_interface(
            &path,
            interfaces::Connection::new(Arc::clone(&self.network), conn.uuid()),
        )
        .await?;

        self.add_interface(
            &path,
            interfaces::Ipv4::new(Arc::clone(&self.network), conn.uuid()),
        )
        .await?;

        if let Connection::Wireless(_) = conn {
            self.add_interface(
                &path,
                interfaces::Wireless::new(Arc::clone(&self.network), conn.uuid()),
            )
            .await?;
        }

        objects.register_connection(conn.uuid(), &path);
        Ok(())
    }

    /// Removes a connection from the tree
    pub async fn remove_connection(&mut self, uuid: Uuid) -> Result<(), ServiceError> {
        let mut objects = self.objects.lock().unwrap();
        let path = objects.connection_path(uuid).unwrap();
        let object_server = self.connection.object_server();
        _ = object_server.remove::<interfaces::Wireless, _>(path).await;
        object_server.remove::<interfaces::Ipv4, _>(path).await?;
        object_server
            .remove::<interfaces::Connection, _>(path)
            .await?;
        objects.unregister_connection(uuid).unwrap();
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
    pub fn register_device(&mut self, name: &str, path: &str) {
        self.devices.insert(name.to_string(), path.to_string());
    }

    pub fn register_connection(&mut self, uuid: Uuid, path: &str) {
        self.connections.insert(uuid, path.to_string());
    }

    pub fn device_path(&self, name: &str) -> Option<&str> {
        self.devices.get(name).map(|p| p.as_str())
    }

    pub fn connection_path(&self, uuid: Uuid) -> Option<&str> {
        self.connections.get(&uuid).map(|p| p.as_str())
    }

    pub fn unregister_device(&mut self, name: &str) -> Option<String> {
        self.devices.remove(name)
    }

    pub fn unregister_connection(&mut self, uuid: Uuid) -> Option<String> {
        self.connections.remove(&uuid)
    }

    pub fn devices_paths(&self) -> Vec<String> {
        self.devices.values().map(|p| p.to_string()).collect()
    }

    pub fn connections_paths(&self) -> Vec<String> {
        self.connections.values().map(|p| p.to_string()).collect()
    }
}
