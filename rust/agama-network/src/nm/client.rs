use super::model::*;
use super::proxies::{ConnectionProxy, DeviceProxy, NetworkManagerProxy, SettingsProxy};
use agama_lib::error::ServiceError;
use std::collections::HashMap;
use zbus::zvariant::{self, OwnedValue};
use zbus::Connection;

/// Simplified NetworkManager D-Bus client
///
/// Implements a minimal API to be used internally.
pub struct NetworkManagerClient<'a> {
    connection: zbus::Connection,
    nm_proxy: NetworkManagerProxy<'a>,
}

impl<'a> NetworkManagerClient<'a> {
    /// Creates a NetworkManagerClient connecting to the system bus
    pub async fn from_system() -> Result<NetworkManagerClient<'a>, ServiceError> {
        let connection = zbus::Connection::system().await?;
        Self::new(connection).await
    }

    /// Creates a NetworkManagerClient using the given D-Bus connection
    ///
    /// * `connection`: D-Bus connection
    pub async fn new(connection: Connection) -> Result<NetworkManagerClient<'a>, ServiceError> {
        Ok(Self {
            nm_proxy: NetworkManagerProxy::new(&connection).await?,
            connection,
        })
    }

    /// Returns the list of network devices
    pub async fn devices(&self) -> Result<Vec<NmDevice>, ServiceError> {
        let mut devs = vec![];
        for path in &self.nm_proxy.get_devices().await? {
            let proxy = DeviceProxy::builder(&self.connection)
                .path(path.as_str())?
                .build()
                .await?;

            devs.push(NmDevice {
                path: path.to_string(),
                iface: proxy.interface().await?,
                device_type: NmDeviceType(proxy.device_type().await?),
            });
        }

        Ok(devs)
    }

    pub async fn connections(&self) -> Result<Vec<NmConnection>, ServiceError> {
        let proxy = SettingsProxy::new(&self.connection).await?;
        let paths = proxy.list_connections().await?;
        let mut connections = vec![];
        for path in paths {
            let proxy = ConnectionProxy::builder(&self.connection)
                .path(path.as_str())?
                .build()
                .await?;
            let settings = proxy.get_settings().await?;
            if let Some(connection) = self.connection_from_dbus(settings) {
                connections.push(connection);
            }
        }
        Ok(connections)
    }

    /// Returns the applied connection to a given device
    ///
    /// NOTE: at this point we are using the D-Bus path as some kind of identifier. It might change
    /// if we add support for another backend.
    pub async fn applied_connection(&self, path: &str) -> Result<NmConnection, ServiceError> {
        let proxy = DeviceProxy::builder(&self.connection)
            .path(path)?
            .build()
            .await?;

        let conn = proxy.get_applied_connection(0).await?;
        self.connection_from_dbus(conn.0)
            .ok_or(ServiceError::MissingData)
    }

    fn connection_from_dbus(
        &self,
        conn: HashMap<String, HashMap<String, zvariant::OwnedValue>>,
    ) -> Option<NmConnection> {
        let mut nm_connection = NmConnection::default();

        if let Some(connection) = conn.get("connection") {
            let id: &str = connection.get("id")?.downcast_ref()?;
            nm_connection.id = id.to_string();
        }

        if let Some(ipv4) = conn.get("ipv4") {
            let method: &str = ipv4.get("method")?.downcast_ref()?;
            let address_data = ipv4.get("address-data")?;
            let address_data = address_data.downcast_ref::<zbus::zvariant::Array>()?;
            let mut addresses: Vec<(String, u32)> = vec![];
            for addr in address_data.get() {
                let dict = addr.downcast_ref::<zvariant::Dict>()?;
                let map = <HashMap<String, zvariant::Value<'_>>>::try_from(dict.clone()).unwrap();
                let addr_str: &str = map.get("address")?.downcast_ref()?;
                let prefix: &u32 = map.get("prefix")?.downcast_ref()?;
                addresses.push((addr_str.to_string(), *prefix))
            }
            let mut nm_ipv4 = NmIp4Config {
                method: NmMethod(method.to_string()),
                addresses,
                ..Default::default()
            };

            if let Some(dns_data) = ipv4.get("dns-data") {
                dbg!(&dns_data);
                let dns_data = dns_data.downcast_ref::<zbus::zvariant::Array>()?;
                for server in dns_data.get() {
                    let server: &str = server.downcast_ref()?;
                    nm_ipv4.nameservers.push(server.to_string());
                }
            }
            nm_connection.ipv4 = Some(nm_ipv4);
        }

        if let Some(wireless) = conn.get("802-11-wireless") {
            let mode: &str = wireless.get("mode")?.downcast_ref()?;
            let ssid = wireless.get("ssid")?;
            let ssid: &zvariant::Array = ssid.downcast_ref()?;
            let ssid: Vec<u8> = ssid
                .get()
                .iter()
                .map(|u| *u.downcast_ref::<u8>().unwrap())
                .collect();
            let mut wireless_settings = NmWireless {
                mode: mode.into(),
                ssid,
                ..Default::default()
            };

            if let Some(security) = conn.get("802-11-wireless-security") {
                let key_mgmt: &str = security.get("key-mgmt")?.downcast_ref()?;
                wireless_settings.key_mgmt = key_mgmt.into();
            }

            nm_connection.wireless = Some(wireless_settings);
        }

        Some(nm_connection)
    }
}
