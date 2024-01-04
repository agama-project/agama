use crate::network::{
    model::{Connection, NetworkState},
    nm::NetworkManagerClient,
    Adapter,
};
use agama_lib::error::ServiceError;
use async_trait::async_trait;
use log;

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

#[async_trait]
impl<'a> Adapter for NetworkManagerAdapter<'a> {
    async fn read(&self) -> Result<NetworkState, Box<dyn std::error::Error>> {
        let devices = self.client.devices().await?;
        let connections = self.client.connections().await?;
        Ok(NetworkState::new(devices, connections))
    }

    /// Writes the connections to NetworkManager.
    ///
    /// Internally, it creates an ordered list of connections before processing them. The reason is
    /// that using async recursive functions is giving us some troubles, so we decided to go with a
    /// simpler approach.
    ///
    /// * `network`: network model.
    async fn write(&self, network: &NetworkState) -> Result<(), Box<dyn std::error::Error>> {
        // By now, traits do not support async functions. Using `task::block_on` allows
        // to use 'await'.
        for conn in ordered_connections(network) {
            if !Self::is_writable(conn) {
                continue;
            }

            let result = if conn.is_removed() {
                self.client.remove_connection(conn.uuid).await
            } else {
                let ctrl = conn
                    .controller
                    .and_then(|uuid| network.get_connection_by_uuid(uuid));
                self.client.add_or_update_connection(conn, ctrl).await
            };

            if let Err(e) = result {
                log::error!("Could not process the connection {}: {}", conn.id, e);
            }
        }
        // FIXME: indicate which connections could not be written.
        Ok(())
    }
}

/// Returns the connections in the order they should be processed.
///
/// * `network`: network model.
fn ordered_connections(network: &NetworkState) -> Vec<&Connection> {
    let mut conns: Vec<&Connection> = vec![];
    for conn in &network.connections {
        add_ordered_connections(conn, network, &mut conns);
    }
    conns
}

fn add_ordered_connections<'b>(
    conn: &'b Connection,
    network: &'b NetworkState,
    conns: &mut Vec<&'b Connection>,
) {
    if let Some(uuid) = conn.controller {
        let controller = network.get_connection_by_uuid(uuid).unwrap();
        add_ordered_connections(controller, network, conns);
    }

    if !conns.contains(&conn) {
        conns.push(conn);
    }
}
