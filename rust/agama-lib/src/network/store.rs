// Copyright (c) [2024-2025] SUSE LLC
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

use super::NetworkClientError;
use crate::{
    http::BaseHTTPClient,
    network::{NetworkClient, NetworkSettings},
};
use agama_network::types::NetworkConnectionsCollection;
use agama_utils::api::network::NetworkConnection;

#[derive(Debug, thiserror::Error)]
#[error("Error processing network settings: {0}")]
pub struct NetworkStoreError(#[from] NetworkClientError);

type NetworkStoreResult<T> = Result<T, NetworkStoreError>;

/// Loads and stores the network settings from/to the D-Bus service.
pub struct NetworkStore {
    network_client: NetworkClient,
}

impl NetworkStore {
    pub fn new(client: BaseHTTPClient) -> Self {
        Self {
            network_client: NetworkClient::new(client),
        }
    }

    // TODO: read the settings from the service
    pub async fn load(&self) -> NetworkStoreResult<NetworkSettings> {
        let connections = NetworkConnectionsCollection(self.network_client.connections().await?);

        Ok(NetworkSettings {
            connections,
            ..Default::default()
        })
    }

    pub async fn store(&self, settings: &NetworkSettings) -> NetworkStoreResult<()> {
        let connections = &settings.connections.0;
        for id in ordered_connections(connections) {
            let id = id.as_str();
            let fallback = default_connection(id);
            let conn = find_connection(id, connections).unwrap_or(&fallback);
            self.network_client
                .add_or_update_connection(conn.clone())
                .await?;
        }
        self.network_client.apply().await?;

        Ok(())
    }
}

/// Returns the list of connections in the order they should be written to the D-Bus service.
///
/// * `conns`: connections to write.
fn ordered_connections(conns: &Vec<NetworkConnection>) -> Vec<String> {
    let mut ordered: Vec<String> = Vec::with_capacity(conns.len());
    for conn in conns {
        add_ordered_connection(conn, conns, &mut ordered);
    }
    ordered
}

/// Adds a connections and its dependencies to the list.
///
/// * `conn`: connection to add.
/// * `conns`: existing connections.
/// * `ordered`: ordered list of connections.
fn add_ordered_connection(
    conn: &NetworkConnection,
    conns: &Vec<NetworkConnection>,
    ordered: &mut Vec<String>,
) {
    if let Some(bond) = &conn.bond {
        for port in &bond.ports {
            if let Some(conn) = find_connection(port, conns) {
                add_ordered_connection(conn, conns, ordered);
            } else if !ordered.contains(&conn.id) {
                ordered.push(port.clone());
            }
        }
    }

    if let Some(bridge) = &conn.bridge {
        for port in &bridge.ports {
            if let Some(conn) = find_connection(port, conns) {
                add_ordered_connection(conn, conns, ordered);
            } else if !ordered.contains(&conn.id) {
                ordered.push(port.clone());
            }
        }
    }

    if !ordered.contains(&conn.id) {
        ordered.push(conn.id.to_owned())
    }
}

/// Finds a connection by id in the list.
///
/// * `id`: connection ID.
fn find_connection<'a>(id: &str, conns: &'a [NetworkConnection]) -> Option<&'a NetworkConnection> {
    conns
        .iter()
        .find(|c| c.id == id || c.interface == Some(id.to_string()))
}

fn default_connection(id: &str) -> NetworkConnection {
    NetworkConnection {
        id: id.to_string(),
        interface: Some(id.to_string()),
        ..Default::default()
    }
}

#[cfg(test)]
mod tests {
    use super::ordered_connections;
    use crate::network::{BondSettings, BridgeSettings, NetworkConnection};

    #[test]
    fn test_ordered_connections() {
        let bond = NetworkConnection {
            id: "bond0".to_string(),
            bond: Some(BondSettings {
                ports: vec!["eth0".to_string(), "eth1".to_string(), "eth3".to_string()],
                ..Default::default()
            }),
            ..Default::default()
        };

        let bridge = NetworkConnection {
            id: "br0".to_string(),
            bridge: Some(BridgeSettings {
                ports: vec!["eth0".to_string(), "eth1".to_string(), "eth3".to_string()],
                ..Default::default()
            }),
            ..Default::default()
        };

        let eth0 = NetworkConnection {
            id: "eth0".to_string(),
            ..Default::default()
        };
        let eth1 = NetworkConnection {
            id: "Wired connection".to_string(),
            interface: Some("eth1".to_string()),
            ..Default::default()
        };
        let eth2 = NetworkConnection {
            id: "eth2".to_string(),
            ..Default::default()
        };

        let conns = vec![bond, eth0, eth1, eth2];
        let ordered = ordered_connections(&conns);
        assert_eq!(
            ordered,
            vec![
                "eth0".to_string(),
                "Wired connection".to_string(),
                "eth3".to_string(),
                "bond0".to_string(),
                "eth2".to_string()
            ]
        );

        let conns = vec![bridge];
        let ordered = ordered_connections(&conns);
        assert_eq!(
            ordered,
            vec![
                "eth0".to_string(),
                "eth1".to_string(),
                "eth3".to_string(),
                "br0".to_string()
            ]
        )
    }
}
