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

//! How the state is reported over the HTTP API: ports nested in their controllers, both lists of
//! ports, the connection state and round trips.

use super::*;

#[test]
fn test_stacked_connections_are_all_exposed() {
    let collection = ConnectionCollection(crate::test_utils::stacked_connections());
    let exposed: NetworkConnectionsCollection = collection.try_into().unwrap();

    let mut ids: Vec<&str> = exposed.flatten().iter().map(|c| c.id.as_str()).collect();
    ids.sort_unstable();
    assert_eq!(ids, ["bond0", "br0", "br0.100", "eth0", "eth1"]);
}

#[test]
fn test_stacked_connections_are_nested_in_their_controller() {
    let collection = ConnectionCollection(crate::test_utils::stacked_connections());
    let exposed: NetworkConnectionsCollection = collection.try_into().unwrap();

    // The VLAN refers to its parent by name, so it is not nested.
    assert_eq!(root_ids(&exposed), ["br0", "br0.100"]);
    // bond0 is a port of br0 *and* a controller of eth0/eth1 at the same time.
    assert_eq!(port_ids(&find(&exposed, "br0")), ["bond0"]);
    assert_eq!(port_ids(&find(&exposed, "bond0")), ["eth0", "eth1"]);
}

#[test]
fn test_nested_ports_keep_their_connection_id() {
    let mut connections = crate::test_utils::stacked_connections();
    // A connection read from NetworkManager usually has an ID that is not the
    // interface name.
    connections[0].id = "Wired connection 1".to_string();

    let collection = ConnectionCollection(connections);
    let exposed: NetworkConnectionsCollection = collection.try_into().unwrap();

    assert_eq!(
        port_ids(&find(&exposed, "bond0")),
        ["Wired connection 1", "eth1"]
    );
}

#[test]
fn test_removed_connections_are_not_nested() {
    let mut connections = crate::test_utils::stacked_connections();
    connections[1].remove();

    let collection = ConnectionCollection(connections);
    let exposed: NetworkConnectionsCollection = collection.try_into().unwrap();

    assert_eq!(port_ids(&find(&exposed, "bond0")), ["eth0"]);
    assert!(exposed.0.iter().any(|c| c.id == "eth1"));
}

/// Only bonds and bridges expose their ports, so the members of any other kind of controller
/// must still be reported somewhere.
#[test]
fn test_members_of_other_controllers_stay_at_the_top_level() {
    let ovs = Connection {
        config: ConnectionConfig::OvsBridge(Default::default()),
        ..Connection::new("ovs0".to_string(), DeviceType::Ethernet)
    };
    let mut eth0 = Connection::new("eth0".to_string(), DeviceType::Ethernet);
    eth0.controller = Some(ovs.uuid);

    let exposed: NetworkConnectionsCollection =
        ConnectionCollection(vec![ovs, eth0]).try_into().unwrap();

    assert_eq!(root_ids(&exposed), ["eth0", "ovs0"]);
}

#[test]
fn test_the_system_info_reports_the_state_of_nested_ports() {
    let mut state = stacked_state();
    for conn in state.connections.iter_mut() {
        conn.state = ConnectionState::Activated;
    }

    let info = SystemInfo::try_from(state).unwrap();

    assert_eq!(root_ids(&info.connections), ["br0", "br0.100"]);
    assert_eq!(
        find(&info.connections, "eth0").state,
        Some(ConnectionState::Activated)
    );
}

#[test]
fn test_the_config_does_not_report_the_state() {
    let exposed = exposed(&stacked_state());
    assert!(exposed.flatten().iter().all(|c| c.state.is_none()));
}

