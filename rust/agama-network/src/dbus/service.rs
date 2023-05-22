//! Network D-Bus service.
//!
//! This module defines a D-Bus service which exposes Agama's network configuration.
use crate::dbus::Tree;
use crate::{NetworkEvent, NetworkEventCallback, NetworkSystem};
use parking_lot::Mutex;
use std::{error::Error, sync::Arc};

/// Represents the Agama networking D-Bus service
///
/// It is responsible for:
///
/// * Reading the current state.
/// * Publishing the objects in the D-Bus API.
pub struct NetworkService {
    network: Arc<Mutex<NetworkSystem>>,
    tree: Arc<Mutex<Tree>>,
    connection: zbus::Connection,
}

impl NetworkService {
    /// Returns a new service around the given network configuration
    ///
    /// * `state`: network configuration
    /// * `connection`: D-Bus connection to use
    pub fn new(network: NetworkSystem, connection: zbus::Connection) -> Self {
        let network = Arc::new(Mutex::new(network));
        Self {
            tree: Arc::new(Mutex::new(Tree::new(
                connection.clone(),
                Arc::clone(&network),
            ))),
            network,
            connection,
        }
    }

    /// Starts listening on the D-Bus connection
    pub async fn listen(&mut self) -> Result<(), Box<dyn Error>> {
        let mut tree = self.tree.lock();
        tree.populate().await?;
        self.set_events_callback();
        self.connection
            .request_name("org.opensuse.Agama.Network1")
            .await?;
        Ok(())
    }

    fn set_events_callback(&self) {
        let tree = Arc::clone(&self.tree);

        let cb: Arc<NetworkEventCallback> = Arc::new(move |event| {
            async_std::task::block_on(async {
                let mut tree = tree.lock();
                match event {
                    NetworkEvent::AddConnection(conn) => {
                        tree.add_connection(&conn).await.unwrap();
                    }
                    NetworkEvent::RemoveConnection(uuid) => {
                        tree.remove_connection(uuid).await.unwrap();
                    }
                };
            });
        });

        let mut network = self.network.lock();
        network.on_event(Arc::clone(&cb))
    }
}
