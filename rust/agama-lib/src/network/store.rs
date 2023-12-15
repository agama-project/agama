use super::settings::NetworkConnection;
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
        for id in ordered_connections(&settings.connections) {
            let id = id.as_str();
            let fallback = default_connection(id);
            let conn = find_connection(id, &settings.connections).unwrap_or(&fallback);
            self.network_client.add_or_update_connection(conn).await?;
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
    use crate::network::settings::{BondSettings, NetworkConnection};

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
        )
    }
}
