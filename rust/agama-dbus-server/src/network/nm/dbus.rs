//! This module implements some functions to convert from/to D-Bus types
//!
//! Working with hash maps coming from D-Bus is rather tedious and it is even worse when working
//! with nested hash maps (see [NestedHash] and [OwnedNestedHash]).
use super::model::*;
use crate::network::model::*;
use agama_lib::{
    dbus::{NestedHash, OwnedNestedHash},
    network::types::SSID,
};
use std::collections::HashMap;
use uuid::Uuid;
use zbus::zvariant::{self, Value};

const ETHERNET_KEY: &str = "802-3-ethernet";
const WIRELESS_KEY: &str = "802-11-wireless";
const WIRELESS_SECURITY_KEY: &str = "802-11-wireless-security";
const LOOPBACK_KEY: &str = "loopback";

/// Converts a connection struct into a HashMap that can be sent over D-Bus.
///
/// * `conn`: Connection to convert.
pub fn connection_to_dbus(conn: &Connection) -> NestedHash {
    let mut result = NestedHash::new();
    let mut connection_dbus = HashMap::from([
        ("id", conn.id().into()),
        ("type", ETHERNET_KEY.into()),
        ("interface-name", conn.interface().into()),
    ]);
    result.insert("ipv4", ipv4_to_dbus(conn.ipv4()));
    result.insert("match", match_config_to_dbus(conn.match_config()));

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

/// Converts an OwnedNestedHash from D-Bus into a Connection.
///
/// This functions tries to turn a OwnedHashMap coming from D-Bus into a Connection.
pub fn connection_from_dbus(conn: OwnedNestedHash) -> Option<Connection> {
    let base = base_connection_from_dbus(&conn)?;

    if let Some(wireless_config) = wireless_config_from_dbus(&conn) {
        return Some(Connection::Wireless(WirelessConnection {
            base,
            wireless: wireless_config,
        }));
    }

    if conn.get(LOOPBACK_KEY).is_some() {
        return Some(Connection::Loopback(LoopbackConnection { base }));
    };

    if conn.get(ETHERNET_KEY).is_some() {
        return Some(Connection::Ethernet(EthernetConnection { base }));
    };

    None
}

/// Merges a NestedHash and an OwnedNestedHash connections.
///
/// Only the top-level sections that are present in the `original` hash are considered for update.
///
/// * `original`: original hash coming from D-Bus.
/// * `updated`: updated hash to write to D-Bus.
pub fn merge_dbus_connections<'a>(
    original: &'a OwnedNestedHash,
    updated: &'a NestedHash,
) -> NestedHash<'a> {
    let mut merged = HashMap::with_capacity(original.len());
    for (key, orig_section) in original {
        let mut inner: HashMap<&str, zbus::zvariant::Value> =
            HashMap::with_capacity(orig_section.len());
        for (inner_key, value) in orig_section {
            inner.insert(inner_key.as_str(), value.into());
        }
        if let Some(upd_section) = updated.get(key.as_str()) {
            for (inner_key, value) in upd_section {
                inner.insert(inner_key, value.clone());
            }
        }
        merged.insert(key.as_str(), inner);
    }
    cleanup_dbus_connection(&mut merged);
    merged
}

fn is_empty_value(value: &zvariant::Value) -> bool {
    let value: Result<String, _> = value.try_into();
    if let Ok(v) = value {
        return v.is_empty();
    }
    false
}

/// Cleans up the NestedHash that represents a connection.
///
/// By now it just removes the "addresses" key from the "ipv4" and "ipv6" objects, which is
/// replaced with "address-data". However, if "addresses" is present, it takes precedence.
///
/// * `conn`: connection represented as a NestedHash.
fn cleanup_dbus_connection(conn: &mut NestedHash) {
    if let Some(connection) = conn.get_mut("connection") {
        if connection
            .get("interface-name")
            .is_some_and(|v| is_empty_value(&v))
        {
            connection.remove("interface-name");
        }
    }

    if let Some(ipv4) = conn.get_mut("ipv4") {
        ipv4.remove("addresses");
        ipv4.remove("dns");
    }

    if let Some(ipv6) = conn.get_mut("ipv6") {
        ipv6.remove("addresses");
        ipv6.remove("dns");
    }
}

