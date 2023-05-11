//! Network D-Bus service.
//!
//! This module defines a D-Bus service which exposes Agama's network configuration.
use crate::dbus::interfaces;
use crate::model::{Connection, NetworkState};
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
    objects: Arc<Mutex<ObjectsPaths>>,
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
            objects: Arc::new(Mutex::new(ObjectsPaths::default())),
            connection,
        }
    }

    /// Starts listening on the D-Bus connection
    pub async fn listen(&mut self) -> Result<(), Box<dyn Error>> {
        self.publish_devices().await?;
        self.publish_connections().await?;
        self.connection
            .request_name("org.opensuse.Agama.Network1")
            .await?;
        Ok(())
    }

    // TODO: move this logic to a separate struct that registers all needed interfaces
    async fn publish_devices(&mut self) -> Result<(), Box<dyn Error>> {
        let state = self.state.lock().unwrap();
        let mut objects = self.objects.lock().unwrap();

        for (i, dev) in state.devices.iter().enumerate() {
            let path = format!("/org/opensuse/Agama/Network1/Devices/{}", i);
            self.add_interface(
                &path,
                interfaces::Device::new(Arc::clone(&self.state), &dev.name),
            )
            .await?;
            objects.devices.push(path);
        }

        self.add_interface(
            "/org/opensuse/Agama/Network1/Devices",
            interfaces::Devices::new(Arc::clone(&self.objects)),
        )
        .await?;

        Ok(())
    }

    // TODO: move this logic to a separate struct that registers all needed connections
    async fn publish_connections(&mut self) -> Result<(), Box<dyn Error>> {
        let state = self.state.lock().unwrap();
        let mut objects = self.objects.lock().unwrap();

        for (i, conn) in state.connections.iter().enumerate() {
            let path = format!("/org/opensuse/Agama/Network1/Connections/{}", i);
            self.add_interface(
                &path,
                interfaces::Connection::new(Arc::clone(&self.state), conn.name()),
            )
            .await?;

            self.add_interface(
                &path,
                interfaces::Ipv4::new(Arc::clone(&self.state), conn.name()),
            )
            .await?;

            if let Connection::Wireless(_) = &conn {
                self.add_interface(
                    &path,
                    interfaces::Wireless::new(Arc::clone(&self.state), conn.name()),
                )
                .await?;
            }

            objects.connections.push(path);
        }

        self.add_interface(
            "/org/opensuse/Agama/Network1/Connections",
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

/// Objects paths for known devices and connections
#[derive(Debug, Default)]
pub struct ObjectsPaths {
    pub devices: Vec<String>,
    pub connections: Vec<String>,
}
