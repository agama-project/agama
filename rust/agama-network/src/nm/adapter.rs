// Copyright (c) [2024] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

use crate::{
    adapter::Watcher,
    model::{Connection, NetworkState, StateConfig},
    nm::{NetworkManagerClient, NetworkManagerWatcher},
    Adapter, NetworkAdapterError,
};
use anyhow::anyhow;
use async_trait::async_trait;
use core::time;
use std::thread;

use super::error::NmError;

/// An adapter for NetworkManager
pub struct NetworkManagerAdapter<'a> {
    client: NetworkManagerClient<'a>,
    connection: zbus::Connection,
}

impl<'a> NetworkManagerAdapter<'a> {
    /// Returns the adapter for system's NetworkManager.
    pub async fn from_system() -> Result<NetworkManagerAdapter<'a>, NmError> {
        let connection = zbus::Connection::system().await?;
        let client = NetworkManagerClient::new(connection.clone()).await?;

        Ok(Self { client, connection })
    }
}

#[async_trait]
impl Adapter for NetworkManagerAdapter<'_> {
    async fn read(&self, config: StateConfig) -> Result<NetworkState, NetworkAdapterError> {
        let general_state = self
            .client
            .general_state()
            .await
            .map_err(|e| NetworkAdapterError::Read(anyhow!(e)))?;

        let mut state = NetworkState::default();

        if config.general_state {
            state.general_state = general_state.clone();
        }

        if config.devices {
            state.devices = self
                .client
                .devices()
                .await
                .map_err(|e| NetworkAdapterError::Read(anyhow!(e)))?;
        }

        if config.connections {
            state.connections = self
                .client
                .connections()
                .await
                .map_err(|e| NetworkAdapterError::Read(anyhow!(e)))?;
        }

        if config.access_points && general_state.wireless_enabled {
            if !config.devices && !config.connections {
                self.client
                    .request_scan()
                    .await
                    .map_err(|e| NetworkAdapterError::Read(anyhow!(e)))?;
                thread::sleep(time::Duration::from_secs(1));
            };
            state.access_points = self
                .client
                .access_points()
                .await
                .map_err(|e| NetworkAdapterError::Read(anyhow!(e)))?;
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
            .map_err(|e| NetworkAdapterError::Checkpoint(anyhow!(e)))?;

        tracing::info!("Updating the general state {:?}", &network.general_state);
        let result = self
            .client
            .update_general_state(&network.general_state)
            .await;

        if let Err(e) = result {
            self.client
                .rollback_checkpoint(&checkpoint.as_ref())
                .await
                .map_err(|e| NetworkAdapterError::Checkpoint(anyhow!(e)))?;

            tracing::error!(
                "Could not update the general state {:?}: {}",
                &network.general_state,
                &e
            );

            return Err(NetworkAdapterError::Write(anyhow!(e)));
        }

        for conn in ordered_connections(network) {
            let ctrl = conn
                .controller
                .and_then(|uuid| network.get_connection_by_uuid(uuid));

            /* Consider the connection as removed, whenever the controller connection
            was removed */
            let is_removed = conn.is_removed() || ctrl.is_some_and(|c| c.is_removed());

            if let Some(old_conn) = old_state.get_connection_by_uuid(conn.uuid) {
                if old_conn == conn {
                    tracing::info!(
                        "No change detected for connection {} ({})",
                        conn.id,
                        conn.uuid
                    );
                    continue;
                }
            } else if is_removed {
                tracing::info!(
                    "Connection {} ({}) does not need to be removed",
                    conn.id,
                    conn.uuid
                );
                continue;
            }

            let result = if is_removed {
                tracing::info!("Deleting connection {} ({})", conn.id, conn.uuid);
                self.client.remove_connection(conn.uuid).await
            } else {
                tracing::info!("Updating connection {} ({})", conn.id, conn.uuid);
                self.client.add_or_update_connection(conn, ctrl).await
            };

            if let Err(e) = result {
                self.client
                    .rollback_checkpoint(&checkpoint.as_ref())
                    .await
                    .map_err(|e| NetworkAdapterError::Checkpoint(anyhow!(e)))?;
                tracing::error!("Could not process the connection {}: {}", conn.id, &e);

                return Err(NetworkAdapterError::Write(anyhow!(e)));
            }
        }

        self.client
            .destroy_checkpoint(&checkpoint.as_ref())
            .await
            .map_err(|e| NetworkAdapterError::Checkpoint(anyhow!(e)))?;
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
        if let Some(controller) = network.get_connection_by_uuid(uuid) {
            add_ordered_connections(controller, network, conns);
        } else {
            tracing::error!("Could not found the controller {}", &uuid);
        }
    }

    if !conns.contains(&conn) {
        conns.push(conn);
    }
}
