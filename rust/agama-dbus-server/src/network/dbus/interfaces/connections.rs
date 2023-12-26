use std::{str::FromStr, sync::Arc};
use tokio::sync::{mpsc::UnboundedSender, oneshot, Mutex, MutexGuard};
use uuid::Uuid;
use zbus::{
    dbus_interface,
    zvariant::{ObjectPath, OwnedObjectPath},
    SignalContext,
};

use crate::network::{
    dbus::ObjectsRegistry,
    error::NetworkStateError,
    model::{Connection as NetworkConnection, MacAddress},
    Action,
};

/// D-Bus interface for the set of connections.
///
/// It offers an API to query the connections collection.
pub struct Connections {
    actions: Arc<Mutex<UnboundedSender<Action>>>,
    objects: Arc<Mutex<ObjectsRegistry>>,
}

impl Connections {
    /// Creates a Connections interface object.
    ///
    /// * `objects`: Objects paths registry.
    pub fn new(objects: Arc<Mutex<ObjectsRegistry>>, actions: UnboundedSender<Action>) -> Self {
        Self {
            objects,
            actions: Arc::new(Mutex::new(actions)),
        }
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Network.Connections")]
impl Connections {
    /// Returns the D-Bus paths of the network connections.
    pub async fn get_connections(&self) -> Vec<ObjectPath> {
        let objects = self.objects.lock().await;
        objects
            .connections_paths()
            .iter()
            .filter_map(|c| ObjectPath::try_from(c.clone()).ok())
            .collect()
    }

    /// Adds a new network connection.
    ///
    /// * `id`: connection name.
    /// * `ty`: connection type (see [agama_lib::network::types::DeviceType]).
    pub async fn add_connection(
        &mut self,
        id: String,
        ty: u8,
        #[zbus(signal_context)] ctxt: SignalContext<'_>,
    ) -> zbus::fdo::Result<OwnedObjectPath> {
        let actions = self.actions.lock().await;
        let (tx, rx) = oneshot::channel();
        actions
            .send(Action::AddConnection(id.clone(), ty.try_into()?, tx))
            .unwrap();
        let path = rx.await.unwrap()?;
        Self::connection_added(&ctxt, &id, &path).await?;
        Ok(path)
    }

    /// Returns the D-Bus path of the network connection.
    ///
    /// * `id`: connection ID.
    pub async fn get_connection(&self, id: &str) -> zbus::fdo::Result<OwnedObjectPath> {
        let objects = self.objects.lock().await;
        match objects.connection_path(id) {
            Some(path) => Ok(path.into()),
            None => Err(NetworkStateError::UnknownConnection(id.to_string()).into()),
        }
    }

    /// Removes a network connection.
    ///
    /// * `uuid`: connection UUID..
    pub async fn remove_connection(&mut self, id: &str) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock().await;
        actions
            .send(Action::RemoveConnection(id.to_string()))
            .unwrap();
        Ok(())
    }

    /// Applies the network configuration.
    ///
    /// It includes adding, updating and removing connections as needed.
    pub async fn apply(&self) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock().await;
        actions.send(Action::Apply).unwrap();
        Ok(())
    }

    /// Notifies than a new interface has been added.
    #[dbus_interface(signal)]
    pub async fn connection_added(
        ctxt: &SignalContext<'_>,
        id: &str,
        path: &ObjectPath<'_>,
    ) -> zbus::Result<()>;
}

/// D-Bus interface for a network connection
///
/// It offers an API to query a connection.
pub struct Connection {
    actions: Arc<Mutex<UnboundedSender<Action>>>,
    uuid: Uuid,
}

impl Connection {
    /// Creates a Connection interface object.
    ///
    /// * `actions`: sending-half of a channel to send actions.
    /// * `connection`: connection to expose over D-Bus.
    pub fn new(actions: UnboundedSender<Action>, uuid: Uuid) -> Self {
        Self {
            actions: Arc::new(Mutex::new(actions)),
            uuid,
        }
    }

    /// Returns the underlying connection.
    async fn get_connection(&self) -> Result<NetworkConnection, NetworkStateError> {
        let actions = self.actions.lock().await;
        let (tx, rx) = oneshot::channel();
        actions.send(Action::GetConnection(self.uuid, tx)).unwrap();
        rx.await
            .unwrap()
            .ok_or(NetworkStateError::UnknownConnection(self.uuid.to_string()))
    }

