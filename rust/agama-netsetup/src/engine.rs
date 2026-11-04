// Copyright (c) [2026] SUSE LLC
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

//! Access to the network configuration.
//!
//! The user interfaces talk to a [`Backend`], a small synchronous API that hides
//! NetworkManager. [`NmBackend`] implements it on top of `agama-network`'s
//! `NetworkManagerAdapter`, so the connections are built the same way Agama builds them.

use crate::{
    bootparams::boot_params,
    checks::{Check, Outcome},
    settings::{Method, StaticConfig},
};
use agama_network::{
    adapter::Adapter,
    model::{Connection, StateConfig},
    types::{Device, DeviceState, DeviceType, IpConfig},
    NetworkManagerAdapter, NetworkState,
};
use anyhow::{anyhow, bail, Context};
use cidr::IpInet;
use std::net::IpAddr;
use tokio::runtime::Runtime;

/// Summary of a network device for the user interfaces.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct DeviceInfo {
    pub name: String,
    pub kind: String,
    pub state: String,
    pub connected: bool,
    pub carrier: Option<bool>,
    pub mac: String,
    pub addresses: Vec<IpInet>,
    pub gateway4: Option<IpAddr>,
    pub gateway6: Option<IpAddr>,
    pub nameservers: Vec<IpAddr>,
    pub search: Vec<String>,
}

impl DeviceInfo {
    fn from_device(device: &Device) -> Self {
        let ip = device.ip_config.clone().unwrap_or_default();
        Self {
            name: device.name.clone(),
            kind: device_kind(device.type_).to_string(),
            state: device.state.to_string(),
            connected: device.state == DeviceState::Connected,
            carrier: device.carrier,
            mac: device.mac_address.to_string(),
            // link-local IPv6 addresses are always there and only add noise
            addresses: ip
                .addresses
                .into_iter()
                .filter(|a| !is_ipv6_link_local(a))
                .collect(),
            gateway4: ip.gateway4,
            gateway6: ip.gateway6,
            nameservers: ip.nameservers,
            search: ip.dns_searchlist,
        }
    }

    /// Current settings as a static configuration, used as default values in the forms.
    pub fn as_static(&self) -> StaticConfig {
        StaticConfig {
            addresses: self.addresses.clone(),
            gateway4: self.gateway4,
            gateway6: self.gateway6,
            nameservers: self.nameservers.clone(),
            search: self.search.clone(),
        }
    }
}

fn is_ipv6_link_local(addr: &IpInet) -> bool {
    matches!(addr.address(), IpAddr::V6(v6) if v6.segments()[0] & 0xffc0 == 0xfe80)
}

fn device_kind(kind: DeviceType) -> &'static str {
    match kind {
        DeviceType::Loopback => "loopback",
        DeviceType::Ethernet => "ethernet",
        DeviceType::Wireless => "wireless",
        DeviceType::Dummy => "dummy",
        DeviceType::Bond => "bond",
        DeviceType::Vlan => "vlan",
        DeviceType::Bridge => "bridge",
    }
}

/// Network operations needed by the user interfaces.
pub trait Backend {
    /// Returns the network devices, without the loopback one.
    fn devices(&mut self) -> anyhow::Result<Vec<DeviceInfo>>;
    /// Configures and activates the device, returns its new state.
    fn configure(&mut self, interface: &str, method: &Method) -> anyhow::Result<DeviceInfo>;
    /// Returns the boot parameters equivalent to the active configuration.
    fn boot_params(&mut self, proxy: Option<&str>) -> anyhow::Result<Vec<String>>;
    /// Runs a connectivity check.
    fn run_check(&mut self, check: &Check) -> Outcome;
}

/// [`Backend`] using NetworkManager.
pub struct NmBackend {
    runtime: Runtime,
    adapter: NetworkManagerAdapter<'static>,
    persistent: bool,
}

impl NmBackend {
    /// Connects to NetworkManager.
    ///
    /// * `persistent`: whether to save the connections to disk. In the initrd they must stay in
    ///   memory: NetworkManager keeps them in /run, which survives the switch to the live root.
    pub fn new(persistent: bool) -> anyhow::Result<Self> {
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()?;
        let adapter = runtime
            .block_on(NetworkManagerAdapter::from_system())
            .map_err(|e| anyhow!("Cannot connect to NetworkManager: {e}"))?;
        Ok(Self {
            runtime,
            adapter,
            persistent,
        })
    }

    fn read(&self) -> anyhow::Result<NetworkState> {
        let config = StateConfig {
            access_points: false,
            ..Default::default()
        };
        Ok(self.runtime.block_on(self.adapter.read(config))?)
    }
}

impl Backend for NmBackend {
    fn devices(&mut self) -> anyhow::Result<Vec<DeviceInfo>> {
        let state = self.read()?;
        Ok(state
            .devices
            .iter()
            .filter(|d| d.type_ != DeviceType::Loopback)
            .map(DeviceInfo::from_device)
            .collect())
    }

    fn configure(&mut self, interface: &str, method: &Method) -> anyhow::Result<DeviceInfo> {
        let mut state = self.read()?;
        let conn = connection_for(&state, interface, method, self.persistent)?;
        if state.get_connection_by_uuid(conn.uuid).is_some() {
            state.update_connection(conn)?;
        } else {
            state.add_connection(conn)?;
        }

        self.runtime
            .block_on(self.adapter.write(&state))
            .context("Could not apply the configuration")?;

        let state = self.read()?;
        let device = state
            .get_device(interface)
            .ok_or_else(|| anyhow!("Device {interface} disappeared"))?;
        Ok(DeviceInfo::from_device(device))
    }