#[test]
fn test_stacked_connections_survive_a_round_trip() {
    let original = crate::test_utils::stacked_connections();
    let exposed: NetworkConnectionsCollection =
        ConnectionCollection(original.clone()).try_into().unwrap();
    let restored: ConnectionCollection = exposed.try_into().unwrap();

    assert_eq!(
        restored.0.len(),
        5,
        "expected exactly one entry per connection, got {:?}",
        restored.0.iter().map(|c| &c.id).collect::<Vec<_>>()
    );

    let by_id = |id: &str| {
        restored
            .0
            .iter()
            .find(|c| c.id == id)
            .unwrap_or_else(|| panic!("{id} is missing"))
            .clone()
    };

    // The controller edges are rebuilt.
    let bond0 = by_id("bond0");
    let br0 = by_id("br0");
    assert_eq!(by_id("eth0").controller, Some(bond0.uuid));
    assert_eq!(by_id("eth1").controller, Some(bond0.uuid));
    assert_eq!(bond0.controller, Some(br0.uuid));
    assert_eq!(br0.controller, None);

    // The device specific settings survive.
    assert_eq!(
        bond0.config,
        ConnectionConfig::Bond(BondConfig {
            mode: BondMode::LACP,
            options: BondOptions::try_from("miimon=100 lacp_rate=fast").unwrap(),
        })
    );
    assert_eq!(
        br0.config,
        ConnectionConfig::Bridge(BridgeConfig {
            stp: Some(true),
            forward_delay: Some(4),
            max_age: Some(20),
            ..Default::default()
        })
    );
}

#[test]
fn test_port_settings_survive_a_round_trip() {
    let original = crate::test_utils::stacked_connections();
    let exposed: NetworkConnectionsCollection =
        ConnectionCollection(original.clone()).try_into().unwrap();
    let restored: ConnectionCollection = exposed.try_into().unwrap();

    let eth0 = restored.0.iter().find(|c| c.id == "eth0").unwrap();
    let original_eth0 = original.iter().find(|c| c.id == "eth0").unwrap();

    assert_eq!(eth0.mtu, original_eth0.mtu);
    assert_eq!(eth0.custom_mac_address, original_eth0.custom_mac_address);
    assert_eq!(eth0.interface, original_eth0.interface);
    assert_eq!(eth0.ip_config.method4, original_eth0.ip_config.method4);
}

#[test]
fn test_bridge_port_settings_are_exposed_and_survive_a_round_trip() {
    let state = stacked_state();
    let exposed = exposed(&state);

    let bond0 = find(&exposed, "bond0");
    assert_eq!(
        bond0.port,
        Some(PortSettings {
            priority: Some(32),
            path_cost: Some(100),
        })
    );
    // A connection that is not a bridge port has nothing to report.
    assert_eq!(find(&exposed, "eth0").port, None);

    let restored: ConnectionCollection = exposed.try_into().unwrap();
    let bond0 = restored.0.iter().find(|c| c.id == "bond0").unwrap();
    assert_eq!(
        bond0.port_config,
        PortConfig::Bridge(BridgePortConfig {
            priority: Some(32),
            path_cost: Some(100),
        })
    );
}

#[test]
fn test_the_reported_controllers_list_their_ports_by_name_too() {
    let state = stacked_state();
    let reported: NetworkConnectionsCollection = ConnectionCollection(state.connections.clone())
        .try_into()
        .unwrap();

    let br0 = find(&reported, "br0");
    let bridge = br0.bridge.as_ref().unwrap();
    assert_eq!(bridge.ports, Some(vec!["bond0".to_string()]));
    assert_eq!(bridge.port_connections.as_ref().unwrap().len(), 1);

    let bond0 = find(&reported, "bond0");
    assert_eq!(
        bond0.bond.as_ref().unwrap().ports,
        Some(vec!["eth0".to_string(), "eth1".to_string()])
    );
}

#[test]
fn test_ports_are_reported_without_ip_settings() {
    let mut state = stacked_state();
    state.get_connection_mut("eth0").unwrap().ip_config.method4 = Some(Ipv4Method::Auto);

    let eth0 = find(&exposed(&state), "eth0");
    assert!(!eth0.has_ip_settings());
    assert_eq!(eth0.ignore_auto_dns, None);
}
