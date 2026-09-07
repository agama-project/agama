// Copyright (c) [2025] SUSE LLC
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

//! This module implements a set of utilities for tests.

use agama_utils::{
    actor::Handler,
    api::{
        event,
        network::{BondMode, DeviceType, Ipv4Method, Ipv6Method, MacAddress},
    },
    progress,
};
use async_trait::async_trait;
use macaddr::MacAddr6;
use std::str::FromStr;

use crate::{
    adapter::Watcher,
    model::{
        BondConfig, BondOptions, BridgeConfig, BridgePortConfig, Connection, ConnectionConfig,
        PortConfig, StateConfig, VlanConfig,
    },
    Adapter, NetworkAdapterError, NetworkState, NetworkSystemClient, Starter,
};

/// Network adapter for tests.
///
/// At this point, the adapter returns the default network state and does not write
/// any change. Additionally, it does not have an associated watcher.
pub struct TestAdapter;

#[async_trait]
impl Adapter for TestAdapter {
    async fn read(&self, _config: StateConfig) -> Result<NetworkState, NetworkAdapterError> {
        Ok(NetworkState::default())
    }

    async fn write(&self, _network: &NetworkState) -> Result<(), NetworkAdapterError> {
        Ok(())
    }

    fn watcher(&self) -> Option<Box<dyn Watcher + Send>> {
        None
    }
}

/// Builds the stacked connection setup from `autoyast-examples/04-full.xml`.
///
/// ```text
/// eth0 + eth1  ->  bond0  ->  br0  ->  br0.100 (VLAN)
/// ```
///
/// Each connection carries a few settings that are easy to spot in assertions, so the
/// fixture doubles as a check that nothing gets lost while converting back and forth
/// between the internal model and the HTTP API types.
///
/// The connections are returned in dependency order (ports before their controllers).
pub fn stacked_connections() -> Vec<Connection> {
    let mut eth0 = Connection::new("eth0".to_string(), DeviceType::Ethernet);
    eth0.interface = Some("eth0".to_string());
    eth0.mtu = 9000;
    eth0.custom_mac_address =
        MacAddress::MacAddress(MacAddr6::from_str("12:34:56:78:9a:bc").unwrap());
    eth0.firewall_zone = Some("public".to_string());
    eth0.ip_config.method4 = Some(Ipv4Method::Disabled);
    eth0.ip_config.method6 = Some(Ipv6Method::Disabled);

    let mut eth1 = Connection::new("eth1".to_string(), DeviceType::Ethernet);
    eth1.interface = Some("eth1".to_string());
    eth1.ip_config.method4 = Some(Ipv4Method::Disabled);
    eth1.ip_config.method6 = Some(Ipv6Method::Disabled);

    let mut bond0 = Connection::new("bond0".to_string(), DeviceType::Bond);
    bond0.interface = Some("bond0".to_string());
    bond0.config = ConnectionConfig::Bond(BondConfig {
        mode: BondMode::LACP,
        options: BondOptions::try_from("miimon=100 lacp_rate=fast").unwrap(),
    });
    bond0.ip_config.method4 = Some(Ipv4Method::Disabled);
    bond0.ip_config.method6 = Some(Ipv6Method::Disabled);

    let mut br0 = Connection::new("br0".to_string(), DeviceType::Bridge);
    br0.interface = Some("br0".to_string());
    br0.config = ConnectionConfig::Bridge(BridgeConfig {
        stp: Some(true),
        forward_delay: Some(4),
        max_age: Some(20),
        ..Default::default()
    });
    br0.ip_config.method4 = Some(Ipv4Method::Manual);
    br0.ip_config.addresses = vec!["192.168.1.100/24".parse().unwrap()];

    let mut vlan = Connection::new("br0.100".to_string(), DeviceType::Vlan);
    vlan.interface = Some("br0.100".to_string());
    vlan.config = ConnectionConfig::Vlan(VlanConfig {
        parent: "br0".to_string(),
        id: 100,
        ..Default::default()
    });
    vlan.ip_config.method4 = Some(Ipv4Method::Manual);
    vlan.ip_config.addresses = vec!["10.100.0.10/24".parse().unwrap()];

    eth0.controller = Some(bond0.uuid);
    eth1.controller = Some(bond0.uuid);
    bond0.controller = Some(br0.uuid);
    // Settings that bond0 has as a port of br0, as opposed to as a bond.
    bond0.port_config = PortConfig::Bridge(BridgePortConfig {
        priority: Some(32),
        path_cost: Some(100),
    });

    vec![eth0, eth1, bond0, br0, vlan]
}

/// Starts a testing network service.
pub async fn start_service(
    events: event::Sender,
    progress: Handler<progress::Service>,
) -> NetworkSystemClient {
    let adapter = TestAdapter;

    Starter::new(events, progress)
        .with_adapter(adapter)
        .start()
        .await
        .expect("Could not spawn a testing network service")
}