fn ipv4_to_dbus(ipv4: &Ipv4Config) -> HashMap<&str, zvariant::Value> {
    let addresses: Vec<HashMap<&str, Value>> = ipv4
        .addresses
        .iter()
        .map(|ip| {
            HashMap::from([
                ("address", Value::new(ip.addr().to_string())),
                ("prefix", Value::new(ip.prefix())),
            ])
        })
        .collect();
    let address_data: Value = addresses.into();

    let dns_data: Value = ipv4
        .nameservers
        .iter()
        .map(|ns| ns.to_string())
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
        ("ssid", Value::new(config.ssid.to_vec())),
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

/// Converts a MatchConfig struct into a HashMap that can be sent over D-Bus.
///
/// * `match_config`: MatchConfig to convert.
fn match_config_to_dbus(match_config: &MatchConfig) -> HashMap<&str, zvariant::Value> {
    let mut match_config_dbus = HashMap::new();

    let drivers: Value = match_config
        .driver
        .iter()
        .map(|dr| dr.to_string())
        .collect::<Vec<String>>()
        .into();
    match_config_dbus.insert("driver", drivers);

    let kernels: Value = match_config
        .kernel
        .iter()
        .map(|dr| dr.to_string())
        .collect::<Vec<String>>()
        .into();
    match_config_dbus.insert("kernel-command-line", kernels);

    let paths: Value = match_config
        .path
        .iter()
        .map(|dr| dr.to_string())
        .collect::<Vec<String>>()
        .into();
    match_config_dbus.insert("path", paths);

    let interfaces: Value = match_config
        .interface
        .iter()
        .map(|dr| dr.to_string())
        .collect::<Vec<String>>()
        .into();

    match_config_dbus.insert("interface-name", interfaces);

    match_config_dbus
}

fn base_connection_from_dbus(conn: &OwnedNestedHash) -> Option<BaseConnection> {
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

    if let Some(interface) = connection.get("interface-name") {
        let interface: &str = interface.downcast_ref()?;
        base_connection.interface = interface.parse().unwrap();
    }

    if let Some(match_config) = conn.get("match") {
        base_connection.match_config = match_config_from_dbus(match_config)?;
    }

    if let Some(ipv4) = conn.get("ipv4") {
        base_connection.ipv4 = ipv4_config_from_dbus(ipv4)?;
    }

    Some(base_connection)
}

fn match_config_from_dbus(
    match_config: &HashMap<String, zvariant::OwnedValue>,
) -> Option<MatchConfig> {
    let mut match_conf = MatchConfig {
        ..Default::default()
    };

    if let Some(drivers) = match_config.get("driver") {
        let drivers = drivers.downcast_ref::<zbus::zvariant::Array>()?;
        for driver in drivers.get() {
            let driver: &str = driver.downcast_ref()?;
            match_conf.driver.push(driver.parse().unwrap());
        }
    }

    if let Some(interface_names) = match_config.get("interface-name") {
        let interface_names = interface_names.downcast_ref::<zbus::zvariant::Array>()?;
        for name in interface_names.get() {
            let name: &str = name.downcast_ref()?;
            match_conf.interface.push(name.parse().unwrap());
        }
    }

    if let Some(paths) = match_config.get("path") {
        let paths = paths.downcast_ref::<zbus::zvariant::Array>()?;
        for path in paths.get() {
            let path: &str = path.downcast_ref()?;
            match_conf.path.push(path.parse().unwrap());
        }
    }

    if let Some(kernel_options) = match_config.get("kernel-command-line") {
        let options = kernel_options.downcast_ref::<zbus::zvariant::Array>()?;
        for option in options.get() {
            let option: &str = option.downcast_ref()?;
            match_conf.kernel.push(option.parse().unwrap());
        }
    }

    Some(match_conf)
}

fn ipv4_config_from_dbus(ipv4: &HashMap<String, zvariant::OwnedValue>) -> Option<Ipv4Config> {
    let method: &str = ipv4.get("method")?.downcast_ref()?;
    let address_data = ipv4.get("address-data")?;
    let address_data = address_data.downcast_ref::<zbus::zvariant::Array>()?;
    let mut addresses: Vec<IpAddress> = vec![];
    for addr in address_data.get() {
        let dict = addr.downcast_ref::<zvariant::Dict>()?;
        let map = <HashMap<String, zvariant::Value<'_>>>::try_from(dict.clone()).unwrap();
        let addr_str: &str = map.get("address")?.downcast_ref()?;
        let prefix: &u32 = map.get("prefix")?.downcast_ref()?;
        addresses.push(IpAddress::new(addr_str.parse().unwrap(), *prefix))
    }
    let mut ipv4_config = Ipv4Config {
        method: NmMethod(method.to_string()).try_into().ok()?,
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

fn wireless_config_from_dbus(conn: &OwnedNestedHash) -> Option<WirelessConfig> {
    let Some(wireless) = conn.get(WIRELESS_KEY) else {
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
        mode: NmWirelessMode(mode.to_string()).try_into().ok()?,
        ssid: SSID(ssid),
        ..Default::default()
    };

    if let Some(security) = conn.get(WIRELESS_SECURITY_KEY) {
        let key_mgmt: &str = security.get("key-mgmt")?.downcast_ref()?;
        wireless_config.security = NmKeyManagement(key_mgmt.to_string()).try_into().ok()?;
    }

    Some(wireless_config)
}

#[cfg(test)]
mod test {
    use super::{
        connection_from_dbus, connection_to_dbus, merge_dbus_connections, NestedHash,
        OwnedNestedHash,
    };
    use crate::network::{model::*, nm::dbus::ETHERNET_KEY};
    use agama_lib::network::types::SSID;
    use std::{collections::HashMap, net::Ipv4Addr};
    use uuid::Uuid;
    use zbus::zvariant::{self, OwnedValue, Value};

    #[test]
    fn test_connection_from_dbus() {
        let uuid = Uuid::new_v4().to_string();
        let connection_section = HashMap::from([
            ("id".to_string(), Value::new("eth0").to_owned()),
            ("uuid".to_string(), Value::new(uuid).to_owned()),
        ]);

        let address_data = vec![HashMap::from([
            ("address".to_string(), Value::new("192.168.0.10")),
            ("prefix".to_string(), Value::new(24_u32)),
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

        let match_section = HashMap::from([(
            "kernel-command-line".to_string(),
            Value::new(vec!["pci-0000:00:19.0"]).to_owned(),
        )]);

        let dbus_conn = HashMap::from([
            ("connection".to_string(), connection_section),
            ("ipv4".to_string(), ipv4_section),
            ("match".to_string(), match_section),
            (ETHERNET_KEY.to_string(), build_ethernet_section_from_dbus()),
        ]);

        let connection = connection_from_dbus(dbus_conn).unwrap();

        assert_eq!(connection.id(), "eth0");
        let ipv4 = connection.ipv4();
        let match_config = connection.match_config().clone();
        assert_eq!(match_config.kernel, vec!["pci-0000:00:19.0"]);
        assert_eq!(ipv4.addresses, vec!["192.168.0.10/24".parse().unwrap()]);
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
        let uuid = Uuid::new_v4().to_string();
        let connection_section = HashMap::from([
            ("id".to_string(), Value::new("wlan0").to_owned()),
            ("uuid".to_string(), Value::new(uuid).to_owned()),
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
            assert_eq!(connection.wireless.ssid, SSID(vec![97, 103, 97, 109, 97]));
            assert_eq!(connection.wireless.mode, WirelessMode::Infra);
            assert_eq!(connection.wireless.security, SecurityProtocol::WPA2)
        }
    }

    #[test]
    fn test_dbus_from_wireless_connection() {
        let config = WirelessConfig {
            mode: WirelessMode::Infra,
            security: SecurityProtocol::WPA2,
            ssid: SSID(vec![97, 103, 97, 109, 97]),
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
        assert_eq!(mode, "infrastructure");

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
        let ethernet = build_ethernet_connection();
        let ethernet_dbus = connection_to_dbus(&ethernet);
        check_dbus_base_connection(&ethernet_dbus);
    }

    #[test]
    fn test_merge_dbus_connections() {
        let mut original = OwnedNestedHash::new();
        let connection = HashMap::from([
            ("id".to_string(), Value::new("conn0".to_string()).to_owned()),
            (
                "type".to_string(),
                Value::new(ETHERNET_KEY.to_string()).to_owned(),
            ),
        ]);
        let ipv4 = HashMap::from([
            (
                "method".to_string(),
                Value::new("manual".to_string()).to_owned(),
            ),
            (
                "gateway".to_string(),
                Value::new("192.168.1.1".to_string()).to_owned(),
            ),
            (
                "addresses".to_string(),
                Value::new(vec!["192.168.1.1"]).to_owned(),
            ),
        ]);
        original.insert("connection".to_string(), connection);
        original.insert("ipv4".to_string(), ipv4);

        let base = BaseConnection {
            id: "agama".to_string(),
            ..Default::default()
        };
        let ethernet = EthernetConnection {
            base,
            ..Default::default()
        };
        let updated = Connection::Ethernet(ethernet);
        let updated = connection_to_dbus(&updated);

        let merged = merge_dbus_connections(&original, &updated);
        let connection = merged.get("connection").unwrap();
        assert_eq!(
            *connection.get("id").unwrap(),
            Value::new("agama".to_string())
        );

        let ipv4 = merged.get("ipv4").unwrap();
        assert_eq!(
            *ipv4.get("method").unwrap(),
            Value::new("disabled".to_string())
        );
        assert_eq!(
            *ipv4.get("gateway").unwrap(),
            Value::new("192.168.1.1".to_string())
        );
        assert!(ipv4.get("addresses").is_none());
    }

    fn build_ethernet_section_from_dbus() -> HashMap<String, OwnedValue> {
        HashMap::from([("auto-negotiate".to_string(), true.into())])
    }

    fn build_base_connection() -> BaseConnection {
        let addresses = vec!["192.168.0.2/24".parse().unwrap()];
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

    fn build_ethernet_connection() -> Connection {
        let ethernet = EthernetConnection {
            base: build_base_connection(),
        };
        Connection::Ethernet(ethernet)
    }

    fn check_dbus_base_connection(conn_dbus: &NestedHash) {
        let connection_dbus = conn_dbus.get("connection").unwrap();
        let id: &str = connection_dbus.get("id").unwrap().downcast_ref().unwrap();
        assert_eq!(id, "agama");

        let ipv4_dbus = conn_dbus.get("ipv4").unwrap();
        let gateway: &str = ipv4_dbus.get("gateway").unwrap().downcast_ref().unwrap();
        assert_eq!(gateway, "192.168.0.1");
    }
}
