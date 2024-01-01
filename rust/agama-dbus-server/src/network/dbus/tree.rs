use agama_lib::error::ServiceError;
use zbus::zvariant::{ObjectPath, OwnedObjectPath};

use crate::network::{action::Action, dbus::interfaces, model::*};
use log;
use std::collections::HashMap;
use tokio::sync::mpsc::UnboundedSender;

const CONNECTIONS_PATH: &str = "/org/opensuse/Agama1/Network/connections";
const DEVICES_PATH: &str = "/org/opensuse/Agama1/Network/devices";

/// Handle the objects in the D-Bus tree for the network state
pub struct Tree {
    connection: zbus::Connection,
    actions: UnboundedSender<Action>,
    objects: ObjectsRegistry,
}

impl Tree {
    /// Creates a new tree handler.
    ///
    /// * `connection`: D-Bus connection to use.
    /// * `actions`: sending-half of a channel to send actions.
    pub fn new(connection: zbus::Connection, actions: UnboundedSender<Action>) -> Self {
        Self {
            connection,
            actions,
            objects: Default::default(),
        }
    }

    /// Refreshes the list of connections.
    ///
    /// TODO: re-creating the tree is kind of brute-force and it sends signals about
    /// adding/removing interfaces. We should add/update/delete objects as needed.
    ///
    /// * `connections`: list of connections.
    pub async fn set_connections(
        &mut self,
        connections: &mut [Connection],
    ) -> Result<(), ServiceError> {
        self.remove_connections().await?;
        self.add_connections(connections).await?;
        Ok(())
    }

    /// Refreshes the list of devices.
    ///
    /// * `devices`: list of devices.
    pub async fn set_devices(&mut self, devices: &[Device]) -> Result<(), ServiceError> {
        self.remove_devices().await?;
        self.add_devices(devices).await?;
        Ok(())
    }

    /// Adds devices to the D-Bus tree.
    ///
    /// * `devices`: list of devices.
    pub async fn add_devices(&mut self, devices: &[Device]) -> Result<(), ServiceError> {
        for (i, dev) in devices.iter().enumerate() {
            let path = format!("{}/{}", DEVICES_PATH, i);
            let path = ObjectPath::try_from(path.as_str()).unwrap();
            self.add_interface(&path, interfaces::Device::new(dev.clone()))
                .await?;
            self.objects.register_device(&dev.name, path);
        }

        self.add_interface(DEVICES_PATH, interfaces::Devices::new(self.actions.clone()))
            .await?;

        Ok(())
    }

    /// Adds a connection to the D-Bus tree and returns the D-Bus path.
    ///
    /// * `conn`: connection to add.
    /// * `notify`: whether to notify the added connection
    pub async fn add_connection(
        &mut self,
        conn: &mut Connection,
    ) -> Result<OwnedObjectPath, ServiceError> {
        let uuid = conn.uuid;
        let (id, path) = self.objects.register_connection(conn);
        if id != conn.id {
            conn.id = id.clone();
        }
        let path: OwnedObjectPath = path.into();
        log::info!("Publishing network connection '{}' on '{}'", id, &path);

        self.add_interface(
            &path,
            interfaces::Connection::new(self.actions.clone(), uuid),
        )
        .await?;

        self.add_interface(&path, interfaces::Ip::new(self.actions.clone(), uuid))
            .await?;

        self.add_interface(&path, interfaces::Match::new(self.actions.clone(), uuid))
            .await?;

        if let ConnectionConfig::Bond(_) = conn.config {
            self.add_interface(&path, interfaces::Bond::new(self.actions.clone(), uuid))
                .await?;
        }

        if let ConnectionConfig::Wireless(_) = conn.config {
            self.add_interface(&path, interfaces::Wireless::new(self.actions.clone(), uuid))
                .await?;
        }

        Ok(path)
    }

    /// Removes a connection from the tree
    ///
    /// * `id`: connection ID.
    pub async fn remove_connection(&mut self, id: &str) -> Result<(), ServiceError> {
        let Some(path) = self.objects.connection_path(id) else {
            return Ok(());
        };
        self.remove_connection_on(path.as_str()).await?;
        self.objects.deregister_connection(id).unwrap();
        Ok(())
    }

    /// Returns all devices paths.
    pub fn devices_paths(&self) -> Vec<OwnedObjectPath> {
        self.objects.devices_paths()
    }

    /// Returns all connection paths.
    pub fn connections_paths(&self) -> Vec<OwnedObjectPath> {
        self.objects.connections_paths()
    }

