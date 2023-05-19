//! Network D-Bus service.
//!
//! This module defines a D-Bus service which exposes Agama's network configuration.
use crate::dbus::TreeManager;
use crate::model::NetworkState;
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
    state: Arc<Mutex<NetworkState>>,
    tree: TreeManager,
    connection: zbus::Connection,
}

impl NetworkService {
    /// Returns a new service around the given network configuration
    ///
    /// * `state`: network configuration
    /// * `connection`: D-Bus connection to use
    pub fn new(state: NetworkState, connection: zbus::Connection) -> Self {
        let state = Arc::new(Mutex::new(state));
        Self {
            tree: TreeManager::new(connection.clone(), Arc::clone(&state)),
            state,
            connection,
        }
    }

    /// Starts listening on the D-Bus connection
    pub async fn listen(&mut self) -> Result<(), Box<dyn Error>> {
        self.tree.publish().await?;
        self.connection
            .request_name("org.opensuse.Agama.Network1")
            .await?;
        Ok(())
    }
}
