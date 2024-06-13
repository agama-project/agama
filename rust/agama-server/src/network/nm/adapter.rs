use crate::network::{
    adapter::Watcher,
    model::{Connection, NetworkState, StateConfig},
    nm::{NetworkManagerClient, NetworkManagerWatcher},
    Adapter, NetworkAdapterError,
};
use agama_lib::error::ServiceError;
use async_trait::async_trait;
use core::time;
use log;
use std::thread;

/// An adapter for NetworkManager
pub struct NetworkManagerAdapter<'a> {
    client: NetworkManagerClient<'a>,
    connection: zbus::Connection,
}

impl<'a> NetworkManagerAdapter<'a> {
    /// Returns the adapter for system's NetworkManager.
    pub async fn from_system() -> Result<NetworkManagerAdapter<'a>, ServiceError> {
        let connection = zbus::Connection::system().await?;
        let client = NetworkManagerClient::new(connection.clone()).await?;
        Ok(Self { client, connection })
    }
}

#[async_trait]
impl<'a> Adapter for NetworkManagerAdapter<'a> {
    async fn read(&self, config: StateConfig) -> Result<NetworkState, NetworkAdapterError> {
        let general_state = self
            .client
            .general_state()
            .await
            .map_err(NetworkAdapterError::Read)?;

        let mut state = NetworkState::default();

        if config.general_state {
            state.general_state = general_state.clone();
        }

        if config.devices {
            state.devices = self
                .client
                .devices()
                .await
                .map_err(NetworkAdapterError::Read)?;
        }

        if config.connections {
            state.connections = self
                .client
                .connections()
                .await
                .map_err(NetworkAdapterError::Read)?;
        }

        if config.access_points && general_state.wireless_enabled {
            if !config.devices && !config.connections {
                self.client
                    .request_scan()
                    .await
                    .map_err(NetworkAdapterError::Read)?;
                thread::sleep(time::Duration::from_secs(1));
            };
            state.access_points = self
                .client
                .access_points()
                .await
                .map_err(NetworkAdapterError::Read)?;
        }

        Ok(state)
    }

    /// Writes the connections to NetworkManager.
    ///
    /// Internally, it creates an ordered list of connections before processing them. The reason is
    /// that using async recursive functions is giving us some troubles, so we decided to go with a
    /// simpler approach.
    ///
    /// * `network`: network model.
    async fn write(&self, network: &NetworkState) -> Result<(), NetworkAdapterError> {
        let old_state = self.read(StateConfig::default()).await?;
        let checkpoint = self
            .client
            .create_checkpoint()
            .await
            .map_err(NetworkAdapterError::Checkpoint)?;

        log::info!("Updating the general state {:?}", &network.general_state);

        let result = self
            .client
            .update_general_state(&network.general_state)
            .await;

        if let Err(e) = result {
            self.client
                .rollback_checkpoint(&checkpoint.as_ref())
                .await
                .map_err(NetworkAdapterError::Checkpoint)?;

            log::error!(
                "Could not update the general state {:?}: {}",
                &network.general_state,
                &e
            );
            return Err(NetworkAdapterError::Write(e));
        }

        for conn in ordered_connections(network) {
            if let Some(old_conn) = old_state.get_connection_by_uuid(conn.uuid) {
                if old_conn == conn {
                    continue;
                }
            } else if conn.is_removed() {
                log::info!(
                    "Connection {} ({}) does not need to be removed",
                    conn.id,
                    conn.uuid
                );
                continue;
            }

            log::info!("Updating connection {} ({})", conn.id, conn.uuid);
            let result = if conn.is_removed() {
                self.client.remove_connection(conn.uuid).await
            } else {
                let ctrl = conn
                    .controller
                    .and_then(|uuid| network.get_connection_by_uuid(uuid));
                self.client.add_or_update_connection(conn, ctrl).await
            };

            if let Err(e) = result {
                self.client
                    .rollback_checkpoint(&checkpoint.as_ref())
                    .await
                    .map_err(NetworkAdapterError::Checkpoint)?;
                log::error!("Could not process the connection {}: {}", conn.id, &e);
                return Err(NetworkAdapterError::Write(e));
            }
        }

        self.client
            .destroy_checkpoint(&checkpoint.as_ref())
            .await
            .map_err(NetworkAdapterError::Checkpoint)?;
        Ok(())
    }

    fn watcher(&self) -> Option<Box<dyn Watcher + Send>> {
        Some(Box::new(NetworkManagerWatcher::new(&self.connection)))
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
