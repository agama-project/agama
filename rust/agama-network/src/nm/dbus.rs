//! This module implements some functions to convert from/to D-Bus types
//!
//! Working with hash maps coming from D-Bus is rather tedious and it is even worse when working
//! with nested hash maps (see [NestedHash]).
use super::model::*;
use crate::model::*;
use std::collections::HashMap;
use std::net::Ipv4Addr;
use uuid::Uuid;
use zbus::zvariant::{self, Value};

type NestedHash<'a> = HashMap<&'a str, HashMap<&'a str, zvariant::Value<'a>>>;

/// Converts a connection struct into a HashMap that can be sent over D-Bus.
///
/// * `conn`: Connection to cnvert.
pub fn connection_to_dbus(conn: &Connection) -> NestedHash {
    let mut result = NestedHash::new();
    let mut connection_dbus =
        HashMap::from([("id", conn.id().into()), ("type", "802-3-ethernet".into())]);
    result.insert("ipv4", ipv4_to_dbus(conn.ipv4()));

    if let Connection::Wireless(wireless) = conn {
        connection_dbus.insert("type", "802-11-wireless".into());
        let wireless_dbus = wireless_config_to_dbus(wireless);
        for (k, v) in wireless_dbus {
            result.insert(k, v);
        }
    }
    result.insert("connection", connection_dbus);
    result
}

/// Converts a HashMap from D-Bus into a Connection.
///
/// This functions tries to turn a HashMap coming from D-Bus into a Connection.
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

fn ipv4_to_dbus(ipv4: &Ipv4Config) -> HashMap<&str, zvariant::Value> {
    let addresses: Vec<HashMap<&str, Value>> = ipv4
        .addresses
        .iter()
        .map(|(addr, prefix)| {
            HashMap::from([
                ("address", Value::new(addr.to_string())),
                ("prefix", Value::new(prefix)),
            ])
        })
        .collect();
    let address_data: Value = addresses.into();

    let dns_data: Value = ipv4
        .nameservers
        .iter()
        .map(|ns| ns.to_string().into())
        .collect::<Vec<String>>()
        .into();

    let mut ipv4_dbus = HashMap::from([
        ("address-data", address_data),
        ("dns-data", dns_data),
        ("method", ipv4.method.to_string().into()),
    ]);

    if let Some(gateway) = ipv4.gateway {
        ipv4_dbus.insert("gateway", gateway.to_string().into());
    }
    ipv4_dbus
}

fn wireless_config_to_dbus(conn: &WirelessConnection) -> NestedHash {
    let config = &conn.wireless;
    let wireless: HashMap<&str, zvariant::Value> = HashMap::from([
        ("mode", Value::new(config.mode.to_string())),
        ("ssid", Value::new(&config.ssid)),
    ]);

    let mut security: HashMap<&str, zvariant::Value> =
        HashMap::from([("key-mgmt", config.security.to_string().into())]);

    if let Some(password) = &config.password {
        security.insert("psk", password.to_string().into());
    }

    NestedHash::from([
        ("802-11-wireless", wireless),
        ("802-11-wireless-security", security),
    ])
}

fn base_connection_from_dbus(
    conn: &HashMap<String, HashMap<String, zvariant::OwnedValue>>,
) -> Option<BaseConnection> {
    let Some(connection) = conn.get("connection") else {
        return None;
    };

    let id: &str = connection.get("id")?.downcast_ref()?;
    let uuid: &str = connection.get("uuid")?.downcast_ref()?;
    let uuid: Uuid = uuid.try_into().ok()?;
    let mut base_connection = BaseConnection {
        id: id.to_string(),
        uuid,
        ..Default::default()
    };

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
    use super::{connection_from_dbus, connection_to_dbus, NestedHash};
    use crate::model::*;
    use std::{collections::HashMap, net::Ipv4Addr};
    use zbus::zvariant::{self, OwnedValue, Value};

    #[test]
    fn test_connection_from_dbus() {
        let connection_section = HashMap::from([
            ("id".to_string(), Value::new("eth0").to_owned()),
            ("uuid".to_string(), Value::new("aaa-bbb-ccc").to_owned()),
        ]);

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

        assert_eq!(connection.id(), "eth0");
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
        let connection_section = HashMap::from([
            ("id".to_string(), Value::new("wlan0").to_owned()),
            ("uuid".to_string(), Value::new("aaa-bbb-ccc").to_owned()),
        ]);

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

    #[test]
    fn test_dbus_from_wireless_connection() {
        let config = WirelessConfig {
            mode: WirelessMode::Infra,
            security: SecurityProtocol::WPA2,
            ssid: "agama".as_bytes().into(),
            ..Default::default()
        };
        let wireless = WirelessConnection {
            base: build_base_connection(),
            wireless: config,
            ..Default::default()
        };
        let wireless = Connection::Wireless(wireless);
        let wireless_dbus = connection_to_dbus(&wireless);

        let wireless = wireless_dbus.get("802-11-wireless").unwrap();
        let mode: &str = wireless.get("mode").unwrap().downcast_ref().unwrap();
        assert_eq!(mode, "infra");

        let ssid: &zvariant::Array = wireless.get("ssid").unwrap().downcast_ref().unwrap();
        let ssid: Vec<u8> = ssid
            .get()
            .iter()
            .map(|u| *u.downcast_ref::<u8>().unwrap())
            .collect();
        assert_eq!(ssid, "agama".as_bytes());

        let security = wireless_dbus.get("802-11-wireless-security").unwrap();
        let key_mgmt: &str = security.get("key-mgmt").unwrap().downcast_ref().unwrap();
        assert_eq!(key_mgmt, "wpa-psk");
    }

    #[test]
    fn test_dbus_from_ethernet_connection() {
        let ethernet = EthernetConnection {
            base: build_base_connection(),
        };
        let ethernet = Connection::Ethernet(ethernet);
        let ethernet_dbus = connection_to_dbus(&ethernet);
        test_dbus_base_connection(&ethernet_dbus);
    }

    fn build_base_connection() -> BaseConnection {
        let addresses = vec![(Ipv4Addr::new(192, 168, 0, 2), 24)];
        let ipv4 = Ipv4Config {
            addresses,
            gateway: Some(Ipv4Addr::new(192, 168, 0, 1)),
            ..Default::default()
        };
        BaseConnection {
            id: "agama".to_string(),
            ipv4,
            ..Default::default()
        }
    }

    fn test_dbus_base_connection(conn_dbus: &NestedHash) {
        let connection_dbus = conn_dbus.get("connection").unwrap();
        let id: &str = connection_dbus.get("id").unwrap().downcast_ref().unwrap();
        assert_eq!(id, "agama");

        let ipv4_dbus = conn_dbus.get("ipv4").unwrap();
        let gateway: &str = ipv4_dbus.get("gateway").unwrap().downcast_ref().unwrap();
        assert_eq!(gateway, "192.168.0.1");
    }
}
