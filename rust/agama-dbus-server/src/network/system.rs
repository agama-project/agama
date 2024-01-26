use super::{error::NetworkStateError, NetworkAdapterError};
use crate::network::{dbus::Tree, model::Connection, Action, Adapter, NetworkState};
use agama_lib::network::types::DeviceType;
use std::{error::Error, sync::Arc};
use tokio::sync::{
    mpsc::{self, UnboundedReceiver, UnboundedSender},
    Mutex,
};
use uuid::Uuid;
use zbus::zvariant::OwnedObjectPath;

/// Represents the network system using holding the state and setting up the D-Bus tree.
pub struct NetworkSystem<T: Adapter> {
    /// Network state
    pub state: NetworkState,
    /// Side of the channel to send actions.
    actions_tx: UnboundedSender<Action>,
    actions_rx: UnboundedReceiver<Action>,
    tree: Arc<Mutex<Tree>>,
    /// Adapter to read/write the network state.
    adapter: T,
}

impl<T: Adapter> NetworkSystem<T> {
    pub fn new(conn: zbus::Connection, adapter: T) -> Self {
        let (actions_tx, actions_rx) = mpsc::unbounded_channel();
        let tree = Tree::new(conn, actions_tx.clone());
        Self {
            state: NetworkState::default(),
            actions_tx,
            actions_rx,
            tree: Arc::new(Mutex::new(tree)),
            adapter,
        }
    }

    /// Writes the network configuration.
    pub async fn write(&mut self) -> Result<(), NetworkAdapterError> {
        self.adapter.write(&self.state).await?;
        self.state = self.adapter.read().await?;
        Ok(())
    }

    /// Returns a clone of the
    /// [UnboundedSender](https://docs.rs/tokio/latest/tokio/sync/mpsc/struct.UnboundedSender.html)
    /// to execute [actions](Action).
    pub fn actions_tx(&self) -> UnboundedSender<Action> {
        self.actions_tx.clone()
    }

    /// Populates the D-Bus tree with the known devices and connections.
    pub async fn setup(&mut self) -> Result<(), Box<dyn Error>> {
        self.state = self.adapter.read().await?;
        let mut tree = self.tree.lock().await;
        tree.set_connections(&mut self.state.connections).await?;
        tree.set_devices(&self.state.devices).await?;
        Ok(())
    }

    /// Process incoming actions.
    ///
    /// This function is expected to be executed on a separate thread.
    pub async fn listen(&mut self) {
        while let Some(action) = self.actions_rx.recv().await {
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
            Action::GetConnection(uuid, tx) => {
                let conn = self.state.get_connection_by_uuid(uuid);
                tx.send(conn.cloned()).unwrap();
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
            Action::UpdateConnection(conn) => {
                self.state.update_connection(*conn)?;
            }
            Action::RemoveConnection(uuid) => {
                let mut tree = self.tree.lock().await;
                tree.remove_connection(uuid).await?;
                self.state.remove_connection(uuid)?;
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
}
