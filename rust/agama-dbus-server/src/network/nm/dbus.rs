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
use cidr::IpInet;
use std::{collections::HashMap, net::IpAddr, str::FromStr};
use uuid::Uuid;
use zbus::zvariant::{self, OwnedValue, Value};

const ETHERNET_KEY: &str = "802-3-ethernet";
const BOND_KEY: &str = "bond";
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

    result.insert("ipv4", ip_config_to_ipv4_dbus(conn.ip_config()));
    result.insert("ipv6", ip_config_to_ipv6_dbus(conn.ip_config()));
    result.insert("match", match_config_to_dbus(conn.match_config()));

    if let Connection::Wireless(wireless) = conn {
        connection_dbus.insert("type", WIRELESS_KEY.into());
        let wireless_dbus = wireless_config_to_dbus(wireless);
        for (k, v) in wireless_dbus {
            result.insert(k, v);
        }
    }

    if let Connection::Bond(bond) = conn {
        connection_dbus.insert("type", BOND_KEY.into());
        result.insert("bond", bond_config_to_dbus(bond));
    }

    result.insert("connection", connection_dbus);
    cleanup_dbus_connection(&mut result);
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

    if let Some(bond_config) = bond_config_from_dbus(&conn) {
        return Some(Connection::Bond(BondConnection {
            base,
            bond: bond_config,
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

fn ip_config_to_ipv4_dbus(ip_config: &IpConfig) -> HashMap<&str, zvariant::Value> {
    let addresses: Vec<HashMap<&str, Value>> = ip_config
        .addresses
        .iter()
        .filter(|ip| ip.is_ipv4())
        .map(|ip| {
            HashMap::from([
                ("address", Value::new(ip.address().to_string())),
                ("prefix", Value::new(ip.network_length() as u32)),
            ])
        })
        .collect();
    let address_data: Value = addresses.into();

    let dns_data: Value = ip_config
        .nameservers
        .iter()
        .filter(|ip| ip.is_ipv4())
        .map(|ns| ns.to_string())
        .collect::<Vec<_>>()
        .into();

    let mut ipv4_dbus = HashMap::from([
        ("address-data", address_data),
        ("dns-data", dns_data),
        ("method", ip_config.method4.to_string().into()),
    ]);

    if let Some(routes4) = &ip_config.routes4 {
        ipv4_dbus.insert(
            "route-data",
            routes4
                .iter()
                .map(|route| route.into())
                .collect::<Vec<HashMap<&str, Value>>>()
                .into(),
        );
    }

    if let Some(gateway) = &ip_config.gateway4 {
        ipv4_dbus.insert("gateway", gateway.to_string().into());
    }
    ipv4_dbus
}

fn ip_config_to_ipv6_dbus(ip_config: &IpConfig) -> HashMap<&str, zvariant::Value> {
    let addresses: Vec<HashMap<&str, Value>> = ip_config
        .addresses
        .iter()
        .filter(|ip| ip.is_ipv6())
        .map(|ip| {
            HashMap::from([
                ("address", Value::new(ip.address().to_string())),
                ("prefix", Value::new(ip.network_length() as u32)),
            ])
        })
        .collect();
    let address_data: Value = addresses.into();

    let dns_data: Value = ip_config
        .nameservers
        .iter()
        .filter(|ip| ip.is_ipv6())
        .map(|ns| ns.to_string())
        .collect::<Vec<_>>()
        .into();

    let mut ipv6_dbus = HashMap::from([
        ("address-data", address_data),
        ("dns-data", dns_data),
        ("method", ip_config.method6.to_string().into()),
    ]);

    if let Some(routes6) = &ip_config.routes6 {
        ipv6_dbus.insert(
            "route-data",
            routes6
                .iter()
                .map(|route| route.into())
                .collect::<Vec<HashMap<&str, Value>>>()
                .into(),
        );
    }

    if let Some(gateway) = &ip_config.gateway6 {
        ipv6_dbus.insert("gateway", gateway.to_string().into());
    }
    ipv6_dbus
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

fn bond_config_to_dbus(conn: &BondConnection) -> HashMap<&str, zvariant::Value> {
    let config = &conn.bond;

    HashMap::from([("options", Value::new(config.options.0.clone()))])
}

/// Converts a MatchConfig struct into a HashMap that can be sent over D-Bus.
///
/// * `match_config`: MatchConfig to convert.
fn match_config_to_dbus(match_config: &MatchConfig) -> HashMap<&str, zvariant::Value> {
    let drivers: Value = match_config
        .driver
        .iter()
        .cloned()
        .collect::<Vec<_>>()
        .into();

    let kernels: Value = match_config
        .kernel
        .iter()
        .cloned()
        .collect::<Vec<_>>()
        .into();

    let paths: Value = match_config.path.iter().cloned().collect::<Vec<_>>().into();

    let interfaces: Value = match_config
        .interface
        .iter()
        .cloned()
        .collect::<Vec<_>>()
        .into();

    HashMap::from([
        ("driver", drivers),
        ("kernel-command-line", kernels),
        ("path", paths),
        ("interface-name", interfaces),
    ])
}
pub fn controller_from_dbus(conn: OwnedNestedHash) -> Option<String> {
    let Some(connection) = conn.get("connection") else {
        return None;
    };

    let Some(controller) = connection.get("master") else {
        return None;
    };

    let controller: &str = controller.downcast_ref()?;

    Some(controller.to_string())
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
        base_connection.interface = interface.to_string();
    }

    if let Some(match_config) = conn.get("match") {
        base_connection.match_config = match_config_from_dbus(match_config)?;
    }

    base_connection.ip_config = ip_config_from_dbus(&conn)?;

    Some(base_connection)
}

fn match_config_from_dbus(
    match_config: &HashMap<String, zvariant::OwnedValue>,
) -> Option<MatchConfig> {
    let mut match_conf = MatchConfig::default();

    if let Some(drivers) = match_config.get("driver") {
        let drivers = drivers.downcast_ref::<zbus::zvariant::Array>()?;
        for driver in drivers.get() {
            let driver: &str = driver.downcast_ref()?;
            match_conf.driver.push(driver.to_string());
        }
    }

    if let Some(interface_names) = match_config.get("interface-name") {
        let interface_names = interface_names.downcast_ref::<zbus::zvariant::Array>()?;
        for name in interface_names.get() {
            let name: &str = name.downcast_ref()?;
            match_conf.interface.push(name.to_string());
        }
    }

    if let Some(paths) = match_config.get("path") {
        let paths = paths.downcast_ref::<zbus::zvariant::Array>()?;
        for path in paths.get() {
            let path: &str = path.downcast_ref()?;
            match_conf.path.push(path.to_string());
        }
    }

    if let Some(kernel_options) = match_config.get("kernel-command-line") {
        let options = kernel_options.downcast_ref::<zbus::zvariant::Array>()?;
        for option in options.get() {
            let option: &str = option.downcast_ref()?;
            match_conf.kernel.push(option.to_string());
        }
    }

    Some(match_conf)
}

fn ip_config_from_dbus(conn: &OwnedNestedHash) -> Option<IpConfig> {
    let mut ip_config = IpConfig::default();

    if let Some(ipv4) = conn.get("ipv4") {
        let method4: &str = ipv4.get("method")?.downcast_ref()?;
        ip_config.method4 = NmMethod(method4.to_string()).try_into().ok()?;

        let address_data = ipv4.get("address-data")?;
        let mut addresses = addresses_with_prefix_from_dbus(&address_data)?;

        ip_config.addresses.append(&mut addresses);

        if let Some(dns_data) = ipv4.get("dns-data") {
            let mut servers = nameservers_from_dbus(dns_data)?;
            ip_config.nameservers.append(&mut servers);
        }

        if let Some(route_data) = ipv4.get("route-data") {
            ip_config.routes4 = routes_from_dbus(route_data);
        }

        if let Some(gateway) = ipv4.get("gateway") {
            let gateway: &str = gateway.downcast_ref()?;
            ip_config.gateway4 = Some(gateway.parse().unwrap());
        }
    }

    if let Some(ipv6) = conn.get("ipv6") {
        let method6: &str = ipv6.get("method")?.downcast_ref()?;
        ip_config.method6 = NmMethod(method6.to_string()).try_into().ok()?;

        let address_data = ipv6.get("address-data")?;
        let mut addresses = addresses_with_prefix_from_dbus(&address_data)?;

        ip_config.addresses.append(&mut addresses);

        if let Some(dns_data) = ipv6.get("dns-data") {
            let mut servers = nameservers_from_dbus(dns_data)?;
            ip_config.nameservers.append(&mut servers);
        }

        if let Some(route_data) = ipv6.get("route-data") {
            ip_config.routes6 = routes_from_dbus(route_data);
        }

        if let Some(gateway) = ipv6.get("gateway") {
            let gateway: &str = gateway.downcast_ref()?;
            ip_config.gateway6 = Some(gateway.parse().unwrap());
        }
    }

    Some(ip_config)
}

fn addresses_with_prefix_from_dbus(address_data: &OwnedValue) -> Option<Vec<IpInet>> {
    let address_data = address_data.downcast_ref::<zbus::zvariant::Array>()?;
    let mut addresses: Vec<IpInet> = vec![];
    for addr in address_data.get() {
        let dict = addr.downcast_ref::<zvariant::Dict>()?;
        let map = <HashMap<String, zvariant::Value<'_>>>::try_from(dict.clone()).unwrap();
        let addr_str: &str = map.get("address")?.downcast_ref()?;
        let prefix: &u32 = map.get("prefix")?.downcast_ref()?;
        let prefix = *prefix as u8;
        let address = IpInet::new(addr_str.parse().unwrap(), prefix).ok()?;
        addresses.push(address)
    }
    Some(addresses)
}

fn routes_from_dbus(route_data: &OwnedValue) -> Option<Vec<IpRoute>> {
    let route_data = route_data.downcast_ref::<zbus::zvariant::Array>()?;
    let mut routes: Vec<IpRoute> = vec![];
    for route in route_data.get() {
        let route_dict = route.downcast_ref::<zvariant::Dict>()?;
        let route_map =
            <HashMap<String, zvariant::Value<'_>>>::try_from(route_dict.clone()).ok()?;
        let dest_str: &str = route_map.get("dest")?.downcast_ref()?;
        let prefix: u8 = *route_map.get("prefix")?.downcast_ref::<u32>()? as u8;
        let destination = IpInet::new(dest_str.parse().unwrap(), prefix).ok()?;
        let mut new_route = IpRoute {
            destination,
            next_hop: None,
            metric: None,
        };
        if let Some(next_hop) = route_map.get("next-hop") {
            let next_hop_str: &str = next_hop.downcast_ref()?;
            new_route.next_hop = Some(IpAddr::from_str(next_hop_str).unwrap());
        }
        if let Some(metric) = route_map.get("metric") {
            let metric: u32 = *metric.downcast_ref()?;
            new_route.metric = Some(metric);
        }
        routes.push(new_route)
    }
    Some(routes)
}

fn nameservers_from_dbus(dns_data: &OwnedValue) -> Option<Vec<IpAddr>> {
    let dns_data = dns_data.downcast_ref::<zbus::zvariant::Array>()?;
    let mut servers: Vec<IpAddr> = vec![];
    for server in dns_data.get() {
        let server: &str = server.downcast_ref()?;
        servers.push(server.parse().unwrap());
    }
    Some(servers)
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

fn bond_config_from_dbus(conn: &OwnedNestedHash) -> Option<BondConfig> {
    let Some(bond) = conn.get(BOND_KEY) else {
        return None;
    };

    let dict: &zvariant::Dict = bond.get("options")?.downcast_ref()?;
    let options = <HashMap<String, String>>::try_from(dict.clone()).unwrap();

    Some(BondConfig {
        options: BondOptions(options),
        ..Default::default()
    })
}

/// Determines whether a value is empty.
///
/// TODO: Generalize for other kind of values, like dicts or arrays.
///
/// * `value`: value to analyze
fn is_empty_value(value: &zvariant::Value) -> bool {
    if let Some(value) = value.downcast_ref::<zvariant::Str>() {
        return value.is_empty();
    }

    false
}

#[cfg(test)]
mod test {
    use super::{
        connection_from_dbus, connection_to_dbus, merge_dbus_connections, NestedHash,
        OwnedNestedHash,
    };
    use crate::network::{model::*, nm::dbus::ETHERNET_KEY};
    use agama_lib::network::types::SSID;
    use cidr::IpInet;
    use std::{collections::HashMap, net::IpAddr, str::FromStr};
    use uuid::Uuid;
    use zbus::zvariant::{self, Array, Dict, OwnedValue, Value};

    #[test]
    fn test_connection_from_dbus() {
        let uuid = Uuid::new_v4().to_string();
        let connection_section = HashMap::from([
            ("id".to_string(), Value::new("eth0").to_owned()),
            ("uuid".to_string(), Value::new(uuid).to_owned()),
        ]);

        let address_v4_data = vec![HashMap::from([
            ("address".to_string(), Value::new("192.168.0.10")),
            ("prefix".to_string(), Value::new(24_u32)),
        ])];

        let route_v4_data = vec![HashMap::from([
            ("dest".to_string(), Value::new("192.168.0.0")),
            ("prefix".to_string(), Value::new(24_u32)),
            ("next-hop".to_string(), Value::new("192.168.0.1")),
            ("metric".to_string(), Value::new(100_u32)),
        ])];

        let ipv4_section = HashMap::from([
            ("method".to_string(), Value::new("auto").to_owned()),
            (
                "address-data".to_string(),
                Value::new(address_v4_data).to_owned(),
            ),
            ("gateway".to_string(), Value::new("192.168.0.1").to_owned()),
            (
                "dns-data".to_string(),
                Value::new(vec!["192.168.0.2"]).to_owned(),
            ),
            (
                "route-data".to_string(),
                Value::new(route_v4_data).to_owned(),
            ),
        ]);

        let address_v6_data = vec![HashMap::from([
            ("address".to_string(), Value::new("::ffff:c0a8:10a")),
            ("prefix".to_string(), Value::new(24_u32)),
        ])];

        let route_v6_data = vec![HashMap::from([
            ("dest".to_string(), Value::new("2001:db8::")),
            ("prefix".to_string(), Value::new(64_u32)),
            ("next-hop".to_string(), Value::new("2001:db8::1")),
            ("metric".to_string(), Value::new(100_u32)),
        ])];

        let ipv6_section = HashMap::from([
            ("method".to_string(), Value::new("auto").to_owned()),
            (
                "address-data".to_string(),
                Value::new(address_v6_data).to_owned(),
            ),
            (
                "gateway".to_string(),
                Value::new("::ffff:c0a8:101").to_owned(),
            ),
            (
                "dns-data".to_string(),
                Value::new(vec!["::ffff:c0a8:102"]).to_owned(),
            ),
            (
                "route-data".to_string(),
                Value::new(route_v6_data).to_owned(),
            ),
        ]);

        let match_section = HashMap::from([(
            "kernel-command-line".to_string(),
            Value::new(vec!["pci-0000:00:19.0"]).to_owned(),
        )]);

        let dbus_conn = HashMap::from([
            ("connection".to_string(), connection_section),
            ("ipv4".to_string(), ipv4_section),
            ("ipv6".to_string(), ipv6_section),
            ("match".to_string(), match_section),
            (ETHERNET_KEY.to_string(), build_ethernet_section_from_dbus()),
        ]);

        let connection = connection_from_dbus(dbus_conn).unwrap();

        assert_eq!(connection.id(), "eth0");
        let ip_config = connection.ip_config();
        let match_config = connection.match_config();
        assert_eq!(match_config.kernel, vec!["pci-0000:00:19.0"]);

        assert_eq!(
            ip_config.addresses,
            vec![
                "192.168.0.10/24".parse().unwrap(),
                "::ffff:c0a8:10a/24".parse().unwrap()
            ]
        );
        assert_eq!(
            ip_config.nameservers,
            vec![
                "192.168.0.2".parse::<IpAddr>().unwrap(),
                "::ffff:c0a8:102".parse::<IpAddr>().unwrap()
            ]
        );
        assert_eq!(ip_config.method4, Ipv4Method::Auto);
        assert_eq!(ip_config.method6, Ipv6Method::Auto);
        assert_eq!(
            ip_config.routes4,
            Some(vec![IpRoute {
                destination: IpInet::new("192.168.0.0".parse().unwrap(), 24_u8).unwrap(),
                next_hop: Some(IpAddr::from_str("192.168.0.1").unwrap()),
                metric: Some(100)
            }])
        );
        assert_eq!(
            ip_config.routes6,
            Some(vec![IpRoute {
                destination: IpInet::new("2001:db8::".parse().unwrap(), 64_u8).unwrap(),
                next_hop: Some(IpAddr::from_str("2001:db8::1").unwrap()),
                metric: Some(100)
            }])
        );
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

        let ipv6 = HashMap::from([
            (
                "method".to_string(),
                Value::new("manual".to_string()).to_owned(),
            ),
            (
                "gateway".to_string(),
                Value::new("::ffff:c0a8:101".to_string()).to_owned(),
            ),
            (
                "addresses".to_string(),
                Value::new(vec!["::ffff:c0a8:102"]).to_owned(),
            ),
        ]);

        original.insert("connection".to_string(), connection);
        original.insert("ipv4".to_string(), ipv4);
        original.insert("ipv6".to_string(), ipv6);

        let base = BaseConnection {
            id: "agama".to_string(),
            interface: "eth0".to_string(),
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

        assert_eq!(
            *connection.get("interface-name").unwrap(),
            Value::new("eth0".to_string())
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

        let ipv6 = merged.get("ipv6").unwrap();
        assert_eq!(
            *ipv6.get("method").unwrap(),
            Value::new("disabled".to_string())
        );
        assert_eq!(
            *ipv6.get("gateway").unwrap(),
            Value::new("::ffff:c0a8:101".to_string())
        );
    }

    #[test]
    fn test_merged_connections_are_clean() {
        let mut original = OwnedNestedHash::new();
        let connection = HashMap::from([
            ("id".to_string(), Value::new("conn0".to_string()).to_owned()),
            (
                "type".to_string(),
                Value::new(ETHERNET_KEY.to_string()).to_owned(),
            ),
            (
                "interface-name".to_string(),
                Value::new("eth0".to_string()).to_owned(),
            ),
        ]);
        original.insert("connection".to_string(), connection);

        let mut updated = Connection::Ethernet(EthernetConnection::default());
        updated.set_interface("");
        let updated = connection_to_dbus(&updated);

        let merged = merge_dbus_connections(&original, &updated);
        let connection = merged.get("connection").unwrap();
        assert_eq!(connection.get("interface-name"), None);
    }

    fn build_ethernet_section_from_dbus() -> HashMap<String, OwnedValue> {
        HashMap::from([("auto-negotiate".to_string(), true.into())])
    }

    fn build_base_connection() -> BaseConnection {
        let addresses = vec![
            "192.168.0.2/24".parse().unwrap(),
            "::ffff:c0a8:2".parse().unwrap(),
        ];
        let ip_config = IpConfig {
            addresses,
            gateway4: Some("192.168.0.1".parse().unwrap()),
            gateway6: Some("::ffff:c0a8:1".parse().unwrap()),
            routes4: Some(vec![IpRoute {
                destination: IpInet::new("192.168.0.0".parse().unwrap(), 24_u8).unwrap(),
                next_hop: Some(IpAddr::from_str("192.168.0.1").unwrap()),
                metric: Some(100),
            }]),
            routes6: Some(vec![IpRoute {
                destination: IpInet::new("2001:db8::".parse().unwrap(), 64_u8).unwrap(),
                next_hop: Some(IpAddr::from_str("2001:db8::1").unwrap()),
                metric: Some(100),
            }]),
            ..Default::default()
        };
        BaseConnection {
            id: "agama".to_string(),
            ip_config,
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
        let gateway4: &str = ipv4_dbus.get("gateway").unwrap().downcast_ref().unwrap();
        assert_eq!(gateway4, "192.168.0.1");
        let routes4_array: Array = ipv4_dbus
            .get("route-data")
            .unwrap()
            .downcast_ref::<Value>()
            .unwrap()
            .try_into()
            .unwrap();
        for route4 in routes4_array.iter() {
            let route4_dict: Dict = route4.downcast_ref::<Value>().unwrap().try_into().unwrap();
            let route4_hashmap: HashMap<String, Value> = route4_dict.try_into().unwrap();
            assert!(route4_hashmap.contains_key("dest"));
            assert_eq!(route4_hashmap["dest"], Value::from("192.168.0.0"));
            assert!(route4_hashmap.contains_key("prefix"));
            assert_eq!(route4_hashmap["prefix"], Value::from(24_u32));
            assert!(route4_hashmap.contains_key("next-hop"));
            assert_eq!(route4_hashmap["next-hop"], Value::from("192.168.0.1"));
            assert!(route4_hashmap.contains_key("metric"));
            assert_eq!(route4_hashmap["metric"], Value::from(100_u32));
        }

        let ipv6_dbus = conn_dbus.get("ipv6").unwrap();
        let gateway6: &str = ipv6_dbus.get("gateway").unwrap().downcast_ref().unwrap();
        assert_eq!(gateway6, "::ffff:192.168.0.1");
        let routes6_array: Array = ipv6_dbus
            .get("route-data")
            .unwrap()
            .downcast_ref::<Value>()
            .unwrap()
            .try_into()
            .unwrap();
        for route6 in routes6_array.iter() {
            let route6_dict: Dict = route6.downcast_ref::<Value>().unwrap().try_into().unwrap();
            let route6_hashmap: HashMap<String, Value> = route6_dict.try_into().unwrap();
            assert!(route6_hashmap.contains_key("dest"));
            assert_eq!(route6_hashmap["dest"], Value::from("2001:db8::"));
            assert!(route6_hashmap.contains_key("prefix"));
            assert_eq!(route6_hashmap["prefix"], Value::from(64_u32));
            assert!(route6_hashmap.contains_key("next-hop"));
            assert_eq!(route6_hashmap["next-hop"], Value::from("2001:db8::1"));
            assert!(route6_hashmap.contains_key("metric"));
            assert_eq!(route6_hashmap["metric"], Value::from(100_u32));
        }
    }
}
