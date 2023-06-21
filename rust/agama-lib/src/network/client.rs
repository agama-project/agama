use super::settings::{NetworkConnection, WirelessSettings};
use super::types::SSID;
use crate::error::ServiceError;

use super::proxies::ConnectionProxy;
use super::proxies::ConnectionsProxy;
use super::proxies::IPv4Proxy;
use super::proxies::WirelessProxy;
use zbus::Connection;

// D-BUS client for the network service
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

    // It returns an array of NetworkConnection using the connections_proxy
    pub async fn connections(&self) -> Result<Vec<NetworkConnection>, ServiceError> {
        let connection_paths = self.connections_proxy.get_connections().await?;
        let mut connections = vec![];

        for path in connection_paths {
            let mut connection = self.connection_from(path.as_str()).await?;

            if let Ok(wireless) = self.wireless_from(path.as_str()).await {
                connection.wireless = Some(wireless);
            }

            connections.push(connection);
        }

        Ok(connections)
    }

    // It returns the NetworkConnection for the given connection path
    //
    //  `path`: the connections path to get the config from
    async fn connection_from(&self, path: &str) -> Result<NetworkConnection, ServiceError> {
        let connection_proxy = ConnectionProxy::builder(&self.connection)
            .path(path)?
            .build()
            .await?;
        let name = connection_proxy.id().await?;

        let ipv4_proxy = IPv4Proxy::builder(&self.connection)
            .path(path)?
            .build()
            .await?;

        // TODO: consider using the `IPMethod` struct from `agama-network`.
        let method = match ipv4_proxy.method().await? {
            0 => "auto",
            1 => "manual",
            2 => "link-local",
            3 => "disable",
            _ => "auto",
        };
        let gateway = match ipv4_proxy.gateway().await?.as_str() {
            "" => None,
            value => Some(value.to_string()),
        };
        let nameservers = ipv4_proxy.nameservers().await?;
        let addresses = ipv4_proxy.addresses().await?;
        let addresses = addresses
            .into_iter()
            .map(|(ip, prefix)| format!("{ip}/{prefix}"))
            .collect();

        Ok(NetworkConnection {
            name,
            method: method.to_string(),
            gateway,
            addresses,
            nameservers,
            ..Default::default()
        })
    }

    // It resturs the [wireless settings][WirelessSettings] for the given connection path
    //  `path`: the connections path to get the wireless config from
    async fn wireless_from(&self, path: &str) -> Result<WirelessSettings, ServiceError> {
        let wireless_proxy = WirelessProxy::builder(&self.connection)
            .path(path)?
            .build()
            .await?;
        let wireless = WirelessSettings {
            mode: wireless_proxy.mode().await?,
            password: wireless_proxy.password().await?,
            security: wireless_proxy.security().await?,
            ssid: SSID(wireless_proxy.ssid().await?).to_string(),
        };

        Ok(wireless)
    }
}
