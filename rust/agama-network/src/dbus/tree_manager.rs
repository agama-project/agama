use agama_lib::error::ServiceError;

use crate::{dbus::interfaces, model::*, NetworkState};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Objects paths for known devices and connections
#[derive(Debug, Default)]
pub struct ObjectsPaths {
    pub devices: HashMap<String, String>,
    pub connections: HashMap<String, String>,
}

impl ObjectsPaths {
    pub fn add_device(&mut self, name: &str, path: &str) {
        self.devices.insert(name.to_string(), path.to_string());
    }

    pub fn add_connection(&mut self, name: &str, path: &str) {
        self.connections.insert(name.to_string(), path.to_string());
    }

    pub fn device_path(&self, name: &str) -> Option<&str> {
        self.devices.get(name).map(|p| p.as_str())
    }

    pub fn connection_path(&self, name: &str) -> Option<&str> {
        self.connections.get(name).map(|p| p.as_str())
    }

    pub fn remove_device(&self, name: &str) -> Option<String> {
        self.devices.remove(name)
    }

    pub fn remove_connection(&self, name: &str) -> Option<String> {
        self.connections.remove(name)
    }

    pub fn devices_paths(&self) -> Vec<String> {
        self.devices.keys().map(|p| p.to_string()).collect()
    }

    pub fn connections_paths(&self) -> Vec<String> {
        self.connections.keys().map(|p| p.to_string()).collect()
    }
}

/// Handle the objects in the D-Bus tree for the network state
#[derive(Debug)]
pub struct TreeManager {
    connection: zbus::Connection,
    network: Arc<Mutex<NetworkState>>,
    objects: ObjectsPaths,
}

impl TreeManager {
    pub fn new(connection: zbus::Connection, network: Arc<Mutex<NetworkState>>) -> Self {
        Self {
            connection,
            network,
            objects: Default::default(),
        }
    }

    pub async fn publish(&mut self) -> Result<(), ServiceError> {
        self.publish_devices().await?;
        self.publish_connections().await?;
        Ok(())
    }

    async fn publish_devices(&mut self) -> Result<(), ServiceError> {
        let state = self.network.lock().unwrap();

        for (i, dev) in state.devices.iter().enumerate() {
            let path = format!("/org/opensuse/Agama/Network1/devices/{}", i);
            self.add_interface(
                &path,
                interfaces::Device::new(Arc::clone(&self.network), &dev.name),
            )
            .await?;
            self.objects.devices.push(path);
        }

        self.add_interface(
            "/org/opensuse/Agama/Network1/devices",
            interfaces::Devices::new(Arc::clone(&self.objects)),
        )
        .await?;

        Ok(())
    }

    async fn publish_connections(&mut self) -> Result<(), ServiceError> {
        let state = self.network.lock().unwrap();

        for (i, conn) in state.connections.iter().enumerate() {
            let path = format!("/org/opensuse/Agama/Network1/connections/{}", i);
            self.add_interface(
                &path,
                interfaces::Connection::new(Arc::clone(&self.network), conn.name()),
            )
            .await?;

            self.add_interface(
                &path,
                interfaces::Ipv4::new(Arc::clone(&self.network), conn.name()),
            )
            .await?;

            if let Connection::Wireless(_) = &conn {
                self.add_interface(
                    &path,
                    interfaces::Wireless::new(Arc::clone(&self.network), conn.name()),
                )
                .await?;
            }

            self.objects.connections.push(path);
        }

        self.add_interface(
            "/org/opensuse/Agama/Network1/connections",
            interfaces::Connections::new(Arc::clone(&self.objects)),
        )
        .await?;

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