    fn boot_params(&mut self, proxy: Option<&str>) -> anyhow::Result<Vec<String>> {
        let state = self.read()?;
        let configs: Vec<(&str, &IpConfig)> = state
            .devices
            .iter()
            .filter(|d| d.type_ != DeviceType::Loopback && d.state == DeviceState::Connected)
            .filter_map(|d| {
                let conn = state.get_connection(d.connection.as_deref()?)?;
                Some((d.name.as_str(), &conn.ip_config))
            })
            .collect();
        Ok(boot_params(&configs, proxy))
    }

    fn run_check(&mut self, check: &Check) -> Outcome {
        self.runtime.block_on(check.run())
    }
}

/// Returns the connection to write for configuring the interface.
///
/// It reuses the connection bound to the interface. Connections that are not bound to an
/// interface (e.g. the one generated for `ip=dhcp`, which applies to all the devices) are not
/// modified, a new connection bound to the interface is created instead.
fn connection_for(
    state: &NetworkState,
    interface: &str,
    method: &Method,
    persistent: bool,
) -> anyhow::Result<Connection> {
    let Some(device) = state.get_device(interface) else {
        bail!("Unknown device {interface}");
    };

    let active = device
        .connection
        .as_deref()
        .and_then(|id| state.get_connection(id))
        .filter(|c| c.interface.as_deref() == Some(interface));

    let mut conn = match active.or_else(|| state.get_connection_by_interface(interface)) {
        Some(conn) => conn.clone(),
        None => {
            if device.type_ != DeviceType::Ethernet {
                bail!(
                    "Cannot create a new configuration for {interface} ({})",
                    device_kind(device.type_)
                );
            }
            let id = if state.get_connection(interface).is_none() {
                interface.to_string()
            } else {
                format!("{interface}-netsetup")
            };
            let mut conn = Connection::new(id, DeviceType::Ethernet);
            conn.interface = Some(interface.to_string());
            conn
        }
    };

    method.apply_to(&mut conn.ip_config);
    conn.set_up();
    conn.autoconnect = true;
    conn.persistent = persistent;
    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::parse_address;

    fn state() -> NetworkState {
        let mut default = Connection::new("default_connection".to_string(), DeviceType::Ethernet);
        default.interface = None;
        let mut eth1 = Connection::new("eth1".to_string(), DeviceType::Ethernet);
        eth1.interface = Some("eth1".to_string());

        let device = |name: &str, conn: Option<&str>| Device {
            name: name.to_string(),
            connection: conn.map(str::to_string),
            ..Default::default()
        };
        let bond = Device {
            type_: DeviceType::Bond,
            ..device("bond0", None)
        };

        NetworkState {
            devices: vec![
                device("eth0", Some("default_connection")),
                device("eth1", Some("eth1")),
                bond,
            ],
            connections: vec![default, eth1],
            ..Default::default()
        }
    }

    fn static_method() -> Method {
        Method::Static(StaticConfig {
            addresses: vec![parse_address("10.0.0.5/24").unwrap()],
            ..Default::default()
        })
    }

    #[test]
    fn test_unbound_connection_is_not_modified() {
        let state = state();
        let conn = connection_for(&state, "eth0", &static_method(), false).unwrap();
        assert_eq!(conn.id, "eth0");
        assert_eq!(conn.interface.as_deref(), Some("eth0"));
        assert!(state.get_connection_by_uuid(conn.uuid).is_none());
        assert!(!conn.persistent);
        assert!(conn.is_up());
    }

    #[test]
    fn test_bound_connection_is_reused() {
        let state = state();
        let conn = connection_for(&state, "eth1", &static_method(), true).unwrap();
        assert_eq!(state.get_connection("eth1").unwrap().uuid, conn.uuid);
        assert_eq!(conn.ip_config.addresses.len(), 1);
        assert!(conn.persistent);
    }

    #[test]
    fn test_new_connection_id_does_not_clash() {
        let mut state = state();
        state.connections[0].id = "eth0".to_string();
        state.devices[0].connection = Some("eth0".to_string());
        let conn = connection_for(&state, "eth0", &Method::Dhcp, false).unwrap();
        assert_eq!(conn.id, "eth0-netsetup");
    }

    #[test]
    fn test_no_new_connection_for_other_types() {
        assert!(connection_for(&state(), "bond0", &Method::Dhcp, false).is_err());
        assert!(connection_for(&state(), "eth9", &Method::Dhcp, false).is_err());
    }

    #[test]
    fn test_link_local_addresses_are_hidden() {
        let device = Device {
            name: "eth0".to_string(),
            ip_config: Some(IpConfig {
                addresses: vec![
                    parse_address("fe80::1/64").unwrap(),
                    parse_address("10.0.0.5/24").unwrap(),
                ],
                ..Default::default()
            }),
            ..Default::default()
        };
        let info = DeviceInfo::from_device(&device);
        assert_eq!(info.addresses, vec![parse_address("10.0.0.5/24").unwrap()]);
    }
}
