use crate::{
    model::{Connection, NetworkState},
    nm::NetworkManagerClient,
    Adapter,
};
use agama_lib::error::ServiceError;

/// An adapter for NetworkManager
pub struct NetworkManagerAdapter<'a> {
    client: NetworkManagerClient<'a>,
}

impl<'a> NetworkManagerAdapter<'a> {
    /// Returns the adapter for system's NetworkManager.
    pub async fn from_system() -> Result<NetworkManagerAdapter<'a>, ServiceError> {
        let client = NetworkManagerClient::from_system().await?;
        Ok(Self { client })
    }

    /// Determines whether the write operation is supported for a connection
    ///
    /// * `conn`: connection
    fn is_writable(conn: &Connection) -> bool {
        match conn {
            Connection::Loopback(_) => false,
            _ => true,
        }
    }
}

impl<'a> Adapter for NetworkManagerAdapter<'a> {
    fn read(&self) -> Result<NetworkState, Box<dyn std::error::Error>> {
        async_std::task::block_on(async {
            let devices = self.client.devices().await?;
            let connections = self.client.connections().await?;

            Ok(NetworkState::new(devices, connections))
        })
    }

    fn write(&self, network: &NetworkState) -> Result<(), Box<dyn std::error::Error>> {
        // By now, traits do not support async functions. Using `task::block_on` allows
        // to use 'await'.
        async_std::task::block_on(async {
            for conn in &network.connections {
                if !Self::is_writable(conn) {
                    continue;
                }
                if conn.is_missing() {
                    if let Err(e) = self.client.remove_connection(conn.uuid()).await {
                        eprintln!("Could not remove the connection {}: {}", conn.uuid(), e);
                    }
                } else {
                    if let Err(e) = self.client.add_or_update_connection(conn).await {
                        eprintln!("Could not add/update the connection {}: {}", conn.uuid(), e);
                    }
                }
            }
        });
        Ok(())
    }
}
