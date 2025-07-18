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
use crate::model::*;
use crate::types::{BondMode, SSID};
use agama_utils::dbus::{
    get_optional_property, get_property, to_owned_hash, NestedHash, OwnedNestedHash,
};
use cidr::IpInet;
use macaddr::MacAddr6;
use semver::{Version, VersionReq};
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
const OVS_PORT: &str = "ovs-port";
const OVS_INTERFACE: &str = "ovs-interface";
const OVS_BRIDGE: &str = "ovs-bridge";

/// Converts a connection struct into a HashMap that can be sent over D-Bus.
///
/// * `conn`: Connection to convert.
pub fn connection_to_dbus<'a>(
    conn: &'a Connection,
    controller: Option<&'a Connection>,
    nm_version: Version,
) -> NestedHash<'a> {
    let mut result = NestedHash::new();
    let mut connection_dbus = HashMap::from([
        ("id", conn.id.as_str().into()),
        ("type", ETHERNET_KEY.into()),
        ("autoconnect", conn.autoconnect.into()),
    ]);

    if let Some(interface) = &conn.interface {
        connection_dbus.insert("interface-name", interface.to_owned().into());
    }

    if let Some(controller) = controller {
        let port_type = match controller.config {
            ConnectionConfig::Bond(_) => BOND_KEY,
            ConnectionConfig::Bridge(_) => BRIDGE_KEY,
            ConnectionConfig::OvsPort(_) => OVS_PORT,
            ConnectionConfig::OvsBridge(_) => OVS_BRIDGE,
            _ => {
                tracing::error!("Controller {} has unhandled config type", controller.id);
                ""
            }
        };
        if VersionReq::parse(">=1.46.0").unwrap().matches(&nm_version) {
            connection_dbus.insert("port-type", port_type.into());
        } else {
            connection_dbus.insert("slave-type", port_type.into());
        }
        let master = controller
            .interface
            .as_deref()
            .unwrap_or(controller.id.as_str());
        connection_dbus.insert("master", master.into());
    } else {
        if VersionReq::parse(">=1.46.0").unwrap().matches(&nm_version) {
            connection_dbus.insert("port-type", "".into());
        } else {
            connection_dbus.insert("slave-type", "".into());
        }
        connection_dbus.insert("master", "".into());
    }

    if let Some(zone) = &conn.firewall_zone {
        connection_dbus.insert("zone", zone.into());
    }

    result.insert("ipv4", ip_config_to_ipv4_dbus(&conn.ip_config, &nm_version));
    result.insert("ipv6", ip_config_to_ipv6_dbus(&conn.ip_config, &nm_version));
    result.insert("match", match_config_to_dbus(&conn.match_config));

    if conn.is_ethernet() {
        let mut ethernet_config = HashMap::from([
            (
                "assigned-mac-address",
                Value::new(conn.custom_mac_address.to_string()),
            ),
            ("mtu", Value::new(conn.mtu)),
        ]);

        if let Some(mac) = conn.mac_address {
            ethernet_config.insert("mac-address", Value::new(mac.as_bytes()));
        }

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
                        Value::new(conn.custom_mac_address.to_string()),
                    ),
                ]));

                if let Some(mac) = conn.mac_address {
                    wireless_dbus_key.insert("mac-address", Value::new(mac.as_bytes()));
                }
            }

            result.extend(wireless_dbus);
        }
        ConnectionConfig::Bond(bond) => {
            connection_dbus.insert("type", BOND_KEY.into());
            connection_dbus.insert("autoconnect-slaves", 1.into());
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
            connection_dbus.insert("autoconnect-slaves", 1.into());
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
        ConnectionConfig::OvsBridge(bridge) => {
            connection_dbus.insert("type", OVS_BRIDGE.into());
            connection_dbus.insert("autoconnect-slaves", 1.into());
            result.insert(OVS_BRIDGE, ovs_bridge_config_to_dbus(bridge));
        }
        ConnectionConfig::OvsInterface(ifc) => {
            connection_dbus.insert("type", OVS_INTERFACE.into());
            result.insert(OVS_INTERFACE, ovs_interface_config_to_dbus(ifc));
        }
        ConnectionConfig::OvsPort(port) => {
            connection_dbus.insert("type", OVS_PORT.into());
            connection_dbus.insert("autoconnect-slaves", 1.into());
            result.insert(OVS_PORT, ovs_port_config_to_dbus(port));
        }
        _ => {}
    }

    match &conn.port_config {
        PortConfig::Bridge(bridge_port) => {
            result.insert(BRIDGE_PORT_KEY, bridge_port_config_to_dbus(bridge_port));
        }
        PortConfig::OvsBridge(_ovs_port) => {}
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

    if let Some(ovs_bridge) = ovs_bridge_from_dbus(&conn)? {
        connection.config = ConnectionConfig::OvsBridge(ovs_bridge);
        return Ok(connection);
    }

    if let Some(ovs_port) = ovs_port_from_dbus(&conn)? {
        connection.config = ConnectionConfig::OvsPort(ovs_port);
        return Ok(connection);
    }

    if let Some(ovs_interface) = ovs_interface_from_dbus(&conn)? {
        connection.config = ConnectionConfig::OvsInterface(ovs_interface);
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
    // FIXME: it should contain all the sections and attributes which can be absent and known by
    // agama in order to allow the user to remove them otherwise the original value will be kept
    let handled_by_agama: Vec<&str> = vec!["interface-name", "mac-address"];

    let mut merged = HashMap::with_capacity(original.len());
    for (key, orig_section) in original {
        let mut inner: HashMap<&str, zbus::zvariant::Value> =
            HashMap::with_capacity(orig_section.len());

        for (inner_key, value) in orig_section {
            if handled_by_agama.contains(&inner_key.as_str()) {
                tracing::info!(
                    "Do not insert '{}' from the original section '{}' as it is handled by agama",
                    &inner_key,
                    &key
                );
            } else {
                inner.insert(inner_key.as_str(), value.try_into()?);
            }
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

fn is_bridge_port(conn: &NestedHash) -> bool {
    if let Some(connection) = conn.get("connection") {
        if let Some(port_type) = connection.get("port-type") {
            if let Ok(s) = TryInto::<&str>::try_into(port_type) {
                return s == "bridge";
            }
        } else if let Some(port_type) = connection.get("slave-type") {
            if let Ok(s) = TryInto::<&str>::try_into(port_type) {
                return s == "bridge";
            }
        }
    }

    false
}

/// Cleans up the NestedHash that represents a connection.
///
/// If the connections is not a "bridge-port" anymore  it removes the "bridge-port" key.
///
/// It also removes empty files from the "connection" object like the "interface-name", "master",
/// "slave-type", "port-type" keys.
///
/// Finally, it removes removes the "addresses" and "dns" keys from the "ipv4" and "ipv6" objects,
/// which are replaced with "address-data".
///
/// * `conn`: connection represented as a NestedHash.
pub fn cleanup_dbus_connection(conn: &mut NestedHash) {
    if !is_bridge_port(conn) {
        conn.remove("bridge-port");
    }

    if let Some(connection) = conn.get_mut("connection") {
        if connection.get("interface-name").is_some_and(is_empty_value) {
            connection.remove("interface-name");
        }

        if connection.get("mac-address").is_some_and(is_empty_value) {
            connection.remove("mac-address");
        }

        if connection.get("master").is_some_and(is_empty_value) {
            connection.remove("master");
        }

        // prefer port-type over slave type
        if connection.get("slave-type").is_some() && connection.get("port-type").is_some() {
            connection.remove("slave-type");
        }

        if connection.get("slave-type").is_some_and(is_empty_value) {
            connection.remove("slave-type");
        }

        if connection.get("port-type").is_some_and(is_empty_value) {
            connection.remove("port-type");
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

fn ip_config_to_ipv4_dbus<'a>(
    ip_config: &'a IpConfig,
    nm_version: &Version,
) -> HashMap<&'a str, zvariant::Value<'a>> {
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

    if let Some(dns_priority4) = &ip_config.dns_priority4 {
        ipv4_dbus.insert("dns-priority", dns_priority4.into());
    }

    if let Some(dhcp4_settings) = &ip_config.dhcp4_settings {
        if VersionReq::parse(">=1.52.0").unwrap().matches(nm_version) {
            let dhcp_send_hostname = match dhcp4_settings.send_hostname {
                Some(send_hostname) => {
                    if send_hostname {
                        1
                    } else {
                        0
                    }
                }
                None => -1,
            };
            ipv4_dbus.insert("dhcp-send-hostname-v2", dhcp_send_hostname.into());
        } else {
            let dhcp_send_hostname = dhcp4_settings.send_hostname.unwrap_or(true);
            ipv4_dbus.insert("dhcp-send-hostname", dhcp_send_hostname.into());
        }
        let dhcp_send_release = match dhcp4_settings.send_release {
            Some(send_release) => {
                if send_release {
                    1
                } else {
                    0
                }
            }
            None => -1,
        };
        if VersionReq::parse(">=1.48.0").unwrap().matches(nm_version) {
            ipv4_dbus.insert("dhcp-send-release", dhcp_send_release.into());
        }
        if let Some(hostname) = &dhcp4_settings.hostname {
            ipv4_dbus.insert("dhcp-hostname", hostname.into());
        }
        if dhcp4_settings.client_id != DhcpClientId::Unset {
            ipv4_dbus.insert(
                "dhcp-client-id",
                dhcp4_settings.client_id.to_string().into(),
            );
        }
        if dhcp4_settings.iaid != DhcpIaid::Unset {
            ipv4_dbus.insert("dhcp-iaid", dhcp4_settings.iaid.to_string().into());
        }
    }

    ipv4_dbus
}

fn ip_config_to_ipv6_dbus<'a>(
    ip_config: &'a IpConfig,
    nm_version: &Version,
) -> HashMap<&'a str, zvariant::Value<'a>> {
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

    if let Some(ip6_privacy) = &ip_config.ip6_privacy {
        ipv6_dbus.insert("ip6-privacy", ip6_privacy.into());
    }

    if let Some(dns_priority6) = &ip_config.dns_priority6 {
        ipv6_dbus.insert("dns-priority", dns_priority6.into());
    }

    if let Some(dhcp6_settings) = &ip_config.dhcp6_settings {
        if VersionReq::parse(">=1.52.0").unwrap().matches(nm_version) {
            let dhcp_send_hostname = match dhcp6_settings.send_hostname {
                Some(send_hostname) => {
                    if send_hostname {
                        1
                    } else {
                        0
                    }
                }
                None => -1,
            };
            ipv6_dbus.insert("dhcp-send-hostname-v2", dhcp_send_hostname.into());
        } else {
            let dhcp_send_hostname = dhcp6_settings.send_hostname.unwrap_or(true);
            ipv6_dbus.insert("dhcp-send-hostname", dhcp_send_hostname.into());
        }
        let dhcp_send_release = match dhcp6_settings.send_release {
            Some(send_release) => {
                if send_release {
                    1
                } else {
                    0
                }
            }
            None => -1,
        };
        if VersionReq::parse(">=1.48.0").unwrap().matches(nm_version) {
            ipv6_dbus.insert("dhcp-send-release", dhcp_send_release.into());
        }
        if let Some(hostname) = &dhcp6_settings.hostname {
            ipv6_dbus.insert("dhcp-hostname", hostname.into());
        }
        if dhcp6_settings.duid != DhcpDuid::Unset {
            ipv6_dbus.insert("dhcp-duid", dhcp6_settings.duid.to_string().into());
        }
        if dhcp6_settings.iaid != DhcpIaid::Unset {
            ipv6_dbus.insert("dhcp-iaid", dhcp6_settings.iaid.to_string().into());
        }
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

    if config.security == SecurityProtocol::WEP && config.wep_security.is_none() {
        return NestedHash::from([(WIRELESS_KEY, wireless)]);
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

    if let Some(stp) = bridge.stp {
        hash.insert("stp", stp.into());
    }
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
        stp: get_optional_property(bridge, "stp")?,
        priority: get_optional_property(bridge, "priority")?,
        forward_delay: get_optional_property(bridge, "forward-delay")?,
        hello_time: get_optional_property(bridge, "hello-time")?,
        max_age: get_optional_property(bridge, "max-age")?,
        ageing_time: get_optional_property(bridge, "ageing-time")?,
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
    }))
}

fn ovs_bridge_config_to_dbus(br: &OvsBridgeConfig) -> HashMap<&str, zvariant::Value> {
    let mut br_config: HashMap<&str, zvariant::Value> = HashMap::new();

    if let Some(mcast_snooping) = br.mcast_snooping_enable {
        br_config.insert("mcast-snooping-enable", mcast_snooping.into());
    }

    if let Some(rstp) = br.rstp_enable {
        br_config.insert("rstp-enable", rstp.into());
    }

    if let Some(stp) = br.stp_enable {
        br_config.insert("stp-enable", stp.into());
    }

    br_config
}

fn ovs_bridge_from_dbus(conn: &OwnedNestedHash) -> Result<Option<OvsBridgeConfig>, NmError> {
    let Some(ovs_bridge) = conn.get(OVS_BRIDGE) else {
        return Ok(None);
    };

    Ok(Some(OvsBridgeConfig {
        mcast_snooping_enable: get_optional_property::<bool>(ovs_bridge, "mcast-snooping-enable")?,
        rstp_enable: get_optional_property::<bool>(ovs_bridge, "srtp-enable")?,
        stp_enable: get_optional_property::<bool>(ovs_bridge, "stp")?,
    }))
}

fn ovs_port_config_to_dbus(config: &OvsPortConfig) -> HashMap<&str, zvariant::Value> {
    let mut port_config: HashMap<&str, zvariant::Value> = HashMap::new();

    if let Some(tag) = &config.tag {
        port_config.insert("tag", tag.into());
    }

    port_config
}

fn ovs_port_from_dbus(conn: &OwnedNestedHash) -> Result<Option<OvsPortConfig>, NmError> {
    let Some(ovs_port) = conn.get(OVS_PORT) else {
        return Ok(None);
    };

    Ok(Some(OvsPortConfig {
        tag: get_optional_property(ovs_port, "tag")?,
    }))
}

fn ovs_interface_config_to_dbus(config: &OvsInterfaceConfig) -> HashMap<&str, zvariant::Value> {
    let mut ifc_config: HashMap<&str, zvariant::Value> = HashMap::new();

    ifc_config.insert("type", config.interface_type.to_string().clone().into());
    ifc_config
}

fn ovs_interface_from_dbus(conn: &OwnedNestedHash) -> Result<Option<OvsInterfaceConfig>, NmError> {
    let Some(ovs_interface) = conn.get(OVS_INTERFACE) else {
        return Ok(None);
    };

    let ifc_type: String = get_property(ovs_interface, "type")?;
    let ifc_type = OvsInterfaceType::from_str(&ifc_type)?;
    Ok(Some(OvsInterfaceConfig {
        interface_type: ifc_type,
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

    if let Some(autoconnect) = get_optional_property(connection, "autoconnect")? {
        base_connection.autoconnect = autoconnect;
    }

    if let Some(match_config) = conn.get("match") {
        base_connection.match_config = match_config_from_dbus(match_config)?;
    }

    if let Some(ethernet_config) = conn.get(ETHERNET_KEY) {
        base_connection.mac_address = mac_address6_from_dbus(ethernet_config)?;
        base_connection.custom_mac_address = custom_mac_address_from_dbus(ethernet_config)?;
        base_connection.mtu = mtu_from_dbus(ethernet_config);
    } else if let Some(wireless_config) = conn.get(WIRELESS_KEY) {
        base_connection.mac_address = mac_address6_from_dbus(wireless_config)?;
        base_connection.custom_mac_address = custom_mac_address_from_dbus(wireless_config)?;
        base_connection.mtu = mtu_from_dbus(wireless_config);
    }

    base_connection.ip_config = ip_config_from_dbus(conn)?;

    Ok(base_connection)
}

fn mac_address6_from_dbus(
    config: &HashMap<String, OwnedValue>,
) -> Result<Option<MacAddr6>, NmError> {
    if let Some(mac) = get_optional_property::<zvariant::Array>(config, "mac-address")? {
        let mac: Vec<u8> = mac
            .iter()
            .map(|u| u.downcast_ref::<u8>())
            .collect::<Result<Vec<u8>, _>>()?;

        if mac.len() != 6 {
            return Err(NmError::InvalidDBUSValue("mac-address".to_string()));
        }

        let [a, b, c, d, e, f] = mac[0..6] else {
            return Err(NmError::InvalidDBUSValue("mac-address".to_string()));
        };

        Ok(Some(MacAddr6::new(a, b, c, d, e, f)))
    } else {
        Ok(None)
    }
}

fn custom_mac_address_from_dbus(
    config: &HashMap<String, OwnedValue>,
) -> Result<MacAddress, NmError> {
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

        if let Some(dns_priority4) = get_optional_property(ipv4, "dns-priority")? {
            ip_config.dns_priority4 = Some(dns_priority4);
        }

        let mut dhcp4_settings = Dhcp4Settings::default();
        if let Some(dhcp_send_hostname) = get_optional_property(ipv4, "dhcp-send-hostname-v2")? {
            dhcp4_settings.send_hostname = match dhcp_send_hostname {
                -1 => None,
                0 => Some(false),
                _ => Some(true),
            };
        } else if let Some(dhcp_send_hostname) = get_optional_property(ipv4, "dhcp-send-hostname")?
        {
            dhcp4_settings.send_hostname = Some(dhcp_send_hostname);
        }
        if let Some(dhcp_send_release) = get_optional_property::<i32>(ipv4, "dhcp-send-release")? {
            dhcp4_settings.send_release = match dhcp_send_release {
                -1 => None,
                0 => Some(false),
                _ => Some(true),
            };
        }
        if let Some(dhcp_hostname) = get_optional_property(ipv4, "dhcp-hostname")? {
            dhcp4_settings.hostname = Some(dhcp_hostname);
        }
        dhcp4_settings.client_id = get_optional_property::<String>(ipv4, "dhcp-client-id")?.into();
        dhcp4_settings.iaid = get_optional_property::<String>(ipv4, "dhcp-iaid")?.into();
        if dhcp4_settings != Dhcp4Settings::default() {
            ip_config.dhcp4_settings = Some(dhcp4_settings);
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

        if let Some(ip6_privacy) = get_optional_property(ipv6, "ip6-privacy")? {
            ip_config.ip6_privacy = Some(ip6_privacy);
        }

        if let Some(dns_priority6) = get_optional_property(ipv6, "dns-priority")? {
            ip_config.dns_priority6 = Some(dns_priority6);
        }

        let mut dhcp6_settings = Dhcp6Settings::default();
        if let Some(dhcp_send_hostname) = get_optional_property(ipv6, "dhcp-send-hostname-v2")? {
            dhcp6_settings.send_hostname = match dhcp_send_hostname {
                -1 => None,
                0 => Some(false),
                _ => Some(true),
            };
        } else if let Some(dhcp_send_hostname) = get_optional_property(ipv6, "dhcp-send-hostname")?
        {
            dhcp6_settings.send_hostname = Some(dhcp_send_hostname);
        }
        if let Some(dhcp_send_release) = get_optional_property::<i32>(ipv6, "dhcp-send-release")? {
            dhcp6_settings.send_release = match dhcp_send_release {
                -1 => None,
                0 => Some(false),
                _ => Some(true),
            };
        }
        if let Some(dhcp_hostname) = get_optional_property(ipv6, "dhcp-hostname")? {
            dhcp6_settings.hostname = Some(dhcp_hostname);
        }
        dhcp6_settings.duid = get_optional_property::<String>(ipv6, "dhcp-duid")?.into();
        dhcp6_settings.iaid = get_optional_property::<String>(ipv6, "dhcp-iaid")?.into();
        if dhcp6_settings != Dhcp6Settings::default() {
            ip_config.dhcp6_settings = Some(dhcp6_settings);
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
        .map(|u| u.downcast_ref::<u8>())
        .collect::<Result<Vec<u8>, _>>()?;

    let mut wireless_config = WirelessConfig {
        mode: NmWirelessMode(mode).try_into()?,
        ssid: SSID(ssid),
        ..Default::default()
    };

    if let Some(band) = get_optional_property::<String>(wireless, "band")? {
        wireless_config.band = WirelessBand::try_from(band.as_str()).ok();
    }

    if let Some(bssid) = get_optional_property::<zvariant::Array>(wireless, "bssid")? {
        let bssid: Vec<u8> = bssid
            .iter()
            .map(|u| u.downcast_ref::<u8>())
            .collect::<Result<Vec<u8>, _>>()?;
        // FIXME: properly handle the failing case
        wireless_config.bssid = Some(MacAddr6::new(
            *bssid.first().unwrap(),
            *bssid.get(1).unwrap(),
            *bssid.get(2).unwrap(),
            *bssid.get(3).unwrap(),
            *bssid.get(4).unwrap(),
            *bssid.get(5).unwrap(),
        ));
    }

    if let Some(channel) = get_optional_property(wireless, "channel")? {
        wireless_config.channel = channel;
    }

    if let Some(hidden) = get_optional_property(wireless, "hidden")? {
        wireless_config.hidden = hidden;
    }

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

        if let Some(pmf) = get_optional_property(security, "pmf")? {
            wireless_config.pmf = pmf;
        }
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
    use crate::types::{BondMode, SSID};
    use crate::{
        model::*,
        nm::{
            dbus::{
                BOND_KEY, BRIDGE_KEY, ETHERNET_KEY, INFINIBAND_KEY, WIRELESS_KEY,
                WIRELESS_SECURITY_KEY,
            },
            error::NmError,
        },
    };
    use cidr::IpInet;
    use macaddr::MacAddr6;
    use std::{collections::HashMap, net::IpAddr, str::FromStr};
    use uuid::Uuid;
    use zbus::zvariant::{self, Array, Dict, OwnedValue, Value};

    // hash item
    fn hi<'a, T>(key: &str, value: T) -> anyhow::Result<(String, OwnedValue)>
    where
        T: Into<Value<'a>> + zbus::zvariant::Type,
    {
        Ok((key.to_string(), Value::new(value).try_to_owned()?))
    }

    #[test]
    fn test_connection_from_dbus() -> anyhow::Result<()> {
        let uuid = Uuid::new_v4().to_string();
        let connection_section = HashMap::from([
            hi("id", "eth0")?,
            hi("uuid", uuid)?,
            hi("autoconnect", false)?,
        ]);

        let address_v4_data = vec![HashMap::from([
            hi("address", "192.168.0.10")?,
            hi("prefix", 24_u32)?,
        ])];

        let route_v4_data = vec![HashMap::from([
            ("dest".to_string(), Value::new("192.168.0.0")),
            ("prefix".to_string(), Value::new(24_u32)),
            ("next-hop".to_string(), Value::new("192.168.0.1")),
            ("metric".to_string(), Value::new(100_u32)),
        ])];

        let ipv4_section = HashMap::from([
            hi("method", "auto")?,
            hi("address-data", address_v4_data)?,
            hi("gateway", "192.168.0.1")?,
            hi("dns-data", vec!["192.168.0.2"])?,
            hi("dns-search", vec!["suse.com", "example.com"])?,
            hi("ignore-auto-dns", true)?,
            hi("route-data", route_v4_data)?,
            hi("dhcp-send-hostname-v2", -1)?,
            hi("dhcp-hostname", "workstation.example.com")?,
            hi("dhcp-send-release", -1)?,
            hi("dhcp-client-id", "ipv6-duid")?,
            hi("dhcp-iaid", "ifname")?,
        ]);

        let address_v6_data = vec![HashMap::from([
            hi("address", "::ffff:c0a8:10a")?,
            hi("prefix", 24_u32)?,
        ])];

        let route_v6_data = vec![HashMap::from([
            hi("dest", "2001:db8::")?,
            hi("prefix", 64_u32)?,
            hi("next-hop", "2001:db8::1")?,
            hi("metric", 100_u32)?,
        ])];

        let ipv6_section = HashMap::from([
            hi("method", "auto")?,
            hi("address-data", address_v6_data)?,
            hi("gateway", "::ffff:c0a8:101")?,
            hi("dns-data", vec!["::ffff:c0a8:102"])?,
            hi("dns-search", vec!["suse.com", "suse.de"])?,
            hi("route-data", route_v6_data)?,
            hi("dhcp-send-hostname", false)?,
            hi("dhcp-send-release", 1)?,
            hi("dhcp-duid", "llt")?,
            hi("dhcp-iaid", "12:34:56:78")?,
        ]);

        let match_section = HashMap::from([hi("kernel-command-line", vec!["pci-0000:00:19.0"])?]);

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

        assert_eq!(connection.mac_address, None);

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
        assert!(!connection.autoconnect);

        assert!(ip_config.dhcp4_settings.is_some());
        let dhcp4_settings = ip_config.dhcp4_settings.unwrap();
        assert_eq!(dhcp4_settings.send_hostname, None);
        assert_eq!(
            dhcp4_settings.hostname,
            Some("workstation.example.com".to_string())
        );
        assert_eq!(dhcp4_settings.send_release, None);
        assert_eq!(dhcp4_settings.client_id, DhcpClientId::Ipv6Duid);
        assert_eq!(dhcp4_settings.iaid, DhcpIaid::Ifname);

        assert!(ip_config.dhcp6_settings.is_some());
        let dhcp6_settings = ip_config.dhcp6_settings.unwrap();
        assert_eq!(dhcp6_settings.send_hostname, Some(false));
        assert_eq!(dhcp6_settings.hostname, None);
        assert_eq!(dhcp6_settings.send_release, Some(true));
        assert_eq!(dhcp6_settings.duid, DhcpDuid::Llt);
        assert_eq!(dhcp6_settings.iaid, DhcpIaid::Id("12:34:56:78".to_string()));

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
        let connection_section = HashMap::from([hi("id", "wlan0")?, hi("uuid", uuid)?]);
        let mac = MacAddr6::from_str("13:45:67:89:AB:CD")?;

        let wireless_section = HashMap::from([
            hi("mode", "infrastructure")?,
            hi("ssid", "agama".as_bytes())?,
            hi("mac-address", mac.as_bytes())?,
            hi("band", "a")?,
            hi("channel", 32_u32)?,
            hi("bssid", vec![18_u8, 52_u8, 86_u8, 120_u8, 154_u8, 188_u8])?,
            hi("hidden", false)?,
        ]);

        let security_section = HashMap::from([
            hi("key-mgmt", "wpa-psk")?,
            hi("wep-key-type", WEPKeyType::Key as u32)?,
            hi("auth-alg", "open")?,
            hi("wep-tx-keyidx", 1_u32)?,
            hi("group", vec!["wep40", "tkip"])?,
            hi("pairwise", vec!["tkip", "ccmp"])?,
            hi("proto", vec!["rsn"])?,
            hi("pmf", 2_i32)?,
        ]);

        let dbus_conn = HashMap::from([
            ("connection".to_string(), connection_section),
            (WIRELESS_KEY.to_string(), wireless_section),
            (WIRELESS_SECURITY_KEY.to_string(), security_section),
        ]);

        let connection = connection_from_dbus(dbus_conn).unwrap();
        assert_eq!(
            connection.mac_address,
            Some(MacAddr6::from_str("13:45:67:89:AB:CD").unwrap())
        );
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
        let connection_section = HashMap::from([hi("id", "bond0")?, hi("uuid", uuid)?]);

        let bond_options = Value::new(HashMap::from([(
            "options".to_string(),
            HashMap::from([hi("mode", "active-backup")?]),
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
    fn test_connection_from_dbus_bridge() -> anyhow::Result<()> {
        let uuid = Uuid::new_v4().to_string();
        let connection_section = HashMap::from([hi("id", "br0")?, hi("uuid", uuid)?]);

        let bridge_config = Value::new(HashMap::from([
            ("stp".to_string(), Value::from(true)),
            ("priority".to_string(), Value::from(10_u32)),
            ("forward-delay".to_string(), Value::from(5_u32)),
        ]));

        let dbus_conn = HashMap::from([
            ("connection".to_string(), connection_section),
            (BRIDGE_KEY.to_string(), bridge_config.try_into().unwrap()),
        ]);

        let connection = connection_from_dbus(dbus_conn);
        if let ConnectionConfig::Bridge(config) = connection.unwrap().config {
            assert_eq!(config.stp, Some(true));
            assert_eq!(config.forward_delay, Some(5_u32));
        }

        Ok(())
    }

    #[test]
    fn test_connection_from_dbus_infiniband() -> anyhow::Result<()> {
        let uuid = Uuid::new_v4().to_string();
        let connection_section = HashMap::from([hi("id", "ib0")?, hi("uuid", uuid)?]);

        let infiniband_section = HashMap::from([
            hi("p-key", 0x8001_i32)?,
            hi("parent", "ib0")?,
            hi("transport-mode", "datagram")?,
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
            hi("id", "eap0")?,
            (
                "uuid".to_string(),
                Value::new(Uuid::new_v4().to_string()).try_to_owned()?,
            ),
        ]);

        let ieee_8021x_section = HashMap::from([
            hi("eap", vec!["md5", "leap"])?,
            hi("phase2-auth", "gtc")?,
            hi("identity", "test_user")?,
            hi("password", "test_pw")?,
            hi("ca-cert", "file:///path/to/ca_cert.pem\0".as_bytes())?,
            hi("ca-cert-password", "ca_cert_pw")?,
            hi("client-cert", "not_valid_value".as_bytes())?,
            hi("client-cert-password", "client_cert_pw")?,
            hi(
                "private-key",
                "file://relative_path/private_key\0".as_bytes(),
            )?,
            hi("private-key-password", "private_key_pw")?,
            hi("anonymous-identity", "anon_identity")?,
            hi("phase1-peaplabel", "0")?,
            hi("phase1-peapver", "1")?,
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
        let infiniband_dbus = connection_to_dbus(&infiniband, None, semver::Version::new(1, 50, 0));

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
        };
        let mut wireless = build_base_connection();
        wireless.config = ConnectionConfig::Wireless(config);
        let wireless_dbus = connection_to_dbus(&wireless, None, semver::Version::new(1, 50, 0));

        let wireless = wireless_dbus.get(WIRELESS_KEY).unwrap();
        let mode: &str = wireless.get("mode").unwrap().downcast_ref().unwrap();
        assert_eq!(mode, "infrastructure");
        let custom_mac_address: &str = wireless
            .get("assigned-mac-address")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(custom_mac_address, "");
        let mac_address: &zvariant::Array =
            wireless.get("mac-address").unwrap().downcast_ref().unwrap();
        let mac_address: Vec<u8> = mac_address
            .iter()
            .map(|u| u.downcast_ref::<u8>().unwrap())
            .collect();
        let mac = MacAddr6::from_str("FD:CB:A9:87:65:43")?;
        assert_eq!(mac_address, mac.as_bytes());

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
        let conn_dbus = connection_to_dbus(&conn, None, semver::Version::new(1, 50, 0));

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
        let ethernet_dbus = connection_to_dbus(&ethernet, None, semver::Version::new(1, 50, 0));
        check_dbus_base_connection(&ethernet_dbus);
    }

    #[test]
    fn test_merge_dbus_connections() -> anyhow::Result<()> {
        let mut original = OwnedNestedHash::new();
        let mac = MacAddr6::from_str("13:45:67:89:AB:CD")?;
        let connection = HashMap::from([
            hi("id", "conn0")?,
            hi("type", ETHERNET_KEY)?,
            hi("mac-address", mac.as_bytes())?,
        ]);

        let ipv4 = HashMap::from([
            hi("method", "manual")?,
            hi("gateway", "192.168.1.1")?,
            hi("addresses", vec!["192.168.1.1"])?,
        ]);

        let ipv6 = HashMap::from([
            hi("method", "manual")?,
            hi("gateway", "::ffff:c0a8:101")?,
            hi("addresses", vec!["::ffff:c0a8:102"])?,
        ]);

        original.insert("connection".to_string(), connection);
        original.insert("ipv4".to_string(), ipv4);
        original.insert("ipv6".to_string(), ipv6);

        let ethernet = Connection {
            id: "agama".to_string(),
            interface: Some("eth0".to_string()),
            ..Default::default()
        };
        let updated = connection_to_dbus(&ethernet, None, semver::Version::new(1, 50, 0));

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

        // Ensure the mac-address is not used because it is not declared in the updated profile
        assert!(connection.get("mac-address").is_none());

        let ipv4 = merged.get("ipv4").unwrap();
        assert_eq!(*ipv4.get("method").unwrap(), Value::new("auto".to_string()));
        // there are not addresses ("address-data"), so no gateway is allowed
        assert!(ipv4.get("gateway").is_none());
        assert!(ipv4.get("addresses").is_none());

        let ipv6 = merged.get("ipv6").unwrap();
        assert_eq!(*ipv6.get("method").unwrap(), Value::new("auto".to_string()));
        // there are not addresses ("address-data"), so no gateway is allowed
        assert!(ipv6.get("gateway").is_none());

        Ok(())
    }

    #[test]
    fn test_merged_connections_are_clean() -> anyhow::Result<()> {
        let mut original = OwnedNestedHash::new();
        let connection = HashMap::from([
            hi("id", "conn0")?,
            hi("type", ETHERNET_KEY)?,
            hi("interface-name", "eth0")?,
        ]);
        let ethernet = HashMap::from([
            hi("assigned-mac-address", "12:34:56:78:9A:BC")?,
            hi("mtu", 9000)?,
        ]);
        original.insert("connection".to_string(), connection);
        original.insert(ETHERNET_KEY.to_string(), ethernet);

        let updated = Connection {
            interface: Some("".to_string()),
            mac_address: None,
            ..Default::default()
        };
        let updated = connection_to_dbus(&updated, None, semver::Version::new(1, 50, 0));

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
            hi("auto-negotiate", true).unwrap(),
            hi("assigned-mac-address", "12:34:56:78:9A:BC").unwrap(),
            hi("mtu", 9000_u32).unwrap(),
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
            dhcp4_settings: Some(Dhcp4Settings {
                send_hostname: Some(true),
                hostname: Some("workstation.suse.com".to_string()),
                send_release: Some(false),
                client_id: DhcpClientId::Duid,
                iaid: DhcpIaid::Stable,
            }),
            dhcp6_settings: Some(Dhcp6Settings {
                send_release: None,
                duid: DhcpDuid::StableLl,
                ..Default::default()
            }),
            ..Default::default()
        };
        let mac_address = Some(MacAddr6::from_str("FD:CB:A9:87:65:43").unwrap());
        Connection {
            id: "agama".to_string(),
            ip_config,
            mac_address,
            mtu: 1500_u32,
            autoconnect: false,
            ..Default::default()
        }
    }

    fn check_dbus_base_connection(conn_dbus: &NestedHash) {
        let connection_dbus = conn_dbus.get("connection").unwrap();
        let id: &str = connection_dbus.get("id").unwrap().downcast_ref().unwrap();
        assert_eq!(id, "agama");

        let autoconnect: bool = connection_dbus
            .get("autoconnect")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert!(!autoconnect);

        let ethernet_connection = conn_dbus.get(ETHERNET_KEY).unwrap();
        let mac_address: &str = ethernet_connection
            .get("assigned-mac-address")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(mac_address, "");

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
        let send_hostname: bool = ipv4_dbus
            .get("dhcp-send-hostname")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert!(send_hostname);
        let hostname: String = ipv4_dbus
            .get("dhcp-hostname")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(hostname, "workstation.suse.com".to_string());
        let send_release: i32 = ipv4_dbus
            .get("dhcp-send-release")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(send_release, 0);
        let client_id: String = ipv4_dbus
            .get("dhcp-client-id")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(client_id, "duid".to_string());
        let iaid: String = ipv4_dbus.get("dhcp-iaid").unwrap().downcast_ref().unwrap();
        assert_eq!(iaid, "stable".to_string());

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
        let send_hostname: bool = ipv6_dbus
            .get("dhcp-send-hostname")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert!(send_hostname);
        assert!(ipv6_dbus.get("dhcp-hostname").is_none());
        let send_release: i32 = ipv6_dbus
            .get("dhcp-send-release")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(send_release, -1);
        let client_id: String = ipv6_dbus.get("dhcp-duid").unwrap().downcast_ref().unwrap();
        assert_eq!(client_id, "stable-ll".to_string());
        assert!(ipv6_dbus.get("dhcp-iaid").is_none());
    }

    #[test]
    fn test_dbus_from_ethernet_connection_for_different_nm_versions() {
        let ethernet = build_base_connection();

        let ethernet_dbus =
            connection_to_dbus(&ethernet, None, semver::Version::parse("1.44.0").unwrap());
        let ipv4_dbus = ethernet_dbus.get("ipv4").unwrap();
        let ipv6_dbus = ethernet_dbus.get("ipv6").unwrap();
        let send_hostname: bool = ipv6_dbus
            .get("dhcp-send-hostname")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert!(send_hostname);
        assert_eq!(ipv4_dbus.get("dhcp-send-release"), None);

        let ethernet_dbus =
            connection_to_dbus(&ethernet, None, semver::Version::parse("1.52.0").unwrap());
        let ipv4_dbus = ethernet_dbus.get("ipv4").unwrap();
        let ipv6_dbus = ethernet_dbus.get("ipv6").unwrap();
        let send_hostname: i32 = ipv6_dbus
            .get("dhcp-send-hostname-v2")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(send_hostname, -1);
        let send_release: i32 = ipv4_dbus
            .get("dhcp-send-release")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(send_release, 0);
    }

    #[test]
    fn test_dbus_from_bridge_connection() {
        let mut master_con = build_base_connection();
        master_con.config = ConnectionConfig::Bridge(BridgeConfig::default());
        let bridge_con = build_base_connection();

        let bridge_dbus = connection_to_dbus(
            &bridge_con,
            Some(&master_con),
            semver::Version::parse("1.50.0").unwrap(),
        );
        let connection_dbus = bridge_dbus.get("connection").unwrap();
        let port_type: &str = connection_dbus
            .get("port-type")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(port_type, BRIDGE_KEY);
        let master: &str = connection_dbus
            .get("master")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(master, bridge_con.id);
    }

    #[test]
    fn test_dbus_from_bond_connection() {
        let mut master_con = build_base_connection();
        master_con.config = ConnectionConfig::Bond(BondConfig::default());
        let bond_con = build_base_connection();

        let bond_dbus = connection_to_dbus(
            &bond_con,
            Some(&master_con),
            semver::Version::parse("1.50.0").unwrap(),
        );
        let connection_dbus = bond_dbus.get("connection").unwrap();
        let port_type: &str = connection_dbus
            .get("port-type")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(port_type, BOND_KEY);
        let master: &str = connection_dbus
            .get("master")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(master, bond_con.id);
    }

    #[test]
    fn test_dbus_from_bridge_connection_for_different_nm_versions() {
        let mut master_con = build_base_connection();
        master_con.config = ConnectionConfig::Bridge(BridgeConfig::default());
        let bridge_con = build_base_connection();

        let bridge_dbus = connection_to_dbus(
            &bridge_con,
            Some(&master_con),
            semver::Version::parse("1.44.0").unwrap(),
        );
        let connection_dbus = bridge_dbus.get("connection").unwrap();
        let slave_type: &str = connection_dbus
            .get("slave-type")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(slave_type, BRIDGE_KEY);
        assert_eq!(connection_dbus.get("port-type"), None);

        let bridge_dbus = connection_to_dbus(
            &bridge_con,
            Some(&master_con),
            semver::Version::parse("1.46.0").unwrap(),
        );
        let connection_dbus = bridge_dbus.get("connection").unwrap();
        let port_type: &str = connection_dbus
            .get("port-type")
            .unwrap()
            .downcast_ref()
            .unwrap();
        assert_eq!(port_type, BRIDGE_KEY);
        assert_eq!(connection_dbus.get("slave-type"), None);
    }
}
