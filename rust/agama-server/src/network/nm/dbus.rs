// Copyright (c) [2024] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

//! This module implements some functions to convert from/to D-Bus types
//!
//! Working with hash maps coming from D-Bus is rather tedious and it is even worse when working
//! with nested hash maps (see [NestedHash] and [OwnedNestedHash]).
use super::{error::NmError, model::*};
use crate::network::model::*;
use agama_lib::{
    dbus::{get_optional_property, get_property, to_owned_hash, NestedHash, OwnedNestedHash},
    network::types::{BondMode, SSID},
};
use cidr::IpInet;
use macaddr::MacAddr6;
use std::{collections::HashMap, net::IpAddr, str::FromStr};
use uuid::Uuid;
use zbus::zvariant::{self, OwnedValue, Value};

const ETHERNET_KEY: &str = "802-3-ethernet";
const BOND_KEY: &str = "bond";
const WIRELESS_KEY: &str = "802-11-wireless";
const WIRELESS_SECURITY_KEY: &str = "802-11-wireless-security";
const LOOPBACK_KEY: &str = "loopback";
const DUMMY_KEY: &str = "dummy";
const VLAN_KEY: &str = "vlan";
const BRIDGE_KEY: &str = "bridge";
const BRIDGE_PORT_KEY: &str = "bridge-port";
const INFINIBAND_KEY: &str = "infiniband";
const TUN_KEY: &str = "tun";
const IEEE_8021X_KEY: &str = "802-1x";

/// Converts a connection struct into a HashMap that can be sent over D-Bus.
///
/// * `conn`: Connection to convert.
pub fn connection_to_dbus<'a>(
    conn: &'a Connection,
    controller: Option<&'a Connection>,
) -> NestedHash<'a> {
    let mut result = NestedHash::new();
    let mut connection_dbus = HashMap::from([
        ("id", conn.id.as_str().into()),
        ("type", ETHERNET_KEY.into()),
    ]);

    if let Some(interface) = &conn.interface {
        connection_dbus.insert("interface-name", interface.to_owned().into());
    }

    if let Some(controller) = controller {
        let slave_type = match controller.config {
            ConnectionConfig::Bond(_) => BOND_KEY,
            ConnectionConfig::Bridge(_) => BRIDGE_KEY,
            _ => {
                log::error!("Controller {} has unhandled config type", controller.id);
                ""
            }
        };
        connection_dbus.insert("slave-type", slave_type.into());
        let master = controller
            .interface
            .as_deref()
            .unwrap_or(controller.id.as_str());
        connection_dbus.insert("master", master.into());
    } else {
        connection_dbus.insert("slave-type", "".into());
        connection_dbus.insert("master", "".into());
    }

    if let Some(zone) = &conn.firewall_zone {
        connection_dbus.insert("zone", zone.into());
    }

    result.insert("ipv4", ip_config_to_ipv4_dbus(&conn.ip_config));
    result.insert("ipv6", ip_config_to_ipv6_dbus(&conn.ip_config));
    result.insert("match", match_config_to_dbus(&conn.match_config));

    if conn.is_ethernet() {
        let ethernet_config = HashMap::from([
            (
                "assigned-mac-address",
                Value::new(conn.mac_address.to_string()),
            ),
            ("mtu", Value::new(conn.mtu)),
        ]);
        result.insert(ETHERNET_KEY, ethernet_config);
    }

    match &conn.config {
        ConnectionConfig::Wireless(wireless) => {
            connection_dbus.insert("type", WIRELESS_KEY.into());
            let mut wireless_dbus = wireless_config_to_dbus(wireless);
            if let Some(wireless_dbus_key) = wireless_dbus.get_mut(WIRELESS_KEY) {
                wireless_dbus_key.extend(HashMap::from([
                    ("mtu", Value::new(conn.mtu)),
                    (
                        "assigned-mac-address",
                        Value::new(conn.mac_address.to_string()),
                    ),
                ]));
            }

            result.extend(wireless_dbus);
        }
        ConnectionConfig::Bond(bond) => {
            connection_dbus.insert("type", BOND_KEY.into());
            if !connection_dbus.contains_key("interface-name") {
                connection_dbus.insert("interface-name", conn.id.as_str().into());
            }
            result.insert(BOND_KEY, bond_config_to_dbus(bond));
        }
        ConnectionConfig::Dummy => {
            connection_dbus.insert("type", DUMMY_KEY.into());
        }
        ConnectionConfig::Vlan(vlan) => {
            connection_dbus.insert("type", VLAN_KEY.into());
            result.extend(vlan_config_to_dbus(vlan));
        }
        ConnectionConfig::Bridge(bridge) => {
            connection_dbus.insert("type", BRIDGE_KEY.into());
            result.insert(BRIDGE_KEY, bridge_config_to_dbus(bridge));
        }
        ConnectionConfig::Infiniband(infiniband) => {
            connection_dbus.insert("type", INFINIBAND_KEY.into());
            result.insert(INFINIBAND_KEY, infiniband_config_to_dbus(infiniband));
        }
        ConnectionConfig::Loopback => {
            connection_dbus.insert("type", LOOPBACK_KEY.into());
        }
        ConnectionConfig::Tun(tun) => {
            connection_dbus.insert("type", TUN_KEY.into());
            result.insert(TUN_KEY, tun_config_to_dbus(tun));
        }
        _ => {}
    }

    match &conn.port_config {
        PortConfig::Bridge(bridge_port) => {
            result.insert(BRIDGE_PORT_KEY, bridge_port_config_to_dbus(bridge_port));
        }
        PortConfig::None => {}
    }

    if let Some(ieee_8021x_config) = &conn.ieee_8021x_config {
        result.insert(IEEE_8021X_KEY, ieee_8021x_config_to_dbus(ieee_8021x_config));
    }

    result.insert("connection", connection_dbus);
    result
}

/// Converts an OwnedNestedHash from D-Bus into a Connection.
///
/// This functions tries to turn a OwnedHashMap coming from D-Bus into a Connection.
pub fn connection_from_dbus(conn: OwnedNestedHash) -> Result<Connection, NmError> {
    let mut connection = base_connection_from_dbus(&conn)?;

    if let Some(bridge_port_config) = bridge_port_config_from_dbus(&conn)? {
        connection.port_config = PortConfig::Bridge(bridge_port_config);
    }

    if let Some(ieee_8021x_config) = ieee_8021x_config_from_dbus(&conn)? {
        connection.ieee_8021x_config = Some(ieee_8021x_config);
    }

    if let Some(wireless_config) = wireless_config_from_dbus(&conn)? {
        connection.config = ConnectionConfig::Wireless(wireless_config);
        return Ok(connection);
    }

    if let Some(bond_config) = bond_config_from_dbus(&conn)? {
        connection.config = ConnectionConfig::Bond(bond_config);
        return Ok(connection);
    }

    if let Some(vlan_config) = vlan_config_from_dbus(&conn)? {
        connection.config = ConnectionConfig::Vlan(vlan_config);
        return Ok(connection);
    }

    if let Some(bridge_config) = bridge_config_from_dbus(&conn)? {
        connection.config = ConnectionConfig::Bridge(bridge_config);
        return Ok(connection);
    }

    if let Some(infiniband_config) = infiniband_config_from_dbus(&conn)? {
        connection.config = ConnectionConfig::Infiniband(infiniband_config);
        return Ok(connection);
    }

    if let Some(tun_config) = tun_config_from_dbus(&conn)? {
        connection.config = ConnectionConfig::Tun(tun_config);
        return Ok(connection);
    }

    if conn.contains_key(DUMMY_KEY) {
        connection.config = ConnectionConfig::Dummy;
        return Ok(connection);
    };

    if conn.contains_key(LOOPBACK_KEY) {
        connection.config = ConnectionConfig::Loopback;
        return Ok(connection);
    };

    if conn.contains_key(ETHERNET_KEY) {
        return Ok(connection);
    };

    Err(NmError::UnsupportedConnectionType(connection.id))
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
) -> Result<NestedHash<'a>, zvariant::Error> {
    let mut merged = HashMap::with_capacity(original.len());
    for (key, orig_section) in original {
        let mut inner: HashMap<&str, zbus::zvariant::Value> =
            HashMap::with_capacity(orig_section.len());
        for (inner_key, value) in orig_section {
            inner.insert(inner_key.as_str(), value.try_into()?);
        }
        if let Some(upd_section) = updated.get(key.as_str()) {
            for (inner_key, value) in upd_section {
                inner.insert(inner_key, value.try_clone()?);
            }
        }
        merged.insert(key.as_str(), inner);
    }
    cleanup_dbus_connection(&mut merged);
    Ok(merged)
}

