use crate::network::{
    error::NetworkStateError,
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

    /// Writes the connections to NetworkManager.
    ///
    /// Internally, it creates and order list of connections before processing them. The reason is
    /// that using async recursive functions is giving us some troubles, so we decided to go with a
    /// simpler approach.
    ///
    /// * `network`: network model.
    async fn write_connections(&self, network: &NetworkState) {
        let conns = self.ordered_connections(&network);
        println!("Connections to write: {:?}", &conns);

        for conn in &conns {
            let result = if conn.is_removed() {
                self.client.remove_connection(conn.uuid()).await
            } else {
                let ctrl = conn.controller().and_then(|id| network.get_connection(&id));
                self.client.add_or_update_connection(&conn, ctrl).await
            };

            if let Err(e) = result {
                log::error!("Could not process the connection {}: {}", conn.id(), e);
            }
        }
    }

    /// Returns the connections in the order they should be processed.
    /// * `network`: network model.
    ///
    fn ordered_connections<'b>(&self, network: &'b NetworkState) -> Vec<&'b Connection> {
        let mut conns: Vec<&Connection> = vec![];
        for conn in &network.connections {
            if !conn.is_controlled() {
                self.add_ordered_connections(conn, network, &mut conns);
            }
        }
        conns
    }

    fn add_ordered_connections<'b>(
        &self,
        conn: &'b Connection,
        network: &'b NetworkState,
        conns: &mut Vec<&'b Connection>,
    ) {
        conns.push(conn);

        if let Connection::Bond(bond) = &conn {
            for port in &bond.bond.ports {
                if let Some(port_connection) = network.get_connection(port.as_str()) {
                    self.add_ordered_connections(port_connection, network, conns);
                }
            }
        }
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
                    self.write_connections(network).await;
                }
            })
        });
        // FIXME: indicate which connections could not be written.
        Ok(())
    }
}