    pub fn connection_path(&self, id: &str) -> Option<OwnedObjectPath> {
        self.objects.connection_path(id).map(|o| o.into())
    }

    /// Adds connections to the D-Bus tree.
    ///
    /// * `connections`: list of connections.
    async fn add_connections(
        &mut self,
        connections: &mut [Connection],
    ) -> Result<(), ServiceError> {
        for conn in connections.iter_mut() {
            self.add_connection(conn).await?;
        }

        self.add_interface(
            CONNECTIONS_PATH,
            interfaces::Connections::new(self.actions.clone()),
        )
        .await?;

        Ok(())
    }

    /// Clears all the connections from the tree.
    async fn remove_connections(&mut self) -> Result<(), ServiceError> {
        for path in self.objects.connections.values() {
            self.remove_connection_on(path.as_str()).await?;
        }
        self.objects.connections.clear();
        Ok(())
    }

    /// Clears all the devices from the tree.
    async fn remove_devices(&mut self) -> Result<(), ServiceError> {
        let object_server = self.connection.object_server();
        for path in self.objects.devices.values() {
            object_server
                .remove::<interfaces::Device, _>(path.as_str())
                .await?;
        }
        self.objects.devices.clear();
        Ok(())
    }

    /// Removes a connection object on the given path
    ///
    /// * `path`: connection D-Bus path.
    async fn remove_connection_on(&self, path: &str) -> Result<(), ServiceError> {
        let object_server = self.connection.object_server();
        _ = object_server.remove::<interfaces::Bond, _>(path).await;
        _ = object_server.remove::<interfaces::Wireless, _>(path).await;
        object_server.remove::<interfaces::Ip, _>(path).await?;
        object_server
            .remove::<interfaces::Connection, _>(path)
            .await?;
        Ok(())
    }

    async fn add_interface<T>(&mut self, path: &str, iface: T) -> Result<bool, ServiceError>
    where
        T: zbus::Interface,
    {
        let object_server = self.connection.object_server();
        Ok(object_server.at(path, iface).await?)
    }
}

/// Objects paths for known devices and connections
///
/// Connections are indexed by its Id, which is expected to be unique.
#[derive(Debug, Default)]
struct ObjectsRegistry {
    /// device_name (eth0) -> object_path
    devices: HashMap<String, OwnedObjectPath>,
    /// id -> object_path
    connections: HashMap<String, OwnedObjectPath>,
}

impl ObjectsRegistry {
    /// Registers a network device.
    ///
    /// * `id`: device name.
    /// * `path`: object path.
    pub fn register_device(&mut self, id: &str, path: ObjectPath) {
        self.devices.insert(id.to_string(), path.into());
    }

    /// Registers a network connection and returns its D-Bus path.
    ///
    /// It returns the connection Id and the D-Bus path. Bear in mind that the Id can be different
    /// in case the original one already existed.
    ///
    /// * `conn`: network connection.
    pub fn register_connection(&mut self, conn: &Connection) -> (String, ObjectPath) {
        let path = format!("{}/{}", CONNECTIONS_PATH, self.connections.len());
        let path = ObjectPath::try_from(path).unwrap();
        let mut id = conn.id.clone();
        if self.connection_path(&id).is_some() {
            id = self.propose_id(&id);
        };
        self.connections.insert(id.clone(), path.clone().into());
        (id, path)
    }

    /// Returns the path for a connection.
    ///
    /// * `id`: connection ID.
    pub fn connection_path(&self, id: &str) -> Option<ObjectPath> {
        self.connections.get(id).map(|p| p.as_ref())
    }

    /// Deregisters a network connection.
    ///
    /// * `id`: connection ID.
    pub fn deregister_connection(&mut self, id: &str) -> Option<OwnedObjectPath> {
        self.connections.remove(id)
    }

    /// Returns all devices paths.
    pub fn devices_paths(&self) -> Vec<OwnedObjectPath> {
        self.devices.values().cloned().collect()
    }

    /// Returns all connection paths.
    pub fn connections_paths(&self) -> Vec<OwnedObjectPath> {
        self.connections.values().cloned().collect()
    }

    /// Proposes a connection ID.
    ///
    /// * `id`: original connection ID.
    fn propose_id(&self, id: &str) -> String {
        let prefix = format!("{}-", id);
        let filtered: Vec<_> = self
            .connections
            .keys()
            .filter_map(|i| i.strip_prefix(&prefix).and_then(|n| n.parse::<u32>().ok()))
            .collect();
        let index = filtered.into_iter().max().unwrap_or(0);
        format!("{}{}", prefix, index + 1)
    }
}
