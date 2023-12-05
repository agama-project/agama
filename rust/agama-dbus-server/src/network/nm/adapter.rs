use crate::network::{
    model::{Connection, NetworkState},
    nm::NetworkManagerClient,
    Adapter,
};
use agama_lib::error::ServiceError;
use log;
use tokio::{runtime::Handle, task};

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
        !conn.is_loopback()
    }
}

impl<'a> Adapter for NetworkManagerAdapter<'a> {
    fn read(&self) -> Result<NetworkState, Box<dyn std::error::Error>> {
        task::block_in_place(|| {
            Handle::current().block_on(async {
                let devices = self.client.devices().await?;
                let connections = self.client.connections().await?;

                Ok(NetworkState::new(devices, connections))
            })
        })
    }

    fn write(&self, network: &NetworkState) -> Result<(), Box<dyn std::error::Error>> {
        // By now, traits do not support async functions. Using `task::block_on` allows
        // to use 'await'.
        task::block_in_place(|| {
            Handle::current().block_on(async {
                for conn in &network.connections {
                    if !Self::is_writable(conn) {
                        continue;
                    }
                    if conn.is_removed() {
                        if let Err(e) = self.client.remove_connection(conn.uuid()).await {
                            log::error!("Could not remove the connection {}: {}", conn.id(), e);
                        }
                    } else if !conn.is_controlled() {
                        if let Err(e) = self.client.add_or_update_connection(conn).await {
                            log::error!("Could not add/update the connection {}: {}", conn.id(), e);
                        }
                    }
                }
            })
        });
        // FIXME: indicate which connections could not be written.
        Ok(())
    }
}