    /// Updates the connection data in the NetworkSystem.
    ///
    /// * `connection`: Updated connection.
    pub async fn update_connection<F>(&self, func: F) -> Result<(), NetworkStateError>
    where
        F: FnOnce(&mut NetworkConnection),
    {
        let mut connection = self.get_connection().await?;
        func(&mut connection);
        let actions = self.actions.lock().await;
        actions
            .send(Action::UpdateConnection(Box::new(connection)))
            .unwrap();
        Ok(())
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Network.Connection")]
impl Connection {
    /// Connection ID.
    ///
    /// Unique identifier of the network connection. It may or not be the same that the used by the
    /// backend. For instance, when using NetworkManager (which is the only supported backend by
    /// now), it uses the original ID but appending a number in case the ID is duplicated.
    #[dbus_interface(property)]
    pub async fn id(&self) -> zbus::fdo::Result<String> {
        let connection = self.get_connection().await?;
        Ok(connection.id)
    }

    /// Connection UUID.
    ///
    /// Unique identifier of the network connection. It may or not be the same that the used by the
    /// backend.
    #[dbus_interface(property)]
    pub async fn uuid(&self) -> String {
        self.uuid.to_string()
    }

    #[dbus_interface(property)]
    pub async fn controller(&self) -> zbus::fdo::Result<String> {
        let connection = self.get_connection().await?;
        let result = match connection.controller {
            Some(uuid) => uuid.to_string(),
            None => "".to_string(),
        };
        Ok(result)
    }

    #[dbus_interface(property)]
    pub async fn interface(&self) -> zbus::fdo::Result<String> {
        let connection = self.get_connection().await?;
        Ok(connection.interface.unwrap_or_default())
    }

    #[dbus_interface(property)]
    pub async fn set_interface(&mut self, name: &str) -> zbus::fdo::Result<()> {
        let interface = Some(name.to_string());
        self.update_connection(|c| c.interface = interface).await?;
        Ok(())
    }

    /// Custom mac-address
    #[dbus_interface(property)]
    pub async fn mac_address(&self) -> zbus::fdo::Result<String> {
        let connection = self.get_connection().await?;
        Ok(connection.mac_address.to_string())
    }

    #[dbus_interface(property)]
    pub async fn set_mac_address(&mut self, mac_address: &str) -> zbus::fdo::Result<()> {
        let mac_address = MacAddress::from_str(mac_address)?;
        self.update_connection(|c| c.mac_address = mac_address)
            .await?;
        Ok(())
    }

    /// Whether the network interface should be active or not
    #[dbus_interface(property)]
    pub async fn active(&self) -> zbus::fdo::Result<bool> {
        let connection = self.get_connection().await?;
        Ok(connection.is_up())
    }

    #[dbus_interface(property)]
    pub async fn set_active(&mut self, active: bool) -> zbus::fdo::Result<()> {
        self.update_connection(|c| {
            if active {
                c.set_up();
            } else {
                c.set_down();
            }
        })
        .await?;
        Ok(())
    }
}

/// D-Bus interface for Match settings
pub struct Match {
    actions: Arc<Mutex<UnboundedSender<Action>>>,
    connection: Arc<Mutex<NetworkConnection>>,
}

impl Match {
    /// Creates a Match Settings interface object.
    ///
    /// * `actions`: sending-half of a channel to send actions.
    /// * `connection`: connection to expose over D-Bus.
    pub fn new(
        actions: UnboundedSender<Action>,
        connection: Arc<Mutex<NetworkConnection>>,
    ) -> Self {
        Self {
            actions: Arc::new(Mutex::new(actions)),
            connection,
        }
    }

    /// Returns the underlying connection.
    async fn get_connection(&self) -> MutexGuard<NetworkConnection> {
        self.connection.lock().await
    }

    /// Updates the connection data in the NetworkSystem.
    ///
    /// * `connection`: Updated connection.
    async fn update_connection<'a>(
        &self,
        connection: MutexGuard<'a, NetworkConnection>,
    ) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock().await;
        actions
            .send(Action::UpdateConnection(Box::new(connection.clone())))
            .unwrap();
        Ok(())
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Network.Connection.Match")]
impl Match {
    /// List of driver names to match.
    #[dbus_interface(property)]
    pub async fn driver(&self) -> Vec<String> {
        let connection = self.get_connection().await;
        connection.match_config.driver.clone()
    }

    #[dbus_interface(property)]
    pub async fn set_driver(&mut self, driver: Vec<String>) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection().await;
        connection.match_config.driver = driver;
        self.update_connection(connection).await
    }

    /// List of paths to match agains the ID_PATH udev property of devices.
    #[dbus_interface(property)]
    pub async fn path(&self) -> Vec<String> {
        let connection = self.get_connection().await;
        connection.match_config.path.clone()
    }

    #[dbus_interface(property)]
    pub async fn set_path(&mut self, path: Vec<String>) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection().await;
        connection.match_config.path = path;
        self.update_connection(connection).await
    }
    /// List of interface names to match.
    #[dbus_interface(property)]
    pub async fn interface(&self) -> Vec<String> {
        let connection = self.get_connection().await;
        connection.match_config.interface.clone()
    }

    #[dbus_interface(property)]
    pub async fn set_interface(&mut self, interface: Vec<String>) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection().await;
        connection.match_config.interface = interface;
        self.update_connection(connection).await
    }

    /// List of kernel options to match.
    #[dbus_interface(property)]
    pub async fn kernel(&self) -> Vec<String> {
        let connection = self.get_connection().await;
        connection.match_config.kernel.clone()
    }

    #[dbus_interface(property)]
    pub async fn set_kernel(&mut self, kernel: Vec<String>) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection().await;
        connection.match_config.kernel = kernel;
        self.update_connection(connection).await
    }
}
