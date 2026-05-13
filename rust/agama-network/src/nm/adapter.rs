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
    types::ConnectionState,
    Adapter, NetworkAdapterError,
};
use anyhow::anyhow;
use async_trait::async_trait;
use core::time;
use std::thread;
use tokio::time::{sleep, Duration, Instant};
use zbus::zvariant::OwnedObjectPath;

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

    async fn activate_connection(
        &self,
        conn: &Connection,
        path: zbus::zvariant::OwnedObjectPath,
    ) -> Result<OwnedObjectPath, NmError> {
        let devices = self.client.devices().await?;
        if let Some(interface) = &conn.interface {
            for device in devices {
                if interface != &device.name {
                    continue;
                }

                if let Some(device_conn) = device.connection {
                    if device_conn != conn.id {
                        tracing::info!(
                            "Disconnecting {} because the connection is {}",
                            &device_conn,
                            &conn.id,
                        );
                        self.client.disconnect_device(device.name).await?;
                    }
                }
            }
        }

        tracing::info!("Activating connection {}", &conn.id);
        self.client.activate_connection(path).await
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

        let mut active_paths = vec![];
        for conn in ordered_connections(network) {
            let ctrl = conn
                .controller
                .and_then(|uuid| network.get_connection_by_uuid(uuid));

            /* Consider the connection as removed, whenever the controller connection
            was removed */
            let is_removed = conn.is_removed() || ctrl.is_some_and(|c| c.is_removed());

            if let Some(old_conn) = old_state.get_connection_by_uuid(conn.uuid) {
                if old_conn == conn && !is_removed {
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

            if is_removed {
                tracing::info!("Deleting connection {} ({})", conn.id, conn.uuid);
                if let Err(e) = self.client.remove_connection(conn.uuid).await {
                    tracing::error!("Could not delete the connection {}: {}", conn.id, &e);
                }
            } else {
                tracing::info!("Updating connection {} ({})", conn.id, conn.uuid);
                let path = match self.client.add_or_update_connection(conn, ctrl).await {
                    Ok(path) => path,
                    Err(e) => {
                        self.client
                            .rollback_checkpoint(&checkpoint.as_ref())
                            .await
                            .map_err(|e| NetworkAdapterError::Checkpoint(anyhow!(e)))?;
                        tracing::error!("Could not process the connection {}: {}", conn.id, &e);

                        return Err(NetworkAdapterError::Write(anyhow!(e)));
                    }
                };

                if conn.is_up() {
                    match self.activate_connection(conn, path).await {
                        Ok(active_path) => {
                            tracing::info!(
                                "Activating connection {} with path {}",
                                &conn.id,
                                &active_path
                            );
                            active_paths.push(active_path);
                        }
                        Err(e) => {
                            tracing::error!("Failed to activate connection {}: {}", &conn.id, e);
                        }
                    }
                } else if conn.is_down() {
                    tracing::info!("Deactivating connection {}", &conn.id);
                    if let Err(e) = self.client.deactivate_connection(path).await {
                        tracing::error!("Failed to deactivate connection {}: {}", &conn.id, e);
                    }
                }
            }
        }

        self.client
            .destroy_checkpoint(&checkpoint.as_ref())
            .await
            .map_err(|e| NetworkAdapterError::Checkpoint(anyhow!(e)))?;

        if !active_paths.is_empty() {
            let start = Instant::now();
            let timeout = Duration::from_secs(30);
            while !active_paths.is_empty() && start.elapsed() < timeout {
                let mut i = 0;
                while i < active_paths.len() {
                    let path = &active_paths[i];
                    match self.client.active_connection_state(path).await {
                        // Finished if state is ACTIVATED or DEACTIVATED
                        Ok(ConnectionState::Activated) => {
                            tracing::info!("The connection for {} was activated", &path);
                            active_paths.remove(i);
                        }
                        Ok(ConnectionState::Deactivated) => {
                            tracing::info!("The connection for {} was deactivated", &path);
                            active_paths.remove(i);
                        }
                        Ok(_) => {
                            i += 1;
                        }
                        Err(e) => {
                            tracing::error!(
                                "Could not get the state of active connection {}: {}",
                                path,
                                e
                            );
                            active_paths.remove(i);
                        }
                    }
                }
                if !active_paths.is_empty() {
                    sleep(Duration::from_millis(500)).await;
                }
            }
        }

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
