use crate::error::ServiceError;
use crate::network::{NetworkClient, NetworkSettings};
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
    pub async fn load(&self) -> Result<NetworkSettings, ServiceError> {
        let connections = self.network_client.connections().await?;

        Ok(NetworkSettings { connections })
    }

    pub async fn store(&self, settings: &NetworkSettings) -> Result<(), ServiceError> {
        for conn in &settings.connections {
            self.network_client.add_or_update_connection(conn).await?;
        }
        self.network_client.apply().await?;

        Ok(())
    }
}
