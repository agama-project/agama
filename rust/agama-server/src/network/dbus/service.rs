//! Network D-Bus service.
//!
//! This module defines a D-Bus service which exposes Agama's network configuration.
use crate::network::{Adapter, NetworkSystem};
use std::error::Error;
use zbus::Connection;

/// Represents the Agama networking D-Bus service.
///
/// It is responsible for starting the [NetworkSystem] on a different thread.
/// TODO: this struct might not be needed anymore.
pub struct NetworkService;

impl NetworkService {
    /// Starts listening and dispatching events on the D-Bus connection.
    pub async fn start<T: Adapter + std::marker::Send + 'static>(
        connection: &Connection,
        adapter: T,
    ) -> Result<(), Box<dyn Error>> {
        let network = NetworkSystem::new(connection.clone(), adapter);
        network.start().await?;
        Ok(())
    }
}
