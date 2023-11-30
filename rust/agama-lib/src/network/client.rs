use super::proxies::{
    BondProxy, ConnectionProxy, ConnectionsProxy, DeviceProxy, DevicesProxy, IPProxy, MatchProxy,
    WirelessProxy,
};
use super::settings::{BondSettings, MatchSettings, NetworkConnection, WirelessSettings};
use super::types::{Device, DeviceType, SSID};
use crate::error::ServiceError;
use tokio_stream::StreamExt;
use zbus::zvariant::OwnedObjectPath;
use zbus::Connection;

/// D-BUS client for the network service
pub struct NetworkClient<'a> {
    pub connection: Connection,
    connections_proxy: ConnectionsProxy<'a>,
    devices_proxy: DevicesProxy<'a>,
}

impl<'a> NetworkClient<'a> {
    pub async fn new(connection: Connection) -> Result<NetworkClient<'a>, ServiceError> {
        Ok(Self {
            connections_proxy: ConnectionsProxy::new(&connection).await?,
            devices_proxy: DevicesProxy::new(&connection).await?,
            connection,
        })
    }

    pub async fn get_connection(&self, id: &str) -> Result<NetworkConnection, ServiceError> {
        let path = self.connections_proxy.get_connection(id).await?;
        Ok(self.connection_from(path.as_str()).await?)
    }

    pub async fn available_devices(&self) -> Result<Vec<Device>, ServiceError> {
        let devices_paths = self.devices_proxy.get_devices().await?;
        let mut devices = vec![];

        for path in devices_paths {
            let device = self.device_from(path.as_str()).await?;

            devices.push(device);
        }

        Ok(devices)
    }

    /// Returns an array of network connections
    pub async fn connections(&self) -> Result<Vec<NetworkConnection>, ServiceError> {
        let connection_paths = self.connections_proxy.get_connections().await?;
        let mut connections = vec![];

        for path in connection_paths {
            let mut connection = self.connection_from(path.as_str()).await?;

            if let Ok(bond) = self.bond_from(path.as_str()).await {
                connection.bond = Some(bond);
            }

            if let Ok(wireless) = self.wireless_from(path.as_str()).await {
                connection.wireless = Some(wireless);
            }

            let match_settings = self.match_settings_from(path.as_str()).await?;
            if !match_settings.is_empty() {
                connection.match_settings = Some(match_settings);
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

    /// Returns the NetworkDevice for the given device path
    ///
    ///  * `path`: the connections path to get the config from
    async fn device_from(&self, path: &str) -> Result<Device, ServiceError> {
        let device_proxy = DeviceProxy::builder(&self.connection)
            .path(path)?
            .build()
            .await?;
        let name = device_proxy.name().await?;
        let device_type = device_proxy.type_().await?;

        Ok(Device {
            name,
            type_: DeviceType::try_from(device_type).unwrap(),
        })
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
        let interface = match connection_proxy.interface().await?.as_str() {
            "" => None,
            value => Some(value.to_string()),
        };

        let ip_proxy = IPProxy::builder(&self.connection)
            .path(path)?
            .build()
            .await?;

        let method4 = ip_proxy.method4().await?;
        let gateway4 = ip_proxy.gateway4().await?.parse().ok();
        let method6 = ip_proxy.method6().await?;
        let gateway6 = ip_proxy.gateway6().await?.parse().ok();
        let nameservers = ip_proxy.nameservers().await?;
        let nameservers = nameservers.iter().filter_map(|a| a.parse().ok()).collect();
        let addresses = ip_proxy.addresses().await?;
        let addresses = addresses.iter().filter_map(|a| a.parse().ok()).collect();

        Ok(NetworkConnection {
            id,
            method4: Some(method4.to_string()),
            gateway4,
            method6: Some(method6.to_string()),
            gateway6,
            addresses,
            nameservers,
            interface,
            ..Default::default()
        })
    }

    /// Returns the [bond settings][BondSettings] for the given connection
    ///
    ///  * `path`: the connections path to get the wireless config from
    async fn bond_from(&self, path: &str) -> Result<BondSettings, ServiceError> {
        let bond_proxy = BondProxy::builder(&self.connection)
            .path(path)?
            .build()
            .await?;
        let bond = BondSettings {
            mode: bond_proxy.mode().await?,
            options: Some(bond_proxy.options().await?),
            ports: bond_proxy.ports().await?,
        };

        Ok(bond)
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

    /// Returns the [match settings][MatchSettings] for the given connection
    ///
    ///  * `path`: the connections path to get the match settings from
    async fn match_settings_from(&self, path: &str) -> Result<MatchSettings, ServiceError> {
        let match_proxy = MatchProxy::builder(&self.connection)
            .path(path)?
            .build()
            .await?;
        let match_settings = MatchSettings {
            path: match_proxy.path().await?,
            kernel: match_proxy.kernel().await?,
            interface: match_proxy.interface().await?,
            driver: match_proxy.driver().await?,
        };
        Ok(match_settings)
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
            let (id, _path): (String, OwnedObjectPath) = signal.body().unwrap();
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
        let proxy = ConnectionProxy::builder(&self.connection)
            .path(path)?
            .build()
            .await?;

        let interface = conn.interface.as_deref().unwrap_or("");
        proxy.set_interface(interface).await?;

        self.update_ip_settings(path, conn).await?;

        if let Some(ref bond) = conn.bond {
            self.update_bond_settings(path, bond).await?;
        }

        if let Some(ref wireless) = conn.wireless {
            self.update_wireless_settings(path, wireless).await?;
        }

        if let Some(ref match_settings) = conn.match_settings {
            self.update_match_settings(path, match_settings).await?;
        }

        Ok(())
    }

    /// Updates the IPv4 setttings for the network connection.
    ///
    /// * `path`: connection D-Bus path.
    /// * `conn`: network connection.
    async fn update_ip_settings(
        &self,
        path: &OwnedObjectPath,
        conn: &NetworkConnection,
    ) -> Result<(), ServiceError> {
        let proxy = IPProxy::builder(&self.connection)
            .path(path)?
            .build()
            .await?;

        if let Some(ref method) = conn.method4 {
            proxy.set_method4(method.as_str()).await?;
        }

        if let Some(ref method) = conn.method6 {
            proxy.set_method6(method.as_str()).await?;
        }

        let addresses: Vec<_> = conn.addresses.iter().map(|a| a.to_string()).collect();
        let addresses: Vec<&str> = addresses.iter().map(|a| a.as_str()).collect();
        proxy.set_addresses(&addresses).await?;

        let nameservers: Vec<_> = conn.nameservers.iter().map(|a| a.to_string()).collect();
        let nameservers: Vec<_> = nameservers.iter().map(|a| a.as_str()).collect();
        proxy.set_nameservers(&nameservers).await?;

        let gateway = conn.gateway4.map_or(String::from(""), |g| g.to_string());
        proxy.set_gateway4(&gateway).await?;

        let gateway = conn.gateway6.map_or(String::from(""), |g| g.to_string());
        proxy.set_gateway6(&gateway).await?;

        Ok(())
    }

    /// Updates the bond settings for network connection.
    ///
    /// * `path`: connection D-Bus path.
    /// * `bond`: bond settings of the network connection.
    async fn update_bond_settings(
        &self,
        path: &OwnedObjectPath,
        bond: &BondSettings,
    ) -> Result<(), ServiceError> {
        let proxy = BondProxy::builder(&self.connection)
            .path(path)?
            .build()
            .await?;

        let ports: Vec<_> = bond.ports.iter().map(String::as_ref).collect();
        proxy.set_ports(ports.as_slice()).await?;
        if let Some(ref options) = bond.options {
            proxy.set_options(options.to_string().as_str()).await?;
        }
        proxy.set_mode(bond.mode.as_str()).await?;

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

    /// Updates the match settings for network connection.
    ///
    /// * `path`: connection D-Bus path.
    /// * `match_settings`: match settings of the network connection.
    async fn update_match_settings(
        &self,
        path: &OwnedObjectPath,
        match_settings: &MatchSettings,
    ) -> Result<(), ServiceError> {
        let proxy = MatchProxy::builder(&self.connection)
            .path(path)?
            .build()
            .await?;

        let paths: Vec<_> = match_settings.path.iter().map(String::as_ref).collect();
        proxy.set_path(paths.as_slice()).await?;

        Ok(())
    }
}
