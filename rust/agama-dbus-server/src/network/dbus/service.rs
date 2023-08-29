//! Network D-Bus service.
//!
//! This module defines a D-Bus service which exposes Agama's network configuration.
use crate::network::{Adapter, NetworkSystem};
use agama_lib::connection_to;
use std::error::Error;

/// Represents the Agama networking D-Bus service.
///
/// It is responsible for starting the [NetworkSystem] on a different thread.
pub struct NetworkService;

impl NetworkService {
    /// Starts listening and dispatching events on the D-Bus connection.
    pub async fn start<T: Adapter + std::marker::Send + 'static>(
        address: &str,
        adapter: T,
    ) -> Result<(), Box<dyn Error>> {
        const SERVICE_NAME: &str = "org.opensuse.Agama.Network1";

        let connection = connection_to(address).await?;
        let mut network = NetworkSystem::new(connection.clone(), adapter);

        async_std::task::spawn(async move {
            network
                .setup()
                .await
                .expect("Could not set up the D-Bus tree");
            connection
                .request_name(SERVICE_NAME)
                .await
                .unwrap_or_else(|_| panic!("Could not request name {SERVICE_NAME}"));

            network.listen().await;
        });
        Ok(())
    }
}
