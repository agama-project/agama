use super::model::*;
use crate::model::*;
use std::collections::HashMap;
use std::net::Ipv4Addr;
use zbus::zvariant;

/// Converts a HashMap from D-Bus into a Connection
///
/// Working with hash maps coming from D-Bus is rather tedious and it is even worse when working
/// with nested hash maps. This functions tries to turn a HashMap coming from D-Bus into a
/// Connection.
pub fn connection_from_dbus(
    conn: HashMap<String, HashMap<String, zvariant::OwnedValue>>,
) -> Option<Connection> {
    let base_connection = base_connection_from_dbus(&conn)?;

    if let Some(wireless_config) = wireless_config_from_dbus(&conn) {
        return Some(Connection::Wireless(WirelessConnection {
            base: base_connection,
            wireless: wireless_config,
        }));
    }

    Some(Connection::Ethernet(EthernetConnection {
        base: base_connection,
    }))
}

fn base_connection_from_dbus(
    conn: &HashMap<String, HashMap<String, zvariant::OwnedValue>>,
) -> Option<BaseConnection> {
    let Some(connection) = conn.get("connection") else {
        return None;
    };

    let mut base_connection = BaseConnection::default();
    let id: &str = connection.get("id")?.downcast_ref()?;
    base_connection.id = id.to_string();
    if let Some(ipv4) = conn.get("ipv4") {
        base_connection.ipv4 = ipv4_config_from_dbus(ipv4)?;
    }

    Some(base_connection)
}

fn ipv4_config_from_dbus(ipv4: &HashMap<String, zvariant::OwnedValue>) -> Option<Ipv4Config> {
    let method: &str = ipv4.get("method")?.downcast_ref()?;
    let address_data = ipv4.get("address-data")?;
    let address_data = address_data.downcast_ref::<zbus::zvariant::Array>()?;
    let mut addresses: Vec<(Ipv4Addr, u32)> = vec![];
    for addr in address_data.get() {
        let dict = addr.downcast_ref::<zvariant::Dict>()?;
        let map = <HashMap<String, zvariant::Value<'_>>>::try_from(dict.clone()).unwrap();
        let addr_str: &str = map.get("address")?.downcast_ref()?;
        let prefix: &u32 = map.get("prefix")?.downcast_ref()?;
        addresses.push((addr_str.parse().unwrap(), *prefix))
    }
    let mut ipv4_config = Ipv4Config {
        method: NmMethod(method.to_string()).into(),
        addresses,
        ..Default::default()
    };

    if let Some(dns_data) = ipv4.get("dns-data") {
        let dns_data = dns_data.downcast_ref::<zbus::zvariant::Array>()?;
        for server in dns_data.get() {
            let server: &str = server.downcast_ref()?;
            ipv4_config.nameservers.push(server.parse().unwrap());
        }
    }

    if let Some(gateway) = ipv4.get("gateway") {
        let gateway: &str = gateway.downcast_ref()?;
        ipv4_config.gateway = Some(gateway.parse().unwrap());
    }

    Some(ipv4_config)
}

fn wireless_config_from_dbus(
    conn: &HashMap<String, HashMap<String, zvariant::OwnedValue>>,
) -> Option<WirelessConfig> {
    let Some(wireless) = conn.get("802-11-wireless") else {
        return None;
    };

    let mode: &str = wireless.get("mode")?.downcast_ref()?;
    let ssid = wireless.get("ssid")?;
    let ssid: &zvariant::Array = ssid.downcast_ref()?;
    let ssid: Vec<u8> = ssid
        .get()
        .iter()
        .map(|u| *u.downcast_ref::<u8>().unwrap())
        .collect();
    let mut wireless_config = WirelessConfig {
        mode: NmWirelessMode(mode.to_string()).into(),
        ssid,
        ..Default::default()
    };

    if let Some(security) = conn.get("802-11-wireless-security") {
        let key_mgmt: &str = security.get("key-mgmt")?.downcast_ref()?;
        wireless_config.security = NmKeyManagement(key_mgmt.to_string()).into();
    }

    Some(wireless_config)
}

#[cfg(test)]
mod test {
    use super::connection_from_dbus;
    use crate::model::*;
    use std::{collections::HashMap, net::Ipv4Addr};
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

        let connection = connection_from_dbus(dbus_conn).unwrap();

        assert_eq!(connection.name(), "eth0");
        let ipv4 = connection.ipv4();
        assert_eq!(ipv4.addresses, vec![(Ipv4Addr::new(192, 168, 0, 10), 24)]);
        assert_eq!(ipv4.nameservers, vec![Ipv4Addr::new(192, 168, 0, 2)]);
        assert_eq!(ipv4.method, IpMethod::Auto);
    }

    #[test]
    fn test_connection_from_dbus_missing_connection() {
        let dbus_conn: HashMap<String, HashMap<String, OwnedValue>> = HashMap::new();
        let connection = connection_from_dbus(dbus_conn);
        assert_eq!(connection, None);
    }

    #[test]
    fn test_connection_from_dbus_wireless() {
        let connection_section =
            HashMap::from([("id".to_string(), Value::new("wlan0").to_owned())]);

        let wireless_section = HashMap::from([
            ("mode".to_string(), Value::new("infrastructure").to_owned()),
            (
                "ssid".to_string(),
                Value::new("agama".as_bytes()).to_owned(),
            ),
        ]);

        let security_section =
            HashMap::from([("key-mgmt".to_string(), Value::new("wpa-psk").to_owned())]);

        let dbus_conn = HashMap::from([
            ("connection".to_string(), connection_section),
            ("802-11-wireless".to_string(), wireless_section),
            ("802-11-wireless-security".to_string(), security_section),
        ]);

        let connection = connection_from_dbus(dbus_conn).unwrap();
        assert!(matches!(connection, Connection::Wireless(_)));
        if let Connection::Wireless(connection) = connection {
            assert_eq!(connection.wireless.ssid, vec![97, 103, 97, 109, 97]);
            assert_eq!(connection.wireless.mode, WirelessMode::Infra);
            assert_eq!(connection.wireless.security, SecurityProtocol::WPA2)
        }
    }
}
