//! Network D-Bus service.
//!
//! This module defines a D-Bus service which exposes Agama's network configuration.
use crate::NetworkSystem;
use agama_lib::connection_to;
use std::{error::Error, thread};

/// Represents the Agama networking D-Bus service.
///
/// It is responsible for starting the [NetworkSystem] on a different thread.
pub struct NetworkService;

impl NetworkService {
    /// Starts listening and dispatching events on the D-Bus connection.
    pub async fn start_service(address: &str) -> Result<(), Box<dyn Error>> {
        let connection = connection_to(address).await?;
        let mut network = NetworkSystem::from_network_manager(connection.clone())
            .await
            .expect("Could not read network state");

        thread::spawn(move || {
            async_std::task::block_on(async {
                network
                    .setup()
                    .await
                    .expect("Could not set up the D-Bus tree");
                connection
                    .request_name("org.opensuse.Agama.Network1")
                    .await
                    .expect("Could not get the 'org.opensuse.Agama.Network1' service");

                network.listen().await;
            })
        });
        Ok(())
    }
}
