use crate::error::ServiceError;
use crate::network::{NetworkClient, NetworkSettings};
use std::error::Error;
use zbus::Connection;

/// Loads and stores the network settings from/to the D-Bus service.
pub struct NetworkStore<'a> {
    network_client: NetworkClient<'a>,
}

impl<'a> NetworkStore<'a> {
    pub async fn new(connection: Connection) -> Result<NetworkStore<'a>, ServiceError> {
        Ok(Self {
            network_client: NetworkClient::new(connection).await?,
        })
    }

    // TODO: read the settings from the service
    pub async fn load(&self) -> Result<NetworkSettings, Box<dyn Error>> {
        let connections = self.network_client.connections().await?;

        Ok(NetworkSettings {
            connections,
            ..Default::default()
        })
    }

    pub async fn store(&self, settings: &NetworkSettings) -> Result<(), Box<dyn Error>> {
        for conn in &settings.connections {
            self.network_client.add_or_update_connection(&conn).await?;
        }

        Ok(())
    }
}
