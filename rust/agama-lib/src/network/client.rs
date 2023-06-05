use super::model::NetworkConnection;
use crate::error::ServiceError;

use super::proxies::ConnectionsProxy;
use super::proxies::IPv4Proxy;
use super::proxies::WirelessProxy;
use zbus::Connection;

pub struct NetworkClient<'a> {
    pub connection: Connection,
    connections_proxy: ConnectionsProxy<'a>,
}

impl<'a> NetworkClient<'a> {
    pub async fn new(connection: Connection) -> Result<NetworkClient<'a>, ServiceError> {
        Ok(Self {
            connections_proxy: ConnectionsProxy::new(&connection).await?,
            connection,
        })
    }

    pub async fn connections(&self) -> Result<Vec<NetworkConnection>, ServiceError> {
        let connection_paths = self.connections_proxy.get_connections().await?;
        let connections = connection_paths
            .into_iter()
            .map(|c| NetworkConnection { id: c.to_string() })
            .collect();
        Ok(connections)
    }
}
