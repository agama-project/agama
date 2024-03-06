use async_trait::async_trait;
use std::{str::FromStr, sync::Arc};
use tokio::sync::{mpsc::UnboundedSender, oneshot, Mutex, MutexGuard};
use uuid::Uuid;
use zbus::{
    dbus_interface,
    zvariant::{ObjectPath, OwnedObjectPath},
    SignalContext,
};

use super::common::ConnectionInterface;
use crate::network::{error::NetworkStateError, model::MacAddress, Action};

/// D-Bus interface for the set of connections.
///
/// It offers an API to query the connections collection.
pub struct Connections {
    actions: Arc<Mutex<UnboundedSender<Action>>>,
}

impl Connections {
    /// Creates a Connections interface object.
    ///
    /// * `actions`: sending-half of a channel to send actions.
    pub fn new(actions: UnboundedSender<Action>) -> Self {
        Self {
            actions: Arc::new(Mutex::new(actions)),
        }
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Network.Connections")]
impl Connections {
    /// Returns the D-Bus paths of the network connections.
    pub async fn get_connections(&self) -> zbus::fdo::Result<Vec<OwnedObjectPath>> {
        let actions = self.actions.lock().await;
        let (tx, rx) = oneshot::channel();
        actions.send(Action::GetConnectionsPaths(tx)).unwrap();
        let result = rx.await.unwrap();
        Ok(result)
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

    /// Returns the D-Bus path of the network connection by its UUID.
    ///
    /// * `uuid`: connection UUID.
    pub async fn get_connection(&self, uuid: &str) -> zbus::fdo::Result<OwnedObjectPath> {
        let uuid: Uuid = uuid
            .parse()
            .map_err(|_| NetworkStateError::InvalidUuid(uuid.to_string()))?;
        let actions = self.actions.lock().await;
        let (tx, rx) = oneshot::channel();
        actions.send(Action::GetConnectionPath(uuid, tx)).unwrap();
        let path = rx
            .await
            .unwrap()
            .ok_or(NetworkStateError::UnknownConnection(uuid.to_string()))?;
        Ok(path)
    }

    /// Returns the D-Bus path of the network connection by its ID.
    ///
    /// * `id`: connection ID.
    pub async fn get_connection_by_id(&self, id: &str) -> zbus::fdo::Result<OwnedObjectPath> {
        let actions = self.actions.lock().await;
        let (tx, rx) = oneshot::channel();
        actions
            .send(Action::GetConnectionPathById(id.to_string(), tx))
            .unwrap();
        let path = rx
            .await
            .unwrap()
            .ok_or(NetworkStateError::UnknownConnection(id.to_string()))?;
        Ok(path)
    }

    /// Removes a network connection.
    ///
    /// * `uuid`: connection UUID..
    pub async fn remove_connection(&mut self, uuid: &str) -> zbus::fdo::Result<()> {
        let uuid = uuid
            .parse()
            .map_err(|_| NetworkStateError::InvalidUuid(uuid.to_string()))?;
        let actions = self.actions.lock().await;
        actions.send(Action::RemoveConnection(uuid)).unwrap();
        Ok(())
    }

    /// Applies the network configuration.
    ///
    /// It includes adding, updating and removing connections as needed.
    pub async fn apply(&self) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock().await;
        let (tx, rx) = oneshot::channel();
        actions.send(Action::Apply(tx)).unwrap();
        rx.await.unwrap()?;
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
    /// * `uuid`: network connection's UUID.
    pub fn new(actions: UnboundedSender<Action>, uuid: Uuid) -> Self {
        Self {
            actions: Arc::new(Mutex::new(actions)),
            uuid,
        }
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

#[async_trait]
impl ConnectionInterface for Connection {
    fn uuid(&self) -> Uuid {
        self.uuid
    }

    async fn actions(&self) -> MutexGuard<UnboundedSender<Action>> {
        self.actions.lock().await
    }
}

/// D-Bus interface for Match settings
pub struct Match {
    actions: Arc<Mutex<UnboundedSender<Action>>>,
    uuid: Uuid,
}

impl Match {
    /// Creates a Match Settings interface object.
    ///
    /// * `actions`: sending-half of a channel to send actions.
    /// * `uuid`: nework connection's UUID.
    pub fn new(actions: UnboundedSender<Action>, uuid: Uuid) -> Self {
        Self {
            actions: Arc::new(Mutex::new(actions)),
            uuid,
        }
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Network.Connection.Match")]
impl Match {
    /// List of driver names to match.
    #[dbus_interface(property)]
    pub async fn driver(&self) -> zbus::fdo::Result<Vec<String>> {
        let connection = self.get_connection().await?;
        Ok(connection.match_config.driver)
    }

    #[dbus_interface(property)]
    pub async fn set_driver(&mut self, driver: Vec<String>) -> zbus::fdo::Result<()> {
        self.update_connection(|c| c.match_config.driver = driver)
            .await?;
        Ok(())
    }

    /// List of paths to match agains the ID_PATH udev property of devices.
    #[dbus_interface(property)]
    pub async fn path(&self) -> zbus::fdo::Result<Vec<String>> {
        let connection = self.get_connection().await?;
        Ok(connection.match_config.path)
    }

    #[dbus_interface(property)]
    pub async fn set_path(&mut self, path: Vec<String>) -> zbus::fdo::Result<()> {
        self.update_connection(|c| c.match_config.path = path)
            .await?;
        Ok(())
    }
    /// List of interface names to match.
    #[dbus_interface(property)]
    pub async fn interface(&self) -> zbus::fdo::Result<Vec<String>> {
        let connection = self.get_connection().await?;
        Ok(connection.match_config.interface)
    }

    #[dbus_interface(property)]
    pub async fn set_interface(&mut self, interface: Vec<String>) -> zbus::fdo::Result<()> {
        self.update_connection(|c| c.match_config.interface = interface)
            .await?;
        Ok(())
    }

    /// List of kernel options to match.
    #[dbus_interface(property)]
    pub async fn kernel(&self) -> zbus::fdo::Result<Vec<String>> {
        let connection = self.get_connection().await?;
        Ok(connection.match_config.kernel)
    }

    #[dbus_interface(property)]
    pub async fn set_kernel(&mut self, kernel: Vec<String>) -> zbus::fdo::Result<()> {
        self.update_connection(|c| c.match_config.kernel = kernel)
            .await?;
        Ok(())
    }
}

#[async_trait]
impl ConnectionInterface for Match {
    fn uuid(&self) -> Uuid {
        self.uuid
    }

    async fn actions(&self) -> MutexGuard<UnboundedSender<Action>> {
        self.actions.lock().await
    }
}
