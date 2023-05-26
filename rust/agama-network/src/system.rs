use crate::dbus::Tree;
use crate::{model::Connection, nm::NetworkManagerAdapter, Action, Adapter, NetworkState};
use agama_lib::error::ServiceError;
use std::error::Error;
use std::sync::mpsc::{channel, Receiver, Sender};

/// Represents the network system, wrapping a [NetworkState] and setting up the D-Bus tree.
pub struct NetworkSystem {
    /// Network state
    pub state: NetworkState,
    /// Side of the channel to send actions.
    actions_tx: Sender<Action>,
    actions_rx: Receiver<Action>,
    tree: Tree,
}

impl NetworkSystem {
    pub fn new(state: NetworkState, conn: zbus::Connection) -> Self {
        let (actions_tx, actions_rx) = channel();
        let tree = Tree::new(conn, actions_tx.clone());
        Self {
            state,
            actions_tx,
            actions_rx,
            tree,
        }
    }

    /// Reads the network configuration using the NetworkManager adapter.
    pub async fn from_network_manager(
        conn: zbus::Connection,
    ) -> Result<NetworkSystem, Box<dyn Error>> {
        let adapter = NetworkManagerAdapter::from_system()
            .await
            .expect("Could not connect to NetworkManager to read the configuration.");
        let state = adapter.read()?;
        Ok(Self::new(state, conn))
    }

    /// Writes the network configuration to NetworkManager.
    pub async fn to_network_manager(&mut self) -> Result<(), Box<dyn Error>> {
        let adapter = NetworkManagerAdapter::from_system()
            .await
            .expect("Could not connect to NetworkManager to write the changes.");
        adapter.write(&self.state)?;
        self.state = adapter.read()?;
        Ok(())
    }

    /// Returns a clone of the [Sender](https://doc.rust-lang.org/std/sync/mpsc/struct.Sender.html) to execute
    /// [actions](Action).
    pub fn actions_tx(&self) -> Sender<Action> {
        self.actions_tx.clone()
    }

    /// Populates the D-Bus tree with the known devices and connections.
    pub async fn setup(&mut self) -> Result<(), ServiceError> {
        self.tree
            .set_connections(&self.state.connections)
            .await?;
        self.tree.set_devices(&self.state.devices).await?;
        Ok(())
    }

    /// Process incoming actions.
    ///
    /// This function is expected to be executed on a separate thread.
    pub async fn listen(&mut self) {
        while let Ok(action) = self.actions_rx.recv() {
            if let Err(error) = self.dispatch_action(action).await {
                eprintln!("Could not process the action: {}", error);
            }
        }
    }

    /// Dispatch an action.
    pub async fn dispatch_action(&mut self, action: Action) -> Result<(), Box<dyn Error>> {
        match action {
            Action::AddConnection(name, ty) => {
                let conn = Connection::new(name, ty);
                self.tree.add_connection(&conn).await?;
                self.state.add_connection(conn)?;
            }
            Action::UpdateConnection(conn) => {
                self.state.update_connection(conn)?;
            }
            Action::RemoveConnection(uuid) => {
                self.tree.remove_connection(uuid).await?;
                self.state.remove_connection(uuid)?;
            }
            Action::Apply => {
                self.to_network_manager().await?;
                // TODO: re-creating the tree is kind of brute-force and it sends signals about
                // adding/removing interfaces. We should add/update/delete objects as needed.
                self.tree
                    .set_connections(&self.state.connections)
                    .await?;
            }
        }

        Ok(())
    }
}
