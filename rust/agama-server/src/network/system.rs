use super::{
    error::NetworkStateError,
    model::{Device, StateConfig},
    NetworkAdapterError,
};
use crate::network::{
    dbus::Tree,
    model::{Connection, GeneralState},
    Action, Adapter, NetworkState,
};
use agama_lib::{
    error::ServiceError,
    network::{settings::NetworkConnection, types::DeviceType},
};
use std::{error::Error, sync::Arc};
use tokio::sync::{
    mpsc::{self, error::SendError, UnboundedReceiver, UnboundedSender},
    oneshot::{self, error::RecvError},
    Mutex,
};
use uuid::Uuid;
use zbus::zvariant::OwnedObjectPath;

#[derive(thiserror::Error, Debug)]
pub enum NetworkSystemError {
    #[error("Network state error: {0}")]
    State(#[from] NetworkStateError),
    #[error("Could not talk to the network system: {0}")]
    InputError(#[from] SendError<Action>),
    #[error("Could not read an answer from the network system: {0}")]
    OutputError(#[from] RecvError),
    #[error("D-Bus service error: {0}")]
    ServiceError(#[from] ServiceError),
    #[error("Network backend error: {0}")]
    AdapterError(#[from] NetworkAdapterError),
}

/// Represents the network configuration service.
///
/// It offers an API to start the service and interact with it by using message
/// passing like the example below.
///
/// ```no_run
/// # use agama_server::network::{Action, NetworkManagerAdapter, NetworkSystem};
/// # use agama_lib::connection;
/// # use tokio::sync::oneshot;
///
/// # tokio_test::block_on(async {
/// let adapter = NetworkManagerAdapter::from_system()
///     .await
///     .expect("Could not connect to NetworkManager.");
/// let dbus = connection()
///     .await
///     .expect("Could not connect to Agama's D-Bus server.");
/// let network = NetworkSystem::new(dbus, adapter);
///
/// // Start the networking service and get the channel for communication.
/// let client = network.start()
///     .await
///     .expect("Could not start the networking configuration system.");
///
/// // Perform some action, like getting the list of devices.
/// let devices = client.get_devices().await
///     .expect("Could not get the list of devices.");
/// # });
/// ```
pub struct NetworkSystem<T: Adapter + Send> {
    connection: zbus::Connection,
    adapter: T,
}

impl<T: Adapter + Send + 'static> NetworkSystem<T> {
    /// Returns a new instance of the network configuration system.
    ///
    /// This function does not start the system. To get it running, you must call
    /// the [start](Self::start) method.
    ///
    /// * `connection`: D-Bus connection to publish the network tree.
    /// * `adapter`: networking configuration adapter.
    pub fn new(connection: zbus::Connection, adapter: T) -> Self {
        Self {
            connection,
            adapter,
        }
    }

    /// Starts the network configuration service and returns a client for communication purposes.
    ///
    /// This function starts the server (using [NetworkSystemServer]) on a separate
    /// task. All the communication is performed through the returned [NetworkSystemClient].
    pub async fn start(self) -> Result<NetworkSystemClient, NetworkSystemError> {
        let mut state = self.adapter.read(StateConfig::default()).await?;
        let (actions_tx, actions_rx) = mpsc::unbounded_channel();
        let mut tree = Tree::new(self.connection, actions_tx.clone());
        tree.set_connections(&mut state.connections).await?;
        tree.set_devices(&state.devices).await?;

        tokio::spawn(async move {
            let mut server = NetworkSystemServer {
                state,
                input: actions_rx,
                adapter: self.adapter,
                tree: Arc::new(Mutex::new(tree)),
            };

            server.listen().await;
        });

        Ok(NetworkSystemClient {
            actions: actions_tx,
        })
    }
}

/// Client to interact with the NetworkSystem once it is running.
///
/// It hides the details of the message-passing behind a convenient API.
#[derive(Clone)]
pub struct NetworkSystemClient {
    /// Channel to talk to the server. This field is temporarily public, but it will
    /// be set to private once web interface is adapted.
    pub actions: UnboundedSender<Action>,
}

// TODO: add a NetworkSystemError type
impl NetworkSystemClient {
    /// Returns the general state.
    pub async fn get_state(&self) -> Result<GeneralState, NetworkSystemError> {
        let (tx, rx) = oneshot::channel();
        self.actions.send(Action::GetGeneralState(tx))?;
        Ok(rx.await?)
    }

    /// Updates the network general state.
    pub fn update_state(&self, state: GeneralState) -> Result<(), NetworkSystemError> {
        self.actions.send(Action::UpdateGeneralState(state))?;
        Ok(())
    }

    /// Returns the collection of network devices.
    pub async fn get_devices(&self) -> Result<Vec<Device>, NetworkSystemError> {
        let (tx, rx) = oneshot::channel();
        self.actions.send(Action::GetDevices(tx))?;
        Ok(rx.await?)
    }

    /// Returns the collection of network connections.
    pub async fn get_connections(&self) -> Result<Vec<Connection>, NetworkSystemError> {
        let (tx, rx) = oneshot::channel();
        self.actions.send(Action::GetConnections(tx))?;
        Ok(rx.await?)
    }

    /// Adds a new connection.
    pub async fn add_connection(&self, connection: Connection) -> Result<(), NetworkSystemError> {
        let (tx, rx) = oneshot::channel();
        self.actions
            .send(Action::NewConnection(Box::new(connection.clone()), tx))?;
        let result = rx.await?;
        Ok(result?)
    }

    /// Returns the connection with the given ID.
    ///
    /// * `id`: Connection ID.
    pub async fn get_connection(&self, id: &str) -> Result<Option<Connection>, NetworkSystemError> {
        let (tx, rx) = oneshot::channel();
        self.actions
            .send(Action::GetConnection(id.to_string(), tx))?;
        let result = rx.await?;
        Ok(result)
    }

    /// Updates the connection.
    ///
    /// * `connection`: Updated connection.
    pub async fn update_connection(
        &self,
        connection: Connection,
    ) -> Result<(), NetworkSystemError> {
        let (tx, rx) = oneshot::channel();
        self.actions
            .send(Action::UpdateConnection(Box::new(connection), tx))?;
        let result = rx.await?;
        Ok(result?)
    }

    /// Removes the connection with the given ID.
    ///
    /// * `id`: Connection ID.
    pub async fn remove_connection(&self, id: &str) -> Result<(), NetworkSystemError> {
        let (tx, rx) = oneshot::channel();
        self.actions
            .send(Action::RemoveConnection(id.to_string(), tx))?;
        let result = rx.await?;
        Ok(result?)
    }

    /// Applies the network configuration.
    pub async fn apply(&self) -> Result<(), NetworkSystemError> {
        let (tx, rx) = oneshot::channel();
        self.actions.send(Action::Apply(tx))?;
        let result = rx.await?;
        Ok(result?)
    }
}

struct NetworkSystemServer<T: Adapter> {
    state: NetworkState,
    input: UnboundedReceiver<Action>,
    adapter: T,
    tree: Arc<Mutex<Tree>>,
}

impl<T: Adapter> NetworkSystemServer<T> {
    /// Process incoming actions.
    ///
    /// This function is expected to be executed on a separate thread.
    pub async fn listen(&mut self) {
        while let Some(action) = self.input.recv().await {
            if let Err(error) = self.dispatch_action(action).await {
                eprintln!("Could not process the action: {}", error);
            }
        }
    }

    /// Dispatch an action.
    pub async fn dispatch_action(&mut self, action: Action) -> Result<(), Box<dyn Error>> {
        match action {
            Action::AddConnection(name, ty, tx) => {
                let result = self.add_connection_action(name, ty).await;
                tx.send(result).unwrap();
            }
            Action::RefreshScan(tx) => {
                let state = self
                    .adapter
                    .read(StateConfig {
                        access_points: true,
                        ..Default::default()
                    })
                    .await?;
                self.state.general_state = state.general_state;
                self.state.access_points = state.access_points;
                tx.send(Ok(())).unwrap();
            }
            Action::GetAccessPoints(tx) => {
                tx.send(self.state.access_points.clone()).unwrap();
            }
            Action::NewConnection(conn, tx) => {
                tx.send(self.state.add_connection(*conn)).unwrap();
            }
            Action::GetGeneralState(tx) => {
                let config = self.state.general_state.clone();
                tx.send(config.clone()).unwrap();
            }
            Action::GetConnection(id, tx) => {
                let conn = self.state.get_connection(id.as_ref());
                tx.send(conn.cloned()).unwrap();
            }
            Action::GetConnectionByUuid(uuid, tx) => {
                let conn = self.state.get_connection_by_uuid(uuid);
                tx.send(conn.cloned()).unwrap();
            }
            Action::GetConnections(tx) => {
                let connections = self
                    .state
                    .connections
                    .clone()
                    .into_iter()
                    .filter(|c| !c.is_removed())
                    .collect();

                tx.send(connections).unwrap();
            }
            Action::GetConnectionPath(uuid, tx) => {
                let tree = self.tree.lock().await;
                let path = tree.connection_path(uuid);
                tx.send(path).unwrap();
            }
            Action::GetConnectionPathById(id, tx) => {
                let path = self.get_connection_path_by_id_action(&id).await;
                tx.send(path).unwrap();
            }
            Action::GetController(uuid, tx) => {
                let result = self.get_controller_action(uuid);
                tx.send(result).unwrap()
            }
            Action::GetDevice(name, tx) => {
                let device = self.state.get_device(name.as_str());
                tx.send(device.cloned()).unwrap();
            }
            Action::GetDevicePath(name, tx) => {
                let tree = self.tree.lock().await;
                let path = tree.device_path(name.as_str());
                tx.send(path).unwrap();
            }
            Action::GetDevices(tx) => {
                tx.send(self.state.devices.clone()).unwrap();
            }
            Action::GetDevicesPaths(tx) => {
                let tree = self.tree.lock().await;
                tx.send(tree.devices_paths()).unwrap();
            }
            Action::GetConnectionsPaths(tx) => {
                let tree = self.tree.lock().await;
                tx.send(tree.connections_paths()).unwrap();
            }
            Action::SetPorts(uuid, ports, rx) => {
                let result = self.set_ports_action(uuid, *ports);
                rx.send(result).unwrap();
            }
            Action::UpdateConnection(conn, tx) => {
                let result = self.state.update_connection(*conn);
                tx.send(result).unwrap();
            }
            Action::UpdateGeneralState(general_state) => {
                self.state.general_state = general_state;
            }
            Action::RemoveConnection(id, tx) => {
                let result = self.state.remove_connection(id.as_str());

                tx.send(result).unwrap();
            }
            Action::Apply(tx) => {
                let result = self.write().await;
                let failed = result.is_err();
                tx.send(result).unwrap();
                if failed {
                    return Ok(());
                }

                // TODO: re-creating the tree is kind of brute-force and it sends signals about
                // adding/removing interfaces. We should add/update/delete objects as needed.
                // NOTE updating the tree at the same time than dispatching actions can cause a
                // deadlock. We might consider using message passing too but at this point
                // is enough to use a separate task.
                let mut connections = self.state.connections.clone();
                let tree = Arc::clone(&self.tree);
                tokio::spawn(async move {
                    let mut tree = tree.lock().await;
                    if let Err(e) = tree.set_connections(&mut connections).await {
                        log::error!("Could not update the D-Bus tree: {}", e);
                    }
                });
            }
        }

        Ok(())
    }

    async fn add_connection_action(
        &mut self,
        name: String,
        ty: DeviceType,
    ) -> Result<OwnedObjectPath, NetworkStateError> {
        let conn = Connection::new(name, ty);
        // TODO: handle tree handling problems
        self.state.add_connection(conn.clone())?;
        let mut tree = self.tree.lock().await;
        let path = tree
            .add_connection(&conn)
            .await
            .expect("Could not update the D-Bus tree");
        Ok(path)
    }

    fn set_ports_action(
        &mut self,
        uuid: Uuid,
        ports: Vec<String>,
    ) -> Result<(), NetworkStateError> {
        let conn = self
            .state
            .get_connection_by_uuid(uuid)
            .ok_or(NetworkStateError::UnknownConnection(uuid.to_string()))?;
        self.state.set_ports(&conn.clone(), ports)
    }

    fn get_controller_action(
        &mut self,
        uuid: Uuid,
    ) -> Result<(Connection, Vec<String>), NetworkStateError> {
        let conn = self
            .state
            .get_connection_by_uuid(uuid)
            .ok_or(NetworkStateError::UnknownConnection(uuid.to_string()))?;
        let conn = conn.clone();

        let controlled = self
            .state
            .get_controlled_by(uuid)
            .iter()
            .map(|c| c.interface.as_deref().unwrap_or(&c.id).to_string())
            .collect::<Vec<_>>();

        Ok((conn, controlled))
    }

    async fn get_connection_path_by_id_action(&mut self, id: &str) -> Option<OwnedObjectPath> {
        let conn = self.state.get_connection(id)?;
        let tree = self.tree.lock().await;
        tree.connection_path(conn.uuid)
    }

    /// Writes the network configuration.
    pub async fn write(&mut self) -> Result<(), NetworkAdapterError> {
        self.adapter.write(&self.state).await?;
        self.state = self.adapter.read(StateConfig::default()).await?;
        Ok(())
    }
}
