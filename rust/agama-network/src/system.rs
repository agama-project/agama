use crate::{
    error::NetworkStateError, model::Connection, model::Device, nm::NetworkManagerAdapter, Adapter,
    NetworkState,
};
use std::{error::Error, sync::Arc};
use uuid::Uuid;

/// Signature for network events callbacks.
pub type NetworkEventCallback = dyn Fn(NetworkEvent) + Send + Sync;

/// Represents the network system, wrapping a [NetworkState] and adding the concept of events and
/// callbacks.
pub struct NetworkSystem {
    pub state: NetworkState,
    pub callbacks: Vec<Arc<NetworkEventCallback>>,
}

impl NetworkSystem {
    pub fn new(state: NetworkState) -> Self {
        Self {
            state,
            callbacks: vec![],
        }
    }

    /// Reads the network configuration using the NetworkManager adapter.
    pub async fn from_network_manager() -> Result<NetworkSystem, Box<dyn Error>> {
        let adapter = NetworkManagerAdapter::from_system()
            .await
            .expect("Could not connect to NetworkManager to read the configuration.");
        let state = adapter.read()?;
        Ok(Self::new(state))
    }

    /// Writes the network configuration to NetworkManager.
    pub async fn to_network_manager(&self) -> Result<(), Box<dyn Error>> {
        let adapter = NetworkManagerAdapter::from_system()
            .await
            .expect("Could not connect to NetworkManager to write the changes.");
        adapter.write(&self.state)
    }

    /// Registers a callback for network configuration events.
    pub fn on_event(&mut self, callback: Arc<NetworkEventCallback>) {
        self.callbacks.push(callback);
    }

    /// Adds a connection and notifies the event.
    pub fn add_connection(&mut self, conn: Connection) -> Result<(), NetworkStateError> {
        let clone = conn.clone();
        self.state.add_connection(conn)?;
        self.notify_event(NetworkEvent::AddConnection(clone));
        Ok(())
    }

    /// Updates a connection.
    pub fn update_connection(&mut self, conn: Connection) -> Result<(), NetworkStateError> {
        self.state.update_connection(conn)
    }

    /// Removes a connection and notifies the event.
    pub fn remove_connection(&mut self, uuid: Uuid) -> Result<(), NetworkStateError> {
        self.state.remove_connection(uuid)?;
        self.notify_event(NetworkEvent::RemoveConnection(uuid));
        Ok(())
    }

    /// Gets device by name.
    ///
    /// * `name`: device name
    pub fn get_device(&self, name: &str) -> Option<&Device> {
        self.state.get_device(name)
    }

    /// Gets connection by UUID.
    ///
    /// * `uuid`: connection UUID
    pub fn get_connection(&self, uuid: Uuid) -> Option<&Connection> {
        self.state.get_connection(uuid)
    }

    /// Gets connection by UUID as mutable
    ///
    /// * `uuid`: connection UUID
    pub fn get_connection_mut(&mut self, uuid: Uuid) -> Option<&mut Connection> {
        self.state.get_connection_mut(uuid)
    }

    /// Notifies an event to all the subscribers.
    ///
    /// * `event`: network configuration event to notify.
    fn notify_event(&self, event: NetworkEvent) {
        for cb in &self.callbacks {
            cb(event.clone())
        }
    }
}

/// Network configuration event.
///
/// At this point, only adding and removing devices are considered.
#[derive(Debug, Clone)]
pub enum NetworkEvent {
    AddConnection(Connection),
    RemoveConnection(Uuid),
}
