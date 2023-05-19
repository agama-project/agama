use crate::{
    error::NetworkStateError, model::Connection, model::Device, nm::NetworkManagerClient,
    NetworkState,
};
use std::error::Error;
use std::sync::Arc;
use uuid::Uuid;

pub type NetworkEventCallback = dyn Fn(NetworkEvent) + Send + Sync;

/// Represents the network system, wrapping a [NetworkState] and adding the concept of events and
/// callbacks.
pub struct NetworkSystem {
    pub state: NetworkState,
    pub callbacks: Vec<Arc<NetworkEventCallback>>,
}

impl NetworkSystem {
    /// Reads the network configuration using the NetworkManager D-Bus service.
    pub async fn from_system() -> Result<Self, Box<dyn Error>> {
        let nm_client = NetworkManagerClient::from_system().await?;
        let devices = nm_client.devices().await?;
        let connections = nm_client.connections().await?;

        let state = NetworkState {
            devices,
            connections,
        };

        Ok(Self {
            state,
            callbacks: vec![],
        })
    }

    pub fn on_event(&mut self, callback: Arc<NetworkEventCallback>) {
        self.callbacks.push(callback);
    }

    pub fn add_connection(&mut self, conn: Connection) -> Result<(), NetworkStateError> {
        let clone = conn.clone();
        self.state.add_connection(conn)?;
        self.notify_event(NetworkEvent::AddConnection(clone));
        Ok(())
    }

    pub fn update_connection(&mut self, conn: Connection) -> Result<(), NetworkStateError> {
        self.state.update_connection(conn)
    }

    pub fn remove_connection(&mut self, uuid: Uuid) -> Result<(), NetworkStateError> {
        self.state.remove_connection(uuid)?;
        self.notify_event(NetworkEvent::RemoveConnection(uuid));
        Ok(())
    }

    /// Get device by name
    ///
    /// * `name`: device name
    pub fn get_device(&self, name: &str) -> Option<&Device> {
        self.state.get_device(name)
    }

    /// Get connection by UUID
    ///
    /// * `uuid`: connection UUID
    pub fn get_connection(&self, uuid: Uuid) -> Option<&Connection> {
        self.state.get_connection(uuid)
    }

    /// Get connection by UUID as mutable
    ///
    /// * `uuid`: connection UUID
    pub fn get_connection_mut(&mut self, uuid: Uuid) -> Option<&mut Connection> {
        self.state.get_connection_mut(uuid)
    }

    fn notify_event(&self, event: NetworkEvent) {
        for cb in &self.callbacks {
            cb(event.clone())
        }
    }
}

#[derive(Debug, Clone)]
pub enum NetworkEvent {
    AddConnection(Connection),
    RemoveConnection(Uuid),
}
