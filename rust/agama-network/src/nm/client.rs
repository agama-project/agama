//! NetworkManager client.
use super::model::*;
use super::proxies::{ConnectionProxy, DeviceProxy, NetworkManagerProxy, SettingsProxy};
use agama_lib::error::ServiceError;
use std::collections::HashMap;
use zbus::zvariant;
use zbus::Connection;

/// Simplified NetworkManager D-Bus client.
///
/// Implements a minimal API to be used internally. At this point, it allows to query the list of
/// network devices and connections, converting them to its own data types.
pub struct NetworkManagerClient<'a> {
    connection: zbus::Connection,
    nm_proxy: NetworkManagerProxy<'a>,
}

impl<'a> NetworkManagerClient<'a> {
    /// Creates a NetworkManagerClient connecting to the system bus.
    pub async fn from_system() -> Result<NetworkManagerClient<'a>, ServiceError> {
        let connection = zbus::Connection::system().await?;
        Self::new(connection).await
    }

    /// Creates a NetworkManagerClient using the given D-Bus connection.
    ///
    /// * `connection`: D-Bus connection.
    pub async fn new(connection: Connection) -> Result<NetworkManagerClient<'a>, ServiceError> {
        Ok(Self {
            nm_proxy: NetworkManagerProxy::new(&connection).await?,
            connection,
        })
    }

    /// Returns the list of network devices.
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

    /// Returns the list of network connections.
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
            if let Some(connection) = connection_from_dbus(settings) {
                connections.push(connection);
            }
        }
        Ok(connections)
    }
}

fn connection_from_dbus(
    conn: HashMap<String, HashMap<String, zvariant::OwnedValue>>,
) -> Option<NmConnection> {
    let Some(connection) = conn.get("connection") else {
        return None;
    };

    let mut nm_connection = NmConnection::default();
    let id: &str = connection.get("id")?.downcast_ref()?;
    nm_connection.id = id.to_string();

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
            let dns_data = dns_data.downcast_ref::<zbus::zvariant::Array>()?;
            for server in dns_data.get() {
                let server: &str = server.downcast_ref()?;
                nm_ipv4.nameservers.push(server.to_string());
            }
        }

        if let Some(gateway) = ipv4.get("gateway") {
            let gateway: &str = gateway.downcast_ref()?;
            nm_ipv4.gateway = Some(gateway.to_string());
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

#[cfg(test)]
mod test {
    use super::connection_from_dbus;
    use crate::nm::{NmKeyManagement, NmMethod, NmWirelessMode};
    use std::collections::HashMap;
    use zbus::zvariant::{OwnedValue, Value};

    #[test]
    fn test_connection_from_dbus() {
        let connection_section = HashMap::from([("id".to_string(), Value::new("eth0").to_owned())]);

        let address_data = vec![HashMap::from([
            ("address".to_string(), Value::new("192.168.0.10")),
            ("prefix".to_string(), Value::new(24 as u32)),
        ])];

        let ipv4_section = HashMap::from([
            ("method".to_string(), Value::new("auto").to_owned()),
            (
                "address-data".to_string(),
                Value::new(address_data).to_owned(),
            ),
            ("gateway".to_string(), Value::new("192.168.0.1").to_owned()),
            (
                "dns-data".to_string(),
                Value::new(vec!["192.168.0.2"]).to_owned(),
            ),
        ]);

        let dbus_conn = HashMap::from([
            ("connection".to_string(), connection_section),
            ("ipv4".to_string(), ipv4_section),
        ]);

        let nm_connection = connection_from_dbus(dbus_conn).unwrap();

        assert_eq!(nm_connection.id, "eth0");
        let nm_ipv4 = nm_connection.ipv4.unwrap();
        assert_eq!(nm_ipv4.addresses, vec![("192.168.0.10".to_string(), 24)]);
        assert_eq!(nm_ipv4.nameservers, vec!["192.168.0.2"]);
        assert_eq!(nm_ipv4.method, NmMethod("auto".to_string()));
    }

    #[test]
    fn test_connection_from_dbus_missing_connection() {
        let dbus_conn: HashMap<String, HashMap<String, OwnedValue>> = HashMap::new();
        let nm_connection = connection_from_dbus(dbus_conn);
        assert_eq!(nm_connection, None);
    }

    #[test]
    fn test_connection_from_dbus_wireless() {
        let connection_section =
            HashMap::from([("id".to_string(), Value::new("wlan0").to_owned())]);

        let wireless_section = HashMap::from([
            ("mode".to_string(), Value::new("infra").to_owned()),
            (
                "ssid".to_string(),
                Value::new("agama".as_bytes()).to_owned(),
            ),
        ]);

        let security_section =
            HashMap::from([("key-mgmt".to_string(), Value::new("wpa").to_owned())]);

        let dbus_conn = HashMap::from([
            ("connection".to_string(), connection_section),
            ("802-11-wireless".to_string(), wireless_section),
            ("802-11-wireless-security".to_string(), security_section),
        ]);

        let nm_connection = connection_from_dbus(dbus_conn).unwrap();
        let wireless = nm_connection.wireless.unwrap();
        assert_eq!(wireless.ssid, vec![97, 103, 97, 109, 97]);
        assert_eq!(wireless.mode, NmWirelessMode("infra".to_string()));
        assert_eq!(wireless.key_mgmt, NmKeyManagement("wpa".to_string()));
    }
}