/// Cleans up the NestedHash that represents a connection.
///
/// By now it just removes the "addresses" key from the "ipv4" and "ipv6" objects, which is
/// replaced with "address-data". However, if "addresses" is present, it takes precedence.
///
/// * `conn`: connection represented as a NestedHash.
pub fn cleanup_dbus_connection(conn: &mut NestedHash) {
    if let Some(connection) = conn.get_mut("connection") {
        if connection.get("interface-name").is_some_and(is_empty_value) {
            connection.remove("interface-name");
        }

        if connection.get("master").is_some_and(is_empty_value) {
            connection.remove("master");
        }

        if connection.get("slave-type").is_some_and(is_empty_value) {
            connection.remove("slave-type");
        }
    }

    if let Some(ipv4) = conn.get_mut("ipv4") {
        ipv4.remove("addresses");
        ipv4.remove("dns");
        if ipv4.get("address-data").is_some_and(is_empty_value) {
            ipv4.remove("gateway");
        }
    }

    if let Some(ipv6) = conn.get_mut("ipv6") {
        ipv6.remove("addresses");
        ipv6.remove("dns");
        if ipv6.get("address-data").is_some_and(is_empty_value) {
            ipv6.remove("gateway");
        }
    }
}

/// Ancillary function to get the controller for a given interface.
pub fn controller_from_dbus(conn: &OwnedNestedHash) -> Result<Option<String>, zvariant::Error> {
    let Some(connection) = conn.get("connection") else {
        return Ok(None);
    };
    get_optional_property(connection, "master")
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
        ("dns-search", ip_config.dns_searchlist.clone().into()),
        ("ignore-auto-dns", ip_config.ignore_auto_dns.into()),
        ("method", ip_config.method4.to_string().into()),
    ]);

    if !ip_config.routes4.is_empty() {
        ipv4_dbus.insert(
            "route-data",
            ip_config
                .routes4
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
        ("dns-search", ip_config.dns_searchlist.clone().into()),
        ("ignore-auto-dns", ip_config.ignore_auto_dns.into()),
        ("method", ip_config.method6.to_string().into()),
    ]);

    if !ip_config.routes6.is_empty() {
        ipv6_dbus.insert(
            "route-data",
            ip_config
                .routes6
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

fn wireless_config_to_dbus(config: &'_ WirelessConfig) -> NestedHash<'_> {
    let mut wireless: HashMap<&str, zvariant::Value> = HashMap::from([
        ("mode", Value::new(config.mode.to_string())),
        ("ssid", Value::new(config.ssid.to_vec())),
        ("hidden", Value::new(config.hidden)),
    ]);

    if let Some(band) = &config.band {
        wireless.insert("band", band.to_string().into());
        wireless.insert("channel", config.channel.into());
    }
    if let Some(bssid) = &config.bssid {
        wireless.insert("bssid", bssid.as_bytes().into());
    }

    let mut security: HashMap<&str, zvariant::Value> = HashMap::from([
        ("key-mgmt", config.security.to_string().into()),
        (
            "group",
            config
                .group_algorithms
                .iter()
                .map(|x| x.to_string())
                .collect::<Vec<String>>()
                .into(),
        ),
        (
            "pairwise",
            config
                .pairwise_algorithms
                .iter()
                .map(|x| x.to_string())
                .collect::<Vec<String>>()
                .into(),
        ),
        (
            "proto",
            config
                .wpa_protocol_versions
                .iter()
                .map(|x| x.to_string())
                .collect::<Vec<String>>()
                .into(),
        ),
        ("pmf", Value::new(config.pmf)),
    ]);

    if let Some(password) = &config.password {
        security.insert("psk", password.to_string().into());
    }
    if let Some(wep_security) = &config.wep_security {
        security.insert(
            "wep-key-type",
            (wep_security.wep_key_type.clone() as u32).into(),
        );
        security.insert("auth-alg", wep_security.auth_alg.to_string().into());
        for (i, wep_key) in wep_security.keys.clone().into_iter().enumerate() {
            security.insert(
                // FIXME: lifetimes are fun
                if i == 0 {
                    "wep-key0"
                } else if i == 1 {
                    "wep-key1"
                } else if i == 2 {
                    "wep-key2"
                } else if i == 3 {
                    "wep-key3"
                } else {
                    break;
                },
                wep_key.into(),
            );
        }
        security.insert("wep-tx-keyidx", wep_security.wep_key_index.into());
    }

    NestedHash::from([(WIRELESS_KEY, wireless), (WIRELESS_SECURITY_KEY, security)])
}

fn bond_config_to_dbus(config: &BondConfig) -> HashMap<&str, zvariant::Value> {
    let mut options = config.options.0.clone();
    options.insert("mode".to_string(), config.mode.to_string());
    HashMap::from([("options", Value::new(options))])
}

fn bridge_config_to_dbus(bridge: &BridgeConfig) -> HashMap<&str, zvariant::Value> {
    let mut hash = HashMap::new();

    hash.insert("stp", bridge.stp.into());
    if let Some(prio) = bridge.priority {
        hash.insert("priority", prio.into());
    }
    if let Some(fwd_delay) = bridge.forward_delay {
        hash.insert("forward-delay", fwd_delay.into());
    }
    if let Some(hello_time) = bridge.hello_time {
        hash.insert("hello-time", hello_time.into());
    }
    if let Some(max_age) = bridge.max_age {
        hash.insert("max-age", max_age.into());
    }
    if let Some(ageing_time) = bridge.ageing_time {
        hash.insert("ageing-time", ageing_time.into());
    }

    hash
}

fn bridge_config_from_dbus(conn: &OwnedNestedHash) -> Result<Option<BridgeConfig>, NmError> {
    let Some(bridge) = conn.get(BRIDGE_KEY) else {
        return Ok(None);
    };

    Ok(Some(BridgeConfig {
        stp: get_property(bridge, "stp")?,
        priority: get_optional_property(bridge, "priority")?,
        forward_delay: get_optional_property(bridge, "forward-delay")?,
        hello_time: get_optional_property(bridge, "hello-time")?,
        max_age: get_optional_property(bridge, "max-age")?,
        ageing_time: get_optional_property(bridge, "ageing-time")?,
        ..Default::default()
    }))
}

fn bridge_port_config_to_dbus(bridge_port: &BridgePortConfig) -> HashMap<&str, zvariant::Value> {
    let mut hash = HashMap::new();

    if let Some(prio) = bridge_port.priority {
        hash.insert("priority", prio.into());
    }
    if let Some(pc) = bridge_port.path_cost {
        hash.insert("path-cost", pc.into());
    }

    hash
}

fn bridge_port_config_from_dbus(
    conn: &OwnedNestedHash,
) -> Result<Option<BridgePortConfig>, NmError> {
    let Some(bridge_port) = conn.get(BRIDGE_PORT_KEY) else {
        return Ok(None);
    };

    Ok(Some(BridgePortConfig {
        priority: get_optional_property(bridge_port, "priority")?,
        path_cost: get_optional_property(bridge_port, "path_cost")?,
        ..Default::default()
    }))
}

fn infiniband_config_to_dbus(config: &InfinibandConfig) -> HashMap<&str, zvariant::Value> {
    let mut infiniband_config: HashMap<&str, zvariant::Value> = HashMap::from([
        (
            "transport-mode",
            Value::new(config.transport_mode.to_string()),
        ),
        ("p-key", Value::new(config.p_key.unwrap_or(-1))),
    ]);

    if let Some(parent) = &config.parent {
        infiniband_config.insert("parent", parent.into());
    }

    infiniband_config
}

fn infiniband_config_from_dbus(
    conn: &OwnedNestedHash,
) -> Result<Option<InfinibandConfig>, NmError> {
    let Some(infiniband) = conn.get(INFINIBAND_KEY) else {
        return Ok(None);
    };

    let mut config = InfinibandConfig {
        p_key: get_optional_property(infiniband, "p-key")?,
        parent: get_optional_property(infiniband, "parent")?,
        ..Default::default()
    };

    if let Some(transport_mode) = get_optional_property::<String>(infiniband, "transport-mode")? {
        config.transport_mode = InfinibandTransportMode::from_str(transport_mode.as_str())?;
    }

    Ok(Some(config))
}

fn tun_config_to_dbus(config: &TunConfig) -> HashMap<&str, zvariant::Value> {
    let mut tun_config: HashMap<&str, zvariant::Value> =
        HashMap::from([("mode", Value::new(config.mode.clone() as u32))]);

    if let Some(group) = &config.group {
        tun_config.insert("group", group.into());
    }

    if let Some(owner) = &config.owner {
        tun_config.insert("owner", owner.into());
    }

    tun_config
}

fn tun_config_from_dbus(conn: &OwnedNestedHash) -> Result<Option<TunConfig>, NmError> {
    let Some(tun) = conn.get(TUN_KEY) else {
        return Ok(None);
    };

    let mode = match get_property::<u32>(tun, "mode") {
        Ok(2) => TunMode::Tap,
        _ => TunMode::Tun,
    };

    Ok(Some(TunConfig {
        mode,
        group: get_optional_property(tun, "group")?,
        owner: get_optional_property(tun, "owner")?,
        ..Default::default()
    }))
}

/// Converts a MatchConfig struct into a HashMap that can be sent over D-Bus.
///
/// * `match_config`: MatchConfig to convert.
fn match_config_to_dbus(match_config: &MatchConfig) -> HashMap<&str, zvariant::Value> {
    let drivers: Value = match_config.driver.to_vec().into();

    let kernels: Value = match_config.kernel.to_vec().into();

    let paths: Value = match_config.path.to_vec().into();

    let interfaces: Value = match_config.interface.to_vec().into();

    HashMap::from([
        ("driver", drivers),
        ("kernel-command-line", kernels),
        ("path", paths),
        ("interface-name", interfaces),
    ])
}

fn base_connection_from_dbus(conn: &OwnedNestedHash) -> Result<Connection, NmError> {
    let connection = conn
        .get("connection")
        .ok_or(NmError::MissingConnectionSection)?;

    let uuid: String = get_property(connection, "uuid")?;
    let uuid = Uuid::from_str(&uuid)?;
    let mut base_connection = Connection {
        id: get_property(connection, "id")?,
        uuid,
        interface: get_optional_property(connection, "interface-name")?,
        firewall_zone: get_optional_property(connection, "firewall-zone")?,
        ..Default::default()
    };

    if let Some(match_config) = conn.get("match") {
        base_connection.match_config = match_config_from_dbus(match_config)?;
    }

    if let Some(ethernet_config) = conn.get(ETHERNET_KEY) {
        base_connection.mac_address = mac_address_from_dbus(ethernet_config)?;
        base_connection.mtu = mtu_from_dbus(ethernet_config);
    } else if let Some(wireless_config) = conn.get(WIRELESS_KEY) {
        base_connection.mac_address = mac_address_from_dbus(wireless_config)?;
        base_connection.mtu = mtu_from_dbus(wireless_config);
    }

    base_connection.ip_config = ip_config_from_dbus(conn)?;

    Ok(base_connection)
}

fn mac_address_from_dbus(config: &HashMap<String, OwnedValue>) -> Result<MacAddress, NmError> {
    let Ok(mac_address) = get_property::<String>(config, "assigned-mac-address") else {
        return Ok(MacAddress::Unset);
    };

    Ok(MacAddress::from_str(mac_address.as_str())?)
}

fn mtu_from_dbus(config: &HashMap<String, OwnedValue>) -> u32 {
    get_property(config, "mtu").unwrap_or(0)
}

fn match_config_from_dbus(
    match_config: &HashMap<String, zvariant::OwnedValue>,
) -> Result<MatchConfig, NmError> {
    let mut match_conf = MatchConfig::default();

    if let Some(drivers) = get_optional_property::<zbus::zvariant::Array>(match_config, "driver")? {
        for driver in drivers.iter() {
            let driver: String = driver.try_into()?;
            match_conf.driver.push(driver);
        }
    }

    if let Some(interface_names) =
        get_optional_property::<zbus::zvariant::Array>(match_config, "interface-name")?
    {
        for name in interface_names.iter() {
            let name: String = name.try_into()?;
            match_conf.interface.push(name);
        }
    }

    if let Some(paths) = get_optional_property::<zbus::zvariant::Array>(match_config, "path")? {
        for path in paths.iter() {
            let path: String = path.try_into()?;
            match_conf.path.push(path);
        }
    }

    if let Some(kernel_options) =
        get_optional_property::<zbus::zvariant::Array>(match_config, "kernel-command-line")?
    {
        for option in kernel_options.iter() {
            let option: String = option.try_into()?;
            match_conf.kernel.push(option);
        }
    }

    Ok(match_conf)
}

fn ip_config_from_dbus(conn: &OwnedNestedHash) -> Result<IpConfig, NmError> {
    let mut ip_config = IpConfig::default();

    if let Some(ipv4) = conn.get("ipv4") {
        let method4: String = get_property(ipv4, "method")?;
        ip_config.method4 = NmMethod(method4).try_into()?;

        if let Some(address_data) = ipv4.get("address-data") {
            let mut addresses = addresses_with_prefix_from_dbus(address_data)?;
            ip_config.addresses.append(&mut addresses);
        }

        if let Some(dns_data) = ipv4.get("dns-data") {
            let mut servers = nameservers_from_dbus(dns_data)?;
            ip_config.nameservers.append(&mut servers);
        }

        if let Ok(dns_search) = get_property::<zbus::zvariant::Array>(ipv4, "dns-search") {
            let searchlist: Vec<String> = dns_search
                .iter()
                .flat_map(|x| x.downcast_ref::<String>())
                .collect();
            for searchdomain in searchlist {
                if !ip_config.dns_searchlist.contains(&searchdomain) {
                    ip_config.dns_searchlist.push(searchdomain);
                }
            }
        }

        if let Some(ignore_auto_dns) = get_optional_property::<bool>(ipv4, "ignore-auto-dns")? {
            ip_config.ignore_auto_dns = ignore_auto_dns;
        }
        if let Some(route_data) = ipv4.get("route-data") {
            ip_config.routes4 = routes_from_dbus(route_data)?;
        }

        if let Ok(gateway) = get_property::<String>(ipv4, "gateway") {
            ip_config.gateway4 = gateway.parse().ok();
        }
    }

    if let Some(ipv6) = conn.get("ipv6") {
        let method6: String = get_property(ipv6, "method")?;
        ip_config.method6 = NmMethod(method6).try_into()?;

        if let Some(address_data) = ipv6.get("address-data") {
            let mut addresses = addresses_with_prefix_from_dbus(address_data)?;
            ip_config.addresses.append(&mut addresses);
        }

        if let Some(dns_data) = ipv6.get("dns-data") {
            let mut servers = nameservers_from_dbus(dns_data)?;
            ip_config.nameservers.append(&mut servers);
        }

        if let Ok(dns_search) = get_property::<zbus::zvariant::Array>(ipv6, "dns-search") {
            let searchlist: Vec<String> = dns_search
                .iter()
                .flat_map(|x| x.downcast_ref::<String>())
                .collect();
            for searchdomain in searchlist {
                if !ip_config.dns_searchlist.contains(&searchdomain) {
                    ip_config.dns_searchlist.push(searchdomain);
                }
            }
        }

        if let Some(ignore_auto_dns) = get_optional_property::<bool>(ipv6, "ignore-auto-dns")? {
            ip_config.ignore_auto_dns = ignore_auto_dns;
        }

        if let Some(route_data) = ipv6.get("route-data") {
            ip_config.routes6 = routes_from_dbus(route_data)?;
        }

        if let Ok(gateway) = get_property::<String>(ipv6, "gateway") {
            ip_config.gateway6 = gateway.parse().ok();
        }
    }

    Ok(ip_config)
}

fn addresses_with_prefix_from_dbus(address_data: &OwnedValue) -> Result<Vec<IpInet>, NmError> {
    let address_data = address_data.downcast_ref::<zbus::zvariant::Array>()?;
    let mut addresses: Vec<IpInet> = vec![];
    for addr in address_data.iter() {
        let dict = addr.downcast_ref::<zvariant::Dict>()?;
        let map = <HashMap<String, zvariant::Value<'_>>>::try_from(dict)?;
        let map = to_owned_hash(&map)?;
        let addr_str: String = get_property(&map, "address")?;
        let prefix: u32 = get_property(&map, "prefix")?;
        // TODO: properly handle the errors
        let address = IpInet::new(addr_str.parse()?, prefix as u8)?;
        addresses.push(address)
    }
    Ok(addresses)
}

fn routes_from_dbus(route_data: &OwnedValue) -> Result<Vec<IpRoute>, NmError> {
    let route_data = route_data.downcast_ref::<zbus::zvariant::Array>()?;
    let mut routes: Vec<IpRoute> = vec![];
    for route in route_data.iter() {
        let dict = route.downcast_ref::<zvariant::Dict>()?;
        let map = <HashMap<String, zvariant::Value<'_>>>::try_from(dict)?;
        let map = to_owned_hash(&map)?;
        let dest_str: String = get_property(&map, "dest")?;
        let prefix: u32 = get_property(&map, "prefix")?;
        let destination = IpInet::new(dest_str.parse()?, prefix as u8)?;
        let mut new_route = IpRoute {
            destination,
            next_hop: None,
            metric: None,
        };
        if let Some(next_hop) = get_optional_property::<String>(&map, "next-hop")? {
            new_route.next_hop = Some(IpAddr::from_str(next_hop.as_str()).unwrap());
        }
        new_route.metric = get_optional_property(&map, "metric")?;
        routes.push(new_route)
    }
    Ok(routes)
}

fn nameservers_from_dbus(dns_data: &OwnedValue) -> Result<Vec<IpAddr>, NmError> {
    let dns_data = dns_data.downcast_ref::<zbus::zvariant::Array>()?;
    let mut servers: Vec<IpAddr> = vec![];
    for server in dns_data.iter() {
        let server: String = server.downcast_ref()?;
        servers.push(server.parse().unwrap());
    }
    Ok(servers)
}

fn wireless_config_from_dbus(conn: &OwnedNestedHash) -> Result<Option<WirelessConfig>, NmError> {
    let Some(wireless) = conn.get(WIRELESS_KEY) else {
        return Ok(None);
    };

    let mode: String = get_property(wireless, "mode")?;
    let ssid: zvariant::Array = get_property(wireless, "ssid")?;
    let ssid: Vec<u8> = ssid
        .iter()
        .map(|u| u.downcast_ref::<u8>().unwrap())
        .collect();
    let mut wireless_config = WirelessConfig {
        mode: NmWirelessMode(mode).try_into()?,
        ssid: SSID(ssid),
        ..Default::default()
    };

    if let Ok(band) = get_property::<String>(wireless, "band") {
        wireless_config.band = WirelessBand::try_from(band.as_str()).ok();
    }
    wireless_config.channel = get_property(wireless, "channel")?;

    if let Ok(bssid) = get_property::<zvariant::Array>(wireless, "bssid") {
        let bssid: Vec<u8> = bssid
            .iter()
            .map(|u| u.downcast_ref::<u8>().unwrap())
            .collect();
        // FIMXE: properly handle the failing case
        wireless_config.bssid = Some(MacAddr6::new(
            *bssid.first().unwrap(),
            *bssid.get(1).unwrap(),
            *bssid.get(2).unwrap(),
            *bssid.get(3).unwrap(),
            *bssid.get(4).unwrap(),
            *bssid.get(5).unwrap(),
        ));
    }

    wireless_config.hidden = get_property(wireless, "hidden")?;

    if let Some(security) = conn.get(WIRELESS_SECURITY_KEY) {
        let key_mgmt: String = get_property(security, "key-mgmt")?;
        wireless_config.security = NmKeyManagement(key_mgmt).try_into()?;
        wireless_config.password = get_optional_property(security, "psk")?;

        match wireless_config.security {
            SecurityProtocol::WEP => {
                let wep_key_type = get_property::<u32>(security, "wep-key-type")?;
                let wep_key_type = WEPKeyType::try_from(wep_key_type).unwrap_or_default();

                let auth_alg = get_property::<String>(security, "auth-alg")?;
                let auth_alg = WEPAuthAlg::try_from(auth_alg.as_str()).unwrap_or_default();

                let wep_key_index = security
                    .get("wep-tx-keyidx")
                    .and_then(|idx| idx.downcast_ref::<u32>().ok())
                    .unwrap_or_default();
                wireless_config.wep_security = Some(WEPSecurity {
                    wep_key_type,
                    auth_alg,
                    wep_key_index,
                    ..Default::default()
                });
            }
            _ => wireless_config.wep_security = None,
        }
        if let Some(group_algorithms) = security.get("group") {
            let group_algorithms: &zvariant::Array = group_algorithms.downcast_ref()?;
            let group_algorithms: Vec<String> = group_algorithms
                .iter()
                .flat_map(|x| x.downcast_ref::<String>().ok())
                .collect();
            let group_algorithms = group_algorithms
                .iter()
                .map(|x| GroupAlgorithm::from_str(x))
                .collect::<Result<Vec<GroupAlgorithm>, InvalidGroupAlgorithm>>()?;
            wireless_config.group_algorithms = group_algorithms
        }
        if let Some(pairwise_algorithms) = security.get("pairwise") {
            let pairwise_algorithms: &zvariant::Array = pairwise_algorithms.downcast_ref()?;
            let pairwise_algorithms: Vec<String> = pairwise_algorithms
                .iter()
                .flat_map(|x| x.downcast_ref::<String>().ok())
                .collect();
            let pairwise_algorithms = pairwise_algorithms
                .iter()
                .map(|x| PairwiseAlgorithm::from_str(x))
                .collect::<Result<Vec<PairwiseAlgorithm>, InvalidPairwiseAlgorithm>>()?;
            wireless_config.pairwise_algorithms = pairwise_algorithms
        }
        if let Some(wpa_protocol_versions) = security.get("proto") {
            let wpa_protocol_versions: &zvariant::Array = wpa_protocol_versions.downcast_ref()?;
            let wpa_protocol_versions: Vec<String> = wpa_protocol_versions
                .iter()
                .flat_map(|x| x.downcast_ref::<String>().ok())
                .collect();
            let wpa_protocol_versions: Vec<WPAProtocolVersion> = wpa_protocol_versions
                .iter()
                .map(|x| WPAProtocolVersion::from_str(x))
                .collect::<Result<Vec<WPAProtocolVersion>, InvalidWPAProtocolVersion>>()?;
            wireless_config.wpa_protocol_versions = wpa_protocol_versions
        }
        wireless_config.pmf = get_property(security, "pmf")?;
    }

    Ok(Some(wireless_config))
}

fn bond_config_from_dbus(conn: &OwnedNestedHash) -> Result<Option<BondConfig>, NmError> {
    let Some(bond) = conn.get(BOND_KEY) else {
        return Ok(None);
    };

    let dict = get_property::<zvariant::Dict>(bond, "options")?;
    let mut options = <HashMap<String, String>>::try_from(dict)?;
    let mode = options.remove("mode");

    let mut bond = BondConfig {
        options: BondOptions(options),
        ..Default::default()
    };

    if let Some(mode) = mode {
        bond.mode = BondMode::try_from(mode.as_str()).unwrap_or_default();
    }

    Ok(Some(bond))
}

fn vlan_config_to_dbus(cfg: &VlanConfig) -> NestedHash {
    let vlan: HashMap<&str, zvariant::Value> = HashMap::from([
        ("id", cfg.id.into()),
        ("parent", cfg.parent.clone().into()),
        ("protocol", cfg.protocol.to_string().into()),
    ]);

    NestedHash::from([("vlan", vlan)])
}

fn vlan_config_from_dbus(conn: &OwnedNestedHash) -> Result<Option<VlanConfig>, NmError> {
    let Some(vlan) = conn.get(VLAN_KEY) else {
        return Ok(None);
    };

    let protocol = match get_property::<String>(vlan, "protocol") {
        Ok(protocol) => VlanProtocol::from_str(protocol.as_str()).unwrap_or_default(),
        _ => Default::default(),
    };

    Ok(Some(VlanConfig {
        id: get_property(vlan, "id")?,
        parent: get_property(vlan, "parent")?,
        protocol,
    }))
}

fn ieee_8021x_config_to_dbus(config: &IEEE8021XConfig) -> HashMap<&str, zvariant::Value> {
    let mut ieee_8021x_config: HashMap<&str, zvariant::Value> = HashMap::from([(
        "eap",
        config
            .eap
            .iter()
            .map(|x| x.to_string())
            .collect::<Vec<String>>()
            .into(),
    )]);

    if let Some(phase2_auth) = &config.phase2_auth {
        ieee_8021x_config.insert("phase2-auth", phase2_auth.to_string().into());
    }
    if let Some(identity) = &config.identity {
        ieee_8021x_config.insert("identity", identity.into());
    }
    if let Some(password) = &config.password {
        ieee_8021x_config.insert("password", password.into());
    }
    if let Some(ca_cert) = &config.ca_cert {
        ieee_8021x_config.insert("ca-cert", format_nm_path(ca_cert).into_bytes().into());
    }
    if let Some(ca_cert_password) = &config.ca_cert_password {
        ieee_8021x_config.insert("ca-cert-password", ca_cert_password.into());
    }
    if let Some(client_cert) = &config.client_cert {
        ieee_8021x_config.insert(
            "client-cert",
            format_nm_path(client_cert).into_bytes().into(),
        );
    }
    if let Some(client_cert_password) = &config.client_cert_password {
        ieee_8021x_config.insert("client-cert-password", client_cert_password.into());
    }
    if let Some(private_key) = &config.private_key {
        ieee_8021x_config.insert(
            "private-key",
            format_nm_path(private_key).into_bytes().into(),
        );
    }
    if let Some(private_key_password) = &config.private_key_password {
        ieee_8021x_config.insert("private-key-password", private_key_password.into());
    }
    if let Some(anonymous_identity) = &config.anonymous_identity {
        ieee_8021x_config.insert("anonymous-identity", anonymous_identity.into());
    }
    if let Some(peap_version) = &config.peap_version {
        ieee_8021x_config.insert("phase1-peapver", peap_version.into());
    }
    ieee_8021x_config.insert(
        "phase1-peaplabel",
        if config.peap_label { "1" } else { "0" }.into(),
    );

    ieee_8021x_config
}

fn format_nm_path(path: &String) -> String {
    format!("file://{path}\0")
}

fn ieee_8021x_config_from_dbus(conn: &OwnedNestedHash) -> Result<Option<IEEE8021XConfig>, NmError> {
    let Some(ieee_8021x) = conn.get(IEEE_8021X_KEY) else {
        return Ok(None);
    };

    let mut ieee_8021x_config = IEEE8021XConfig::default();

    if let Some(eap) = get_optional_property::<zvariant::Array>(ieee_8021x, "eap")? {
        let eap = eap
            .iter()
            .filter_map(|x| x.downcast_ref::<String>().ok())
            .collect::<Vec<String>>();

        let eap: Vec<EAPMethod> = eap
            .iter()
            .map(|x| EAPMethod::from_str(x))
            .collect::<Result<Vec<EAPMethod>, InvalidEAPMethod>>()?;

        ieee_8021x_config.eap = eap;
    }

    if let Ok(phase2_auth) = get_property::<String>(ieee_8021x, "phase2-auth") {
        let method = Phase2AuthMethod::from_str(phase2_auth.as_str())?;
        ieee_8021x_config.phase2_auth = Some(method);
    }

    ieee_8021x_config.identity = get_optional_property::<String>(ieee_8021x, "identity")?;
    ieee_8021x_config.password = get_optional_property::<String>(ieee_8021x, "password")?;

    if let Ok(ca_cert) = get_property::<zvariant::Array>(ieee_8021x, "ca-cert") {
        let ca_cert = ca_cert
            .iter()
            .map(|u| u.downcast_ref::<u8>())
            .collect::<Result<Vec<u8>, zvariant::Error>>()?
            .iter()
            .map(|x| *x as char)
            .collect();
        ieee_8021x_config.ca_cert = strip_nm_file_path(ca_cert);
    }

    ieee_8021x_config.ca_cert_password =
        get_optional_property::<String>(ieee_8021x, "ca-cert-password")?;

    if let Ok(client_cert) = get_property::<zvariant::Array>(ieee_8021x, "client-cert") {
        let client_cert: String = client_cert
            .iter()
            .map(|u| u.downcast_ref::<u8>())
            .collect::<Result<Vec<u8>, zvariant::Error>>()?
            .iter()
            .map(|x| *x as char)
            .collect();
        ieee_8021x_config.client_cert = strip_nm_file_path(client_cert);
    }

    ieee_8021x_config.client_cert_password =
        get_optional_property(ieee_8021x, "client-cert-password")?;

    if let Ok(private_key) = get_property::<zvariant::Array>(ieee_8021x, "private-key") {
        let private_key: String = private_key
            .iter()
            .map(|u| u.downcast_ref::<u8>())
            .collect::<Result<Vec<u8>, zvariant::Error>>()?
            .iter()
            .map(|x| *x as char)
            .collect();
        ieee_8021x_config.private_key = strip_nm_file_path(private_key);
    }

    ieee_8021x_config.private_key_password =
        get_optional_property(ieee_8021x, "private-key-password")?;
    ieee_8021x_config.anonymous_identity = get_optional_property(ieee_8021x, "anonymous-identity")?;
    ieee_8021x_config.peap_version = get_optional_property(ieee_8021x, "phase1-peapver")?;
    if let Ok(peap_label) = get_property::<String>(ieee_8021x, "phase1-peaplabel") {
        ieee_8021x_config.peap_label = peap_label == "1";
    }

    Ok(Some(ieee_8021x_config))
}

// Strips NetworkManager path from "file://{path}\0" so only path remains.
fn strip_nm_file_path(path: String) -> Option<String> {
    let stripped_path = path
        .strip_prefix("file://")
        .and_then(|x| x.strip_suffix("\0"))?;
    Some(stripped_path.to_string())
}

/// Determines whether a value is empty.
///
/// TODO: Generalize for other kind of values, like dicts or arrays.
///
/// * `value`: value to analyze
fn is_empty_value(value: &zvariant::Value) -> bool {
    if let Ok(value) = value.downcast_ref::<zvariant::Str>() {
        return value.is_empty();
    }

    if let Ok(value) = value.downcast_ref::<zvariant::Array>() {
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
    use crate::network::{
        model::*,
        nm::{
            dbus::{BOND_KEY, ETHERNET_KEY, INFINIBAND_KEY, WIRELESS_KEY, WIRELESS_SECURITY_KEY},
            error::NmError,
        },
    };
    use agama_lib::network::types::{BondMode, SSID};
    use cidr::IpInet;
    use std::{collections::HashMap, net::IpAddr, str::FromStr};
    use uuid::Uuid;
    use zbus::zvariant::{self, Array, Dict, OwnedValue, Value};

    #[test]
    fn test_connection_from_dbus() -> anyhow::Result<()> {
        let uuid = Uuid::new_v4().to_string();
        let connection_section = HashMap::from([
            ("id".to_string(), Value::new("eth0").try_to_owned()?),
            ("uuid".to_string(), Value::new(uuid).try_to_owned()?),
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
            ("method".to_string(), Value::new("auto").try_to_owned()?),
            (
                "address-data".to_string(),
                Value::new(address_v4_data).try_to_owned()?,
            ),
            (
                "gateway".to_string(),
                Value::new("192.168.0.1").try_to_owned()?,
            ),
            (
                "dns-data".to_string(),
                Value::new(vec!["192.168.0.2"]).try_to_owned()?,
            ),
            (
                "dns-search".to_string(),
                Value::new(vec!["suse.com", "example.com"]).try_to_owned()?,
            ),
            (
                "ignore-auto-dns".to_string(),
                Value::new(true).try_to_owned()?,
            ),
            (
                "route-data".to_string(),
                Value::new(route_v4_data).try_to_owned()?,
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
            ("method".to_string(), Value::new("auto").try_to_owned()?),
            (
                "address-data".to_string(),
                Value::new(address_v6_data).try_to_owned()?,
            ),
            (
                "gateway".to_string(),
                Value::new("::ffff:c0a8:101").try_to_owned()?,
            ),
            (
                "dns-data".to_string(),
                Value::new(vec!["::ffff:c0a8:102"]).try_to_owned()?,
            ),
            (
                "dns-search".to_string(),
                Value::new(vec!["suse.com", "suse.de"]).try_to_owned()?,
            ),
            (
                "route-data".to_string(),
                Value::new(route_v6_data).try_to_owned()?,
            ),
        ]);

        let match_section = HashMap::from([(
            "kernel-command-line".to_string(),
            Value::new(vec!["pci-0000:00:19.0"]).try_to_owned()?,
        )]);

        let dbus_conn = HashMap::from([
            ("connection".to_string(), connection_section),
            ("ipv4".to_string(), ipv4_section),
            ("ipv6".to_string(), ipv6_section),
            ("match".to_string(), match_section),
            (ETHERNET_KEY.to_string(), build_ethernet_section_from_dbus()),
        ]);

        let connection = connection_from_dbus(dbus_conn).unwrap();

        assert_eq!(connection.id, "eth0");
        let ip_config = connection.ip_config;
        let match_config = connection.match_config;
        assert_eq!(match_config.kernel, vec!["pci-0000:00:19.0"]);

        assert_eq!(connection.mac_address.to_string(), "12:34:56:78:9A:BC");

        assert_eq!(connection.mtu, 9000_u32);

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
        assert_eq!(ip_config.dns_searchlist.len(), 3);
        assert!(ip_config.dns_searchlist.contains(&"suse.com".to_string()));
        assert!(ip_config.dns_searchlist.contains(&"suse.de".to_string()));
        assert!(ip_config
            .dns_searchlist
            .contains(&"example.com".to_string()));
        assert!(ip_config.ignore_auto_dns);
        assert_eq!(ip_config.method4, Ipv4Method::Auto);
        assert_eq!(ip_config.method6, Ipv6Method::Auto);
        assert_eq!(
            ip_config.routes4,
            vec![IpRoute {
                destination: IpInet::new("192.168.0.0".parse().unwrap(), 24_u8).unwrap(),
                next_hop: Some(IpAddr::from_str("192.168.0.1").unwrap()),
                metric: Some(100)
            }]
        );
        assert_eq!(
            ip_config.routes6,
            vec![IpRoute {
                destination: IpInet::new("2001:db8::".parse().unwrap(), 64_u8).unwrap(),
                next_hop: Some(IpAddr::from_str("2001:db8::1").unwrap()),
                metric: Some(100)
            }]
        );
        Ok(())
    }

    #[test]
    fn test_connection_from_dbus_missing_connection() {
        let dbus_conn: HashMap<String, HashMap<String, OwnedValue>> = HashMap::new();
        let error = connection_from_dbus(dbus_conn).unwrap_err();
        assert!(matches!(error, NmError::MissingConnectionSection));
    }

    #[test]
    fn test_connection_from_dbus_wireless() -> anyhow::Result<()> {
        let uuid = Uuid::new_v4().to_string();
        let connection_section = HashMap::from([
            ("id".to_string(), Value::new("wlan0").try_to_owned()?),
            ("uuid".to_string(), Value::new(uuid).try_to_owned()?),
        ]);

        let wireless_section = HashMap::from([
            (
                "mode".to_string(),
                Value::new("infrastructure").try_to_owned()?,
            ),
            (
                "ssid".to_string(),
                Value::new("agama".as_bytes()).try_to_owned()?,
            ),
            (
                "assigned-mac-address".to_string(),
                Value::new("13:45:67:89:AB:CD").try_to_owned()?,
            ),
            ("band".to_string(), Value::new("a").try_to_owned()?),
            ("channel".to_string(), Value::new(32_u32).try_to_owned()?),
            (
                "bssid".to_string(),
                Value::new(vec![18_u8, 52_u8, 86_u8, 120_u8, 154_u8, 188_u8]).try_to_owned()?,
            ),
            ("hidden".to_string(), Value::new(false).try_to_owned()?),
        ]);

        let security_section = HashMap::from([
            (
                "key-mgmt".to_string(),
                Value::new("wpa-psk").try_to_owned()?,
            ),
            (
                "wep-key-type".to_string(),
                Value::new(WEPKeyType::Key as u32).try_to_owned()?,
            ),
            ("auth-alg".to_string(), Value::new("open").try_to_owned()?),
            (
                "wep-tx-keyidx".to_string(),
                Value::new(1_u32).try_to_owned()?,
            ),
            (
                "group".to_string(),
                Value::new(vec!["wep40", "tkip"]).try_to_owned()?,
            ),
            (
                "pairwise".to_string(),
                Value::new(vec!["tkip", "ccmp"]).try_to_owned()?,
            ),
            ("proto".to_string(), Value::new(vec!["rsn"]).try_to_owned()?),
            ("pmf".to_string(), Value::new(2_i32).try_to_owned()?),
        ]);

        let dbus_conn = HashMap::from([
            ("connection".to_string(), connection_section),
            (WIRELESS_KEY.to_string(), wireless_section),
            (WIRELESS_SECURITY_KEY.to_string(), security_section),
        ]);

        let connection = connection_from_dbus(dbus_conn).unwrap();
        assert_eq!(connection.mac_address.to_string(), "13:45:67:89:AB:CD");
        assert!(matches!(connection.config, ConnectionConfig::Wireless(_)));
        if let ConnectionConfig::Wireless(wireless) = &connection.config {
            assert_eq!(wireless.ssid, SSID(vec![97, 103, 97, 109, 97]));
            assert_eq!(wireless.mode, WirelessMode::Infra);
            assert_eq!(wireless.security, SecurityProtocol::WPA2);
            assert_eq!(wireless.band, Some(WirelessBand::A));
            assert_eq!(wireless.channel, 32_u32);
            assert_eq!(
                wireless.bssid,
                Some(macaddr::MacAddr6::from_str("12:34:56:78:9A:BC").unwrap())
            );
            assert!(!wireless.hidden);
            assert_eq!(wireless.wep_security, None);
            assert_eq!(
                wireless.group_algorithms,
                vec![GroupAlgorithm::Wep40, GroupAlgorithm::Tkip]
            );
            assert_eq!(
                wireless.pairwise_algorithms,
                vec![PairwiseAlgorithm::Tkip, PairwiseAlgorithm::Ccmp]
            );
            assert_eq!(
                wireless.wpa_protocol_versions,
                vec![WPAProtocolVersion::Rsn]
            );
            assert_eq!(wireless.pmf, 2_i32);
        }

        Ok(())
    }

    #[test]
    fn test_connection_from_dbus_bonding() -> anyhow::Result<()> {
        let uuid = Uuid::new_v4().to_string();
        let connection_section = HashMap::from([
            ("id".to_string(), Value::new("bond0").try_to_owned()?),
            ("uuid".to_string(), Value::new(uuid).try_to_owned()?),
        ]);

        let bond_options = Value::new(HashMap::from([(
            "options".to_string(),
            HashMap::from([(
                "mode".to_string(),
                Value::new("active-backup").try_to_owned()?,
            )]),
        )]));

        let dbus_conn = HashMap::from([
            ("connection".to_string(), connection_section),
            (BOND_KEY.to_string(), bond_options.try_into().unwrap()),
        ]);

        let connection = connection_from_dbus(dbus_conn).unwrap();
        if let ConnectionConfig::Bond(config) = connection.config {
            assert_eq!(config.mode, BondMode::ActiveBackup);
        }

        Ok(())
    }

    #[test]
    fn test_connection_from_dbus_infiniband() -> anyhow::Result<()> {
        let uuid = Uuid::new_v4().to_string();
        let connection_section = HashMap::from([
            ("id".to_string(), Value::new("ib0").try_to_owned()?),
            ("uuid".to_string(), Value::new(uuid).try_to_owned()?),
        ]);

        let infiniband_section = HashMap::from([
            ("p-key".to_string(), Value::new(0x8001_i32).try_to_owned()?),
            ("parent".to_string(), Value::new("ib0").try_to_owned()?),
            (
                "transport-mode".to_string(),
                Value::new("datagram").try_to_owned()?,
            ),
        ]);

        let dbus_conn = HashMap::from([
            ("connection".to_string(), connection_section),
            (INFINIBAND_KEY.to_string(), infiniband_section),
        ]);

        let connection = connection_from_dbus(dbus_conn).unwrap();
        let ConnectionConfig::Infiniband(infiniband) = &connection.config else {
            panic!("Wrong connection type")
        };
        assert_eq!(infiniband.p_key, Some(0x8001));
        assert_eq!(infiniband.parent, Some("ib0".to_string()));
        assert_eq!(infiniband.transport_mode, InfinibandTransportMode::Datagram);

        Ok(())
    }

    #[test]
    fn test_connection_from_dbus_ieee_8021x() -> anyhow::Result<()> {
        let connection_section = HashMap::from([
            ("id".to_string(), Value::new("eap0").try_to_owned()?),
            (
                "uuid".to_string(),
                Value::new(Uuid::new_v4().to_string()).try_to_owned()?,
            ),
        ]);

        let ieee_8021x_section = HashMap::from([
            (
                "eap".to_string(),
                Value::new(vec!["md5", "leap"]).try_to_owned()?,
            ),
            ("phase2-auth".to_string(), Value::new("gtc").try_to_owned()?),
            (
                "identity".to_string(),
                Value::new("test_user").try_to_owned()?,
            ),
            (
                "password".to_string(),
                Value::new("test_pw").try_to_owned()?,
            ),
            (
                "ca-cert".to_string(),
                Value::new("file:///path/to/ca_cert.pem\0".as_bytes()).try_to_owned()?,
            ),
            (
                "ca-cert-password".to_string(),
                Value::new("ca_cert_pw").try_to_owned()?,
            ),
            (
                "client-cert".to_string(),
                Value::new("not_valid_value".as_bytes()).try_to_owned()?,
            ),
            (
                "client-cert-password".to_string(),
                Value::new("client_cert_pw").try_to_owned()?,
            ),
            (
                "private-key".to_string(),
                Value::new("file://relative_path/private_key\0".as_bytes()).try_to_owned()?,
            ),
            (
                "private-key-password".to_string(),
                Value::new("private_key_pw").try_to_owned()?,
            ),
            (
                "anonymous-identity".to_string(),
                Value::new("anon_identity").try_to_owned()?,
            ),
            (
                "phase1-peaplabel".to_string(),
                Value::new("0").try_to_owned()?,
            ),
            (
                "phase1-peapver".to_string(),
                Value::new("1").try_to_owned()?,
            ),
        ]);

        let dbus_conn = HashMap::from([
            ("connection".to_string(), connection_section),
            (super::IEEE_8021X_KEY.to_string(), ieee_8021x_section),
            (super::LOOPBACK_KEY.to_string(), HashMap::new()),
        ]);

        let connection = connection_from_dbus(dbus_conn).unwrap();
        let Some(config) = &connection.ieee_8021x_config else {
            panic!("No eap config set")
        };
        assert_eq!(config.eap, vec![EAPMethod::MD5, EAPMethod::LEAP]);
        assert_eq!(config.phase2_auth, Some(Phase2AuthMethod::GTC));
        assert_eq!(config.identity, Some("test_user".to_string()));
        assert_eq!(config.password, Some("test_pw".to_string()));
        assert_eq!(config.ca_cert, Some("/path/to/ca_cert.pem".to_string()));
        assert_eq!(config.ca_cert_password, Some("ca_cert_pw".to_string()));
        assert_eq!(config.client_cert, None);
        assert_eq!(
            config.client_cert_password,
            Some("client_cert_pw".to_string())
        );
        assert_eq!(
            config.private_key,
            Some("relative_path/private_key".to_string())
        );
        assert_eq!(
            config.private_key_password,
            Some("private_key_pw".to_string())
        );
        assert_eq!(config.anonymous_identity, Some("anon_identity".to_string()));
        assert_eq!(config.peap_version, Some("1".to_string()));
        assert!(!config.peap_label);

        Ok(())
    }

    #[test]
    fn test_dbus_from_infiniband_connection() -> anyhow::Result<()> {
        let config = InfinibandConfig {
            p_key: Some(0x8002),
            parent: Some("ib1".to_string()),
            transport_mode: InfinibandTransportMode::Connected,
        };
        let mut infiniband = build_base_connection();
        infiniband.config = ConnectionConfig::Infiniband(config);
        let infiniband_dbus = connection_to_dbus(&infiniband, None);

        let infiniband = infiniband_dbus.get(INFINIBAND_KEY).unwrap();
        let p_key = infiniband.get("p-key").unwrap().downcast_ref::<i32>()?;
        assert_eq!(p_key, 0x8002);
        let parent: &str = infiniband.get("parent").unwrap().downcast_ref().unwrap();
        assert_eq!(parent, "ib1");
        let transport_mode: &str = infiniband
            .get("transport-mode")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(
            transport_mode,
            InfinibandTransportMode::Connected.to_string()
        );

        Ok(())
    }

    #[test]
    fn test_dbus_from_wireless_connection() -> anyhow::Result<()> {
        let config = WirelessConfig {
            mode: WirelessMode::Infra,
            security: SecurityProtocol::WPA2,
            password: Some("wpa-password".to_string()),
            ssid: SSID(vec![97, 103, 97, 109, 97]),
            band: Some(WirelessBand::BG),
            channel: 10,
            bssid: Some(macaddr::MacAddr6::from_str("12:34:56:78:9A:BC").unwrap()),
            wep_security: Some(WEPSecurity {
                auth_alg: WEPAuthAlg::Open,
                wep_key_type: WEPKeyType::Key,
                wep_key_index: 1,
                keys: vec![
                    "5b73215e232f4c577c5073455d".to_string(),
                    "hello".to_string(),
                ],
            }),
            hidden: true,
            group_algorithms: vec![GroupAlgorithm::Wep104, GroupAlgorithm::Tkip],
            pairwise_algorithms: vec![PairwiseAlgorithm::Tkip, PairwiseAlgorithm::Ccmp],
            wpa_protocol_versions: vec![WPAProtocolVersion::Wpa],
            pmf: 1,
            ..Default::default()
        };
        let mut wireless = build_base_connection();
        wireless.config = ConnectionConfig::Wireless(config);
        let wireless_dbus = connection_to_dbus(&wireless, None);

        let wireless = wireless_dbus.get(WIRELESS_KEY).unwrap();
        let mode: &str = wireless.get("mode").unwrap().downcast_ref().unwrap();
        assert_eq!(mode, "infrastructure");
        let mac_address: &str = wireless
            .get("assigned-mac-address")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(mac_address, "FD:CB:A9:87:65:43");

        let ssid: &zvariant::Array = wireless.get("ssid").unwrap().downcast_ref().unwrap();
        let ssid: Vec<u8> = ssid
            .iter()
            .map(|u| u.downcast_ref::<u8>().unwrap())
            .collect();
        assert_eq!(ssid, "agama".as_bytes());

        let band: &str = wireless.get("band").unwrap().downcast_ref().unwrap();
        assert_eq!(band, "bg");

        let channel: u32 = wireless.get("channel").unwrap().downcast_ref().unwrap();
        assert_eq!(channel, 10);

        let bssid: &zvariant::Array = wireless.get("bssid").unwrap().downcast_ref().unwrap();
        let bssid: Vec<u8> = bssid
            .iter()
            .map(|u| u.downcast_ref::<u8>().unwrap())
            .collect();
        assert_eq!(bssid, vec![18, 52, 86, 120, 154, 188]);

        let hidden: bool = wireless.get("hidden").unwrap().downcast_ref().unwrap();
        assert!(hidden);

        let security = wireless_dbus.get(WIRELESS_SECURITY_KEY).unwrap();
        let key_mgmt: &str = security.get("key-mgmt").unwrap().downcast_ref().unwrap();
        assert_eq!(key_mgmt, "wpa-psk");

        let password: &str = security.get("psk").unwrap().downcast_ref().unwrap();
        assert_eq!(password, "wpa-password");

        let auth_alg: WEPAuthAlg = security
            .get("auth-alg")
            .unwrap()
            .downcast_ref::<String>()?
            .as_str()
            .try_into()?;
        assert_eq!(auth_alg, WEPAuthAlg::Open);

        let wep_key_type: u32 = security
            .get("wep-key-type")
            .unwrap()
            .downcast_ref::<u32>()?;
        assert_eq!(wep_key_type, WEPKeyType::Key as u32);

        let wep_key_index: u32 = security
            .get("wep-tx-keyidx")
            .unwrap()
            .downcast_ref::<u32>()?;
        assert_eq!(wep_key_index, 1);

        let wep_key0: &str = security.get("wep-key0").unwrap().downcast_ref().unwrap();
        assert_eq!(wep_key0, "5b73215e232f4c577c5073455d");
        let wep_key1: &str = security.get("wep-key1").unwrap().downcast_ref().unwrap();
        assert_eq!(wep_key1, "hello");

        let group_algorithms: &zvariant::Array =
            security.get("group").unwrap().downcast_ref().unwrap();
        let group_algorithms: Vec<GroupAlgorithm> = group_algorithms
            .iter()
            .map(|x| x.downcast_ref::<String>().unwrap())
            .collect::<Vec<String>>()
            .iter()
            .map(|x| GroupAlgorithm::from_str(x.as_str()).unwrap())
            .collect();
        assert_eq!(
            group_algorithms,
            vec![GroupAlgorithm::Wep104, GroupAlgorithm::Tkip]
        );

        let pairwise_algorithms: &zvariant::Array =
            security.get("pairwise").unwrap().downcast_ref().unwrap();
        let pairwise_algorithms: Vec<PairwiseAlgorithm> = pairwise_algorithms
            .iter()
            .map(|x| x.downcast_ref::<String>().unwrap())
            .collect::<Vec<String>>()
            .iter()
            .map(|x| PairwiseAlgorithm::from_str(x).unwrap())
            .collect();
        assert_eq!(
            pairwise_algorithms,
            vec![PairwiseAlgorithm::Tkip, PairwiseAlgorithm::Ccmp]
        );

        let wpa_protocol_versions: &zvariant::Array =
            security.get("proto").unwrap().downcast_ref().unwrap();
        let wpa_protocol_versions: Vec<WPAProtocolVersion> = wpa_protocol_versions
            .iter()
            .map(|x| x.downcast_ref::<String>().unwrap())
            .collect::<Vec<String>>()
            .iter()
            .map(|x| WPAProtocolVersion::from_str(x).unwrap())
            .collect();
        assert_eq!(wpa_protocol_versions, vec![WPAProtocolVersion::Wpa]);

        let pmf: i32 = security.get("pmf").unwrap().downcast_ref()?;
        assert_eq!(pmf, 1);

        Ok(())
    }

    #[test]
    fn test_dbus_from_ieee_8021x() {
        let ieee_8021x_config = IEEE8021XConfig {
            eap: vec![
                EAPMethod::from_str("tls").unwrap(),
                EAPMethod::from_str("peap").unwrap(),
            ],
            phase2_auth: Some(Phase2AuthMethod::MSCHAPV2),
            identity: Some("test_user".to_string()),
            password: Some("test_pw".to_string()),
            ca_cert: Some("/path/to/ca_cert.pem".to_string()),
            ca_cert_password: Some("ca_cert_pw".to_string()),
            client_cert: Some("/client_cert".to_string()),
            client_cert_password: Some("client_cert_pw".to_string()),
            private_key: Some("relative_path/private_key".to_string()),
            private_key_password: Some("private_key_pw".to_string()),
            anonymous_identity: Some("anon_identity".to_string()),
            peap_version: Some("0".to_string()),
            peap_label: true,
        };
        let mut conn = build_base_connection();
        conn.ieee_8021x_config = Some(ieee_8021x_config);
        let conn_dbus = connection_to_dbus(&conn, None);

        let config = conn_dbus.get(super::IEEE_8021X_KEY).unwrap();
        let eap: &Array = config.get("eap").unwrap().downcast_ref().unwrap();
        let eap: Vec<String> = eap
            .iter()
            .flat_map(|x| x.downcast_ref::<String>().ok())
            .collect();
        assert_eq!(eap, ["tls".to_string(), "peap".to_string()]);
        let identity: &str = config.get("identity").unwrap().downcast_ref().unwrap();
        assert_eq!(identity, "test_user");
        let phase2_auth: &str = config.get("phase2-auth").unwrap().downcast_ref().unwrap();
        assert_eq!(phase2_auth, "mschapv2");
        let password: &str = config.get("password").unwrap().downcast_ref().unwrap();
        assert_eq!(password, "test_pw");
        let ca_cert: &Array = config.get("ca-cert").unwrap().downcast_ref().unwrap();
        let ca_cert: String = ca_cert
            .iter()
            .map(|x| x.downcast_ref::<u8>().unwrap() as char)
            .collect();
        assert_eq!(ca_cert, "file:///path/to/ca_cert.pem\0");
        let ca_cert_password: &str = config
            .get("ca-cert-password")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(ca_cert_password, "ca_cert_pw");
        let client_cert: &Array = config.get("client-cert").unwrap().downcast_ref().unwrap();
        let client_cert: String = client_cert
            .iter()
            .map(|x| x.downcast_ref::<u8>().unwrap() as char)
            .collect();
        assert_eq!(client_cert, "file:///client_cert\0");
        let client_cert_password: &str = config
            .get("client-cert-password")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(client_cert_password, "client_cert_pw");
        let private_key: &Array = config.get("private-key").unwrap().downcast_ref().unwrap();
        let private_key: String = private_key
            .iter()
            .map(|x| x.downcast_ref::<u8>().unwrap() as char)
            .collect();
        assert_eq!(private_key, "file://relative_path/private_key\0");
        let private_key_password: &str = config
            .get("private-key-password")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(private_key_password, "private_key_pw");
        let anonymous_identity: &str = config
            .get("anonymous-identity")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(anonymous_identity, "anon_identity");
        let peap_version: &str = config
            .get("phase1-peapver")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(peap_version, "0");
        let peap_label: &str = config
            .get("phase1-peaplabel")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(peap_label, "1");
    }

    #[test]
    fn test_dbus_from_ethernet_connection() {
        let ethernet = build_base_connection();
        let ethernet_dbus = connection_to_dbus(&ethernet, None);
        check_dbus_base_connection(&ethernet_dbus);
    }

    #[test]
    fn test_merge_dbus_connections() -> anyhow::Result<()> {
        let mut original = OwnedNestedHash::new();
        let connection = HashMap::from([
            (
                "id".to_string(),
                Value::new("conn0".to_string()).try_to_owned()?,
            ),
            (
                "type".to_string(),
                Value::new(ETHERNET_KEY.to_string()).try_to_owned()?,
            ),
        ]);

        let ipv4 = HashMap::from([
            (
                "method".to_string(),
                Value::new("manual".to_string()).try_to_owned()?,
            ),
            (
                "gateway".to_string(),
                Value::new("192.168.1.1".to_string()).try_to_owned()?,
            ),
            (
                "addresses".to_string(),
                Value::new(vec!["192.168.1.1"]).try_to_owned()?,
            ),
        ]);

        let ipv6 = HashMap::from([
            (
                "method".to_string(),
                Value::new("manual".to_string()).try_to_owned()?,
            ),
            (
                "gateway".to_string(),
                Value::new("::ffff:c0a8:101".to_string()).try_to_owned()?,
            ),
            (
                "addresses".to_string(),
                Value::new(vec!["::ffff:c0a8:102"]).try_to_owned()?,
            ),
        ]);

        original.insert("connection".to_string(), connection);
        original.insert("ipv4".to_string(), ipv4);
        original.insert("ipv6".to_string(), ipv6);

        let ethernet = Connection {
            id: "agama".to_string(),
            interface: Some("eth0".to_string()),
            ..Default::default()
        };
        let updated = connection_to_dbus(&ethernet, None);

        let merged = merge_dbus_connections(&original, &updated)?;
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
        // there are not addresses ("address-data"), so no gateway is allowed
        assert!(ipv4.get("gateway").is_none());
        assert!(ipv4.get("addresses").is_none());

        let ipv6 = merged.get("ipv6").unwrap();
        assert_eq!(
            *ipv6.get("method").unwrap(),
            Value::new("disabled".to_string())
        );
        // there are not addresses ("address-data"), so no gateway is allowed
        assert!(ipv6.get("gateway").is_none());

        Ok(())
    }

    #[test]
    fn test_merged_connections_are_clean() -> anyhow::Result<()> {
        let mut original = OwnedNestedHash::new();
        let connection = HashMap::from([
            (
                "id".to_string(),
                Value::new("conn0".to_string()).try_to_owned()?,
            ),
            (
                "type".to_string(),
                Value::new(ETHERNET_KEY.to_string()).try_to_owned()?,
            ),
            (
                "interface-name".to_string(),
                Value::new("eth0".to_string()).try_to_owned()?,
            ),
        ]);
        let ethernet = HashMap::from([
            (
                "assigned-mac-address".to_string(),
                Value::new("12:34:56:78:9A:BC".to_string()).try_to_owned()?,
            ),
            ("mtu".to_string(), Value::new(9000).try_to_owned()?),
        ]);
        original.insert("connection".to_string(), connection);
        original.insert(ETHERNET_KEY.to_string(), ethernet);

        let updated = Connection {
            interface: Some("".to_string()),
            mac_address: MacAddress::Unset,
            ..Default::default()
        };
        let updated = connection_to_dbus(&updated, None);

        let merged = merge_dbus_connections(&original, &updated)?;
        let connection = merged.get("connection").unwrap();
        assert_eq!(connection.get("interface-name"), None);
        let ethernet = merged.get(ETHERNET_KEY).unwrap();
        assert_eq!(ethernet.get("assigned-mac-address"), Some(&Value::from("")));
        assert_eq!(ethernet.get("mtu"), Some(&Value::from(0_u32)));

        Ok(())
    }

    fn build_ethernet_section_from_dbus() -> HashMap<String, OwnedValue> {
        HashMap::from([
            ("auto-negotiate".to_string(), true.into()),
            (
                "assigned-mac-address".to_string(),
                Value::new("12:34:56:78:9A:BC").try_to_owned().unwrap(),
            ),
            (
                "mtu".to_string(),
                Value::new(9000_u32).try_to_owned().unwrap(),
            ),
        ])
    }

    fn build_base_connection() -> Connection {
        let addresses = vec![
            "192.168.0.2/24".parse().unwrap(),
            "::ffff:c0a8:2".parse().unwrap(),
        ];
        let ip_config = IpConfig {
            addresses,
            gateway4: Some("192.168.0.1".parse().unwrap()),
            gateway6: Some("::ffff:c0a8:1".parse().unwrap()),
            routes4: vec![IpRoute {
                destination: IpInet::new("192.168.0.0".parse().unwrap(), 24_u8).unwrap(),
                next_hop: Some(IpAddr::from_str("192.168.0.1").unwrap()),
                metric: Some(100),
            }],
            routes6: vec![IpRoute {
                destination: IpInet::new("2001:db8::".parse().unwrap(), 64_u8).unwrap(),
                next_hop: Some(IpAddr::from_str("2001:db8::1").unwrap()),
                metric: Some(100),
            }],
            dns_searchlist: vec!["suse.com".to_string(), "suse.de".to_string()],
            ..Default::default()
        };
        let mac_address = MacAddress::from_str("FD:CB:A9:87:65:43").unwrap();
        Connection {
            id: "agama".to_string(),
            ip_config,
            mac_address,
            mtu: 1500_u32,
            ..Default::default()
        }
    }

    fn check_dbus_base_connection(conn_dbus: &NestedHash) {
        let connection_dbus = conn_dbus.get("connection").unwrap();
        let id: &str = connection_dbus.get("id").unwrap().downcast_ref().unwrap();
        assert_eq!(id, "agama");

        let ethernet_connection = conn_dbus.get(ETHERNET_KEY).unwrap();
        let mac_address: &str = ethernet_connection
            .get("assigned-mac-address")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(mac_address, "FD:CB:A9:87:65:43");

        assert_eq!(
            ethernet_connection
                .get("mtu")
                .unwrap()
                .downcast_ref::<u32>()
                .unwrap(),
            1500_u32
        );

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
        let dns_searchlist_array: Array = ipv4_dbus
            .get("dns-search")
            .unwrap()
            .downcast_ref::<Value>()
            .unwrap()
            .try_into()
            .unwrap();
        let dns_searchlist: Vec<String> = dns_searchlist_array
            .iter()
            .flat_map(|x| x.downcast_ref::<String>().ok())
            .collect();
        assert_eq!(dns_searchlist.len(), 2);
        assert!(dns_searchlist.contains(&"suse.com".to_string()));
        assert!(dns_searchlist.contains(&"suse.de".to_string()));
        assert!(!ipv4_dbus
            .get("ignore-auto-dns")
            .unwrap()
            .downcast_ref::<bool>()
            .unwrap());

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
        let dns_searchlist_array: Array = ipv6_dbus
            .get("dns-search")
            .unwrap()
            .downcast_ref::<Value>()
            .unwrap()
            .try_into()
            .unwrap();
        let dns_searchlist: Vec<String> = dns_searchlist_array
            .iter()
            .flat_map(|x| x.downcast_ref::<String>().ok())
            .collect();
        assert_eq!(dns_searchlist.len(), 2);
        assert!(dns_searchlist.contains(&"suse.com".to_string()));
        assert!(dns_searchlist.contains(&"suse.de".to_string()));
        assert!(!ipv6_dbus
            .get("ignore-auto-dns")
            .unwrap()
            .downcast_ref::<bool>()
            .unwrap());
    }
}
