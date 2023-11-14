use crate::network::{dbus::Tree, model::Connection, Action, Adapter, NetworkState};
use async_std::channel::{unbounded, Receiver, Sender};
use std::error::Error;

/// Represents the network system using holding the state and setting up the D-Bus tree.
pub struct NetworkSystem<T: Adapter> {
    /// Network state
    pub state: NetworkState,
    /// Side of the channel to send actions.
    actions_tx: Sender<Action>,
    actions_rx: Receiver<Action>,
    tree: Tree,
    /// Adapter to read/write the network state.
    adapter: T,
}

impl<T: Adapter> NetworkSystem<T> {
    pub fn new(conn: zbus::Connection, adapter: T) -> Self {
        let (actions_tx, actions_rx) = unbounded();
        let tree = Tree::new(conn, actions_tx.clone());
        Self {
            state: NetworkState::default(),
            actions_tx,
            actions_rx,
            tree,
            adapter,
        }
    }

    /// Writes the network configuration.
    pub async fn write(&mut self) -> Result<(), Box<dyn Error>> {
        self.adapter.write(&self.state)?;
        self.state = self.adapter.read()?;
        Ok(())
    }

    /// Returns a clone of the [Sender](https://doc.rust-lang.org/std/sync/mpsc/struct.Sender.html) to execute
    /// [actions](Action).
    pub fn actions_tx(&self) -> Sender<Action> {
        self.actions_tx.clone()
    }

    /// Populates the D-Bus tree with the known devices and connections.
    pub async fn setup(&mut self) -> Result<(), Box<dyn Error>> {
        self.state = self.adapter.read()?;
        self.tree
            .set_connections(&mut self.state.connections)
            .await?;
        self.tree.set_devices(&self.state.devices).await?;
        Ok(())
    }

    /// Process incoming actions.
    ///
    /// This function is expected to be executed on a separate thread.
    pub async fn listen(&mut self) {
        while let Ok(action) = self.actions_rx.recv().await {
            if let Err(error) = self.dispatch_action(action).await {
                eprintln!("Could not process the action: {}", error);
            }
        }
    }

    /// Dispatch an action.
    pub async fn dispatch_action(&mut self, action: Action) -> Result<(), Box<dyn Error>> {
        match action {
            Action::AddConnection(name, ty) => {
                let mut conn = Connection::new(name, ty);
                self.tree.add_connection(&mut conn, true).await?;
                self.state.add_connection(conn)?;
            }
            Action::UpdateConnection(conn) => {
                self.state.update_connection(conn)?;
            }
            Action::UpdateControllerConnection(conn, ports) => {
                self.state.update_controller_connection(conn, ports)?;
            }
            Action::RemoveConnection(id) => {
                self.tree.remove_connection(&id).await?;
                self.state.remove_connection(&id)?;
            }
            Action::Apply => {
                self.write().await?;
                // TODO: re-creating the tree is kind of brute-force and it sends signals about
                // adding/removing interfaces. We should add/update/delete objects as needed.
                self.tree
                    .set_connections(&mut self.state.connections)
                    .await?;
            }
        }

        Ok(())
    }
}
