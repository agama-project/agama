use super::settings::{NetworkConnection, WirelessSettings};
use super::types::SSID;
use crate::error::ServiceError;

use super::proxies::{ConnectionProxy, ConnectionsProxy, IPv4Proxy, WirelessProxy};
use async_std::stream::StreamExt;
use zbus::zvariant::OwnedObjectPath;
use zbus::Connection;

/// D-BUS client for the network service
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

    /// Returns an array of network connections
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

    /// Applies the network configuration.
    pub async fn apply(&self) -> Result<(), ServiceError> {
        self.connections_proxy.apply().await?;
        Ok(())
    }

    /// Returns the NetworkConnection for the given connection path
    ///
    ///  * `path`: the connections path to get the config from
    async fn connection_from(&self, path: &str) -> Result<NetworkConnection, ServiceError> {
        let connection_proxy = ConnectionProxy::builder(&self.connection)
            .path(path)?
            .build()
            .await?;
        let id = connection_proxy.id().await?;

        let ipv4_proxy = IPv4Proxy::builder(&self.connection)
            .path(path)?
            .build()
            .await?;

        let method = ipv4_proxy.method().await?;
        let gateway = match ipv4_proxy.gateway().await?.as_str() {
            "" => None,
            value => Some(value.to_string()),
        };
        let nameservers = ipv4_proxy.nameservers().await?;
        let addresses = ipv4_proxy.addresses().await?;

        Ok(NetworkConnection {
            id,
            method: Some(method.to_string()),
            gateway,
            addresses,
            nameservers,
            ..Default::default()
        })
    }

    /// Returns the [wireless settings][WirelessSettings] for the given connection
    ///
    ///  * `path`: the connections path to get the wireless config from
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

    /// Adds or updates a network connection.
    ///
    /// If a network connection with the same name exists, it updates its settings. Otherwise, it
    /// adds a new connection.
    ///
    /// * `conn`: settings of the network connection to add/update.
    pub async fn add_or_update_connection(
        &self,
        conn: &NetworkConnection,
    ) -> Result<(), ServiceError> {
        let path = match self.connections_proxy.get_connection(&conn.id).await {
            Ok(path) => path,
            Err(_) => self.add_connection(conn).await?,
        };
        self.update_connection(&path, conn).await?;
        Ok(())
    }

    /// Adds a network connection.
    ///
    /// * `conn`: settings of the network connection to add.
    async fn add_connection(
        &self,
        conn: &NetworkConnection,
    ) -> Result<OwnedObjectPath, ServiceError> {
        let mut stream = self.connections_proxy.receive_connection_added().await?;

        self.connections_proxy
            .add_connection(&conn.id, conn.device_type() as u8)
            .await?;

        loop {
            let signal = stream.next().await.unwrap();
            let (id, _path): (String, String) = signal.body().unwrap();
            if id == conn.id {
                break;
            };
        }

        Ok(self.connections_proxy.get_connection(&conn.id).await?)
    }

    /// Updates a network connection.
    ///
    /// * `path`: connection D-Bus path.
    /// * `conn`: settings of the network connection.
    async fn update_connection(
        &self,
        path: &OwnedObjectPath,
        conn: &NetworkConnection,
    ) -> Result<(), ServiceError> {
        let proxy = IPv4Proxy::builder(&self.connection)
            .path(path)?
            .build()
            .await?;

        if let Some(ref method) = conn.method {
            proxy.set_method(method.as_str()).await?;
        }

        let addresses: Vec<_> = conn.addresses.iter().map(String::as_ref).collect();
        proxy.set_addresses(addresses.as_slice()).await?;

        let nameservers: Vec<_> = conn.nameservers.iter().map(String::as_ref).collect();
        proxy.set_nameservers(nameservers.as_slice()).await?;

        let gateway = conn.gateway.as_deref().unwrap_or("");
        proxy.set_gateway(gateway).await?;

        if let Some(ref wireless) = conn.wireless {
            self.update_wireless_settings(path, wireless).await?;
        }
        Ok(())
    }

    /// Updates the wireless settings for network connection.
    ///
    /// * `path`: connection D-Bus path.
    /// * `wireless`: wireless settings of the network connection.
    async fn update_wireless_settings(
        &self,
        path: &OwnedObjectPath,
        wireless: &WirelessSettings,
    ) -> Result<(), ServiceError> {
        let proxy = WirelessProxy::builder(&self.connection)
            .path(path)?
            .build()
            .await?;

        proxy.set_ssid(wireless.ssid.as_bytes()).await?;
        proxy.set_mode(wireless.mode.to_string().as_str()).await?;
        proxy
            .set_security(wireless.security.to_string().as_str())
            .await?;
        proxy.set_password(&wireless.password).await?;
        Ok(())
    }

    // Replace with a better implemenation based on signals.
    // async fn wait_for_connection(&self, id: &str) -> Result<OwnedObjectPath, ServiceError> {
    //     loop {
    //         let mut retries = 0;
    //         match self.connections_proxy.get_connection(&id).await {
    //             Ok(path) => return Ok(path),
    //             Err(e) => {
    //                 retries += 1;
    //                 if retries > 3 {
    //                     return Err(e.into());
    //                 };
    //             }
    //         }
    //     }
    // }
}
