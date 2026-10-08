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

//! Resolution of the ports given over the HTTP API: dropping and moving ports, how they are found,
//! the settings they can have and the configurations that are rejected.

use super::*;

#[test]
fn test_updating_a_connection_keeps_its_uuid_and_unmodelled_settings() {
    let state = stacked_state();
    let uuid = state.get_connection("eth0").unwrap().uuid;

    let mut update = find(&exposed(&state), "eth0");
    update.mtu = 1500;
    let collection = state
        .connection_collection_from(&NetworkConnectionsCollection(vec![update]))
        .unwrap();

    let eth0 = collection.0.iter().find(|c| c.id == "eth0").unwrap();
    assert_eq!(eth0.uuid, uuid);
    assert_eq!(eth0.mtu, 1500);
    // The firewall zone is not part of the HTTP API, so it must not be lost on the way.
    assert_eq!(eth0.firewall_zone.as_deref(), Some("public"));
}

#[test]
fn test_omitting_the_port_settings_leaves_them_alone() {
    let state = stacked_state();
    let mut bond0 = find(&exposed(&state), "bond0");
    bond0.port = None;
    // bond0 stays nested in br0, otherwise it would be moved out of it.
    let mut update = find(&exposed(&state), "br0");
    update.bridge.as_mut().unwrap().port_connections = Some(vec![nested(bond0)]);

    let collection = state
        .connection_collection_from(&NetworkConnectionsCollection(vec![update]))
        .unwrap();

    let bond0 = collection.0.iter().find(|c| c.id == "bond0").unwrap();
    assert_eq!(
        bond0.port_config,
        PortConfig::Bridge(BridgePortConfig {
            priority: Some(32),
            path_cost: Some(100),
        })
    );
}

#[test]
fn test_bridge_port_settings_on_a_bond_port_are_rejected() {
    let state = NetworkState::default();
    let bond0 = NetworkConnection {
        id: "bond0".to_string(),
        bond: Some(BondSettings {
            port_connections: Some(vec![nested(NetworkConnection {
                interface: Some("eth0".to_string()),
                port: Some(PortSettings {
                    priority: Some(50),
                    ..Default::default()
                }),
                ..Default::default()
            })]),
            ..Default::default()
        }),
        ..Default::default()
    };

    let error = state
        .connection_collection_from(&NetworkConnectionsCollection(vec![bond0]))
        .unwrap_err();
    assert!(matches!(
        error,
        NetworkStateError::InvalidPortSettings(port, controller)
            if port == "eth0" && controller == "bond0"
    ));
}

/// Only a port nested in its controller can have port settings, so a connection at the top level
/// cannot have them, whether it is a port or not.
#[test]
fn test_port_settings_at_the_top_level_are_rejected() {
    let state = NetworkState::default();
    let eth0 = NetworkConnection {
        id: "eth0".to_string(),
        interface: Some("eth0".to_string()),
        port: Some(PortSettings {
            priority: Some(16),
            path_cost: Some(50),
        }),
        ..Default::default()
    };
    let br0 = NetworkConnection {
        id: "br0".to_string(),
        bridge: Some(BridgeSettings {
            ports: Some(vec!["eth0".to_string()]),
            ..Default::default()
        }),
        ..Default::default()
    };

    // Not a port at all.
    let collection = NetworkConnectionsCollection(vec![eth0.clone()]);
    let error = state.connection_collection_from(&collection).unwrap_err();
    assert!(matches!(error, NetworkStateError::TopLevelPortSettings(id) if id == "eth0"));

    // A port that a bridge lists by name, the format that predates the port settings.
    let collection = NetworkConnectionsCollection(vec![eth0, br0]);
    let error = state.connection_collection_from(&collection).unwrap_err();
    assert!(matches!(error, NetworkStateError::TopLevelPortSettings(id) if id == "eth0"));
}

/// A reported port sent back on its own is at the top level, so it cannot keep its port settings.
/// Without them, it is moved out of its controller.
#[test]
fn test_a_port_moved_out_cannot_keep_its_port_settings() {
    let mut state = stacked_state();
    let mut bond0 = find(&exposed(&state), "bond0");
    assert!(
        bond0.port.is_some(),
        "the fixture must report the port settings of bond0"
    );

    let error = state
        .connection_collection_from(&NetworkConnectionsCollection(vec![bond0.clone()]))
        .unwrap_err();
    assert!(matches!(error, NetworkStateError::TopLevelPortSettings(id) if id == "bond0"));

    bond0.port = None;
    apply(&mut state, NetworkConnectionsCollection(vec![bond0]));
    let bond0 = state.get_connection("bond0").unwrap();
    assert_eq!(bond0.controller, None);
    assert_eq!(bond0.port_config, PortConfig::None);
}

/// Drops the given port from the ports of bond0 in the reported configuration.
fn drop_port(connections: &mut NetworkConnectionsCollection, id: &str) {
    find_mut(&mut connections.0, "bond0")
        .unwrap()
        .port_connections_mut()
        .unwrap()
        .retain(|p| !matches!(p, PortEntry::Connection(c) if c.id == id));
}

/// Applies the given connections to the state.
fn apply(state: &mut NetworkState, connections: NetworkConnectionsCollection) {
    state
        .update_state(Config {
            connections: Some(connections),
            ..Default::default()
        })
        .unwrap();
}

#[test]
fn test_dropping_a_port_removes_it() {
    let mut state = stacked_state();
    let mut connections = exposed(&state);
    drop_port(&mut connections, "eth1");
    apply(&mut state, connections);

    assert!(state.get_connection("eth1").unwrap().is_removed());
    assert_eq!(
        state.get_connection("eth0").unwrap().controller,
        Some(state.get_connection("bond0").unwrap().uuid)
    );
}

/// Replaces the ports of the given controller with a `ports` list, as the clients that
/// predate `portConnections` do.
fn set_port_names(connections: &mut NetworkConnectionsCollection, id: &str, names: &[&str]) {
    let conn = find_mut(&mut connections.0, id).unwrap();
    conn.set_port_connections(None);
    conn.bond.as_mut().unwrap().ports = Some(names.iter().map(|n| n.to_string()).collect());
}

#[test]
fn test_dropping_a_port_from_the_list_of_names_removes_it() {
    let mut state = stacked_state();
    let mut connections = exposed(&state);
    set_port_names(&mut connections, "bond0", &["eth0"]);
    apply(&mut state, connections);

    assert!(state.get_connection("eth1").unwrap().is_removed());
    assert_eq!(
        state.get_connection("eth0").unwrap().controller,
        Some(state.get_connection("bond0").unwrap().uuid)
    );
}

#[test]
fn test_a_port_dropped_from_the_list_of_names_can_be_moved_out() {
    let mut state = stacked_state();
    let uuid = state.get_connection("eth1").unwrap().uuid;

    let mut connections = exposed(&state);
    let eth1 = find(&connections, "eth1");
    set_port_names(&mut connections, "bond0", &["eth0"]);
    connections.0.push(eth1);
    apply(&mut state, connections);

    let eth1 = state.get_connection("eth1").unwrap();
    assert!(!eth1.is_removed());
    assert_eq!(eth1.controller, None);
    assert_eq!(eth1.uuid, uuid);
    assert_eq!(eth1.ip_config.method4, Some(Ipv4Method::Auto));
}

#[test]
fn test_a_port_given_by_name_can_be_moved_to_another_controller() {
    let mut state = stacked_state();
    let mut bond1 = Connection::new("bond1".to_string(), DeviceType::Bond);
    bond1.interface = Some("bond1".to_string());
    state.add_connection(bond1).unwrap();
    let uuid = state.get_connection("eth1").unwrap().uuid;

    let mut connections = exposed(&state);
    set_port_names(&mut connections, "bond0", &["eth0"]);
    set_port_names(&mut connections, "bond1", &["eth1"]);
    apply(&mut state, connections);

    let eth1 = state.get_connection("eth1").unwrap();
    assert!(!eth1.is_removed());
    assert_eq!(eth1.uuid, uuid);
    assert_eq!(
        eth1.controller,
        Some(state.get_connection("bond1").unwrap().uuid)
    );
}

/// The reported configuration carries both lists of ports, so it can be sent back as it is.
#[test]
fn test_the_reported_configuration_can_be_sent_back_with_both_lists() {
    let mut state = stacked_state();
    let reported: NetworkConnectionsCollection = ConnectionCollection(state.connections.clone())
        .try_into()
        .unwrap();
    assert!(find(&reported, "bond0").bond.unwrap().ports.is_some());

    apply(&mut state, reported);

    let br0 = state.get_connection("br0").unwrap().uuid;
    let bond0 = state.get_connection("bond0").unwrap().uuid;
    assert_eq!(state.get_connection("bond0").unwrap().controller, Some(br0));
    for id in ["eth0", "eth1"] {
        assert_eq!(
            state.get_connection(id).unwrap().controller,
            Some(bond0),
            "{id}"
        );
    }
}

/// When both lists are given and do not match, `portConnections` decides and `ports` is ignored.
#[test]
fn test_port_connections_take_precedence_over_ports() {
    let mut state = stacked_state();
    let mut connections = exposed(&state);
    let bond0 = find_mut(&mut connections.0, "bond0").unwrap();
    bond0.bond.as_mut().unwrap().ports = Some(vec!["eth0".to_string(), "eth1".to_string()]);
    bond0.set_port_connections(Some(vec![name("eth0")]));
    apply(&mut state, connections);

    assert!(state.get_connection("eth1").unwrap().is_removed());
    assert!(!state.get_connection("eth0").unwrap().is_removed());
}

#[test]
fn test_dropping_a_controller_removes_the_stack_below_it() {
    let mut state = stacked_state();
    let mut connections = exposed(&state);
    find_mut(&mut connections.0, "br0")
        .unwrap()
        .port_connections_mut()
        .unwrap()
        .clear();
    apply(&mut state, connections);

    for id in ["bond0", "eth0", "eth1"] {
        assert!(state.get_connection(id).unwrap().is_removed(), "{id}");
    }
    assert!(!state.get_connection("br0").unwrap().is_removed());
}

#[test]
fn test_omitting_the_ports_of_a_controller_keeps_them() {
    let mut state = stacked_state();
    let mut br0 = find(&exposed(&state), "br0");
    br0.set_port_connections(None);
    br0.bridge.as_mut().unwrap().stp = Some(false);
    apply(&mut state, NetworkConnectionsCollection(vec![br0]));

    for id in ["bond0", "eth0", "eth1"] {
        assert!(!state.get_connection(id).unwrap().is_removed(), "{id}");
    }
    assert_eq!(
        state.get_connection("bond0").unwrap().controller,
        Some(state.get_connection("br0").unwrap().uuid)
    );
}

#[test]
fn test_a_dropped_port_given_at_the_top_level_is_moved_out() {
    let mut state = stacked_state();
    let uuid = state.get_connection("eth0").unwrap().uuid;

    let mut connections = exposed(&state);
    let eth0 = find(&connections, "eth0");
    drop_port(&mut connections, "eth0");
    connections.0.push(eth0);
    apply(&mut state, connections);

    let eth0 = state.get_connection("eth0").unwrap();
    assert!(!eth0.is_removed());
    assert_eq!(eth0.controller, None);
    assert_eq!(eth0.uuid, uuid);
    assert_eq!(eth0.mtu, 9000);
    // The firewall zone is not part of the HTTP API, so it must not be lost on the way.
    assert_eq!(eth0.firewall_zone.as_deref(), Some("public"));
    // A port has no IP settings, which is not what a stand-alone NIC wants.
    assert_eq!(eth0.ip_config.method4, Some(Ipv4Method::Auto));
    assert_eq!(eth0.ip_config.method6, Some(Ipv6Method::Auto));
}

#[test]
fn test_a_port_moved_out_keeps_the_ip_settings_it_is_given() {
    let mut state = stacked_state();
    let mut eth0 = find(&exposed(&state), "eth0");
    eth0.method4 = Some(Ipv4Method::Manual);
    eth0.addresses = vec!["192.168.2.10/24".parse().unwrap()];
    // Sent on its own: the position in the document decides, even if bond0 is not there.
    apply(&mut state, NetworkConnectionsCollection(vec![eth0]));

    let eth0 = state.get_connection("eth0").unwrap();
    assert_eq!(eth0.controller, None);
    assert_eq!(eth0.ip_config.method4, Some(Ipv4Method::Manual));
    assert_eq!(eth0.ip_config.method6, Some(Ipv6Method::Auto));
}

#[test]
fn test_a_port_can_be_moved_to_another_controller() {
    let mut state = stacked_state();
    let mut bond1 = Connection::new("bond1".to_string(), DeviceType::Bond);
    bond1.interface = Some("bond1".to_string());
    state.add_connection(bond1).unwrap();
    let uuid = state.get_connection("eth1").unwrap().uuid;

    let mut connections = exposed(&state);
    let eth1 = find(&connections, "eth1");
    drop_port(&mut connections, "eth1");
    find_mut(&mut connections.0, "bond1")
        .unwrap()
        .set_port_connections(Some(vec![nested(eth1)]));
    apply(&mut state, connections);

    let eth1 = state.get_connection("eth1").unwrap();
    assert!(!eth1.is_removed());
    assert_eq!(eth1.uuid, uuid);
    assert_eq!(
        eth1.controller,
        Some(state.get_connection("bond1").unwrap().uuid)
    );
}

#[test]
fn test_ports_have_no_ip_settings() {
    let state = NetworkState::default();
    let bond0 = NetworkConnection {
        id: "bond0".to_string(),
        bond: Some(BondSettings {
            port_connections: Some(vec![
                name("eth0"),
                nested(NetworkConnection {
                    interface: Some("eth1".to_string()),
                    ..Default::default()
                }),
            ]),
            ..Default::default()
        }),
        ..Default::default()
    };
    let collection = state
        .connection_collection_from(&NetworkConnectionsCollection(vec![bond0]))
        .unwrap();

    for id in ["eth0", "eth1"] {
        let conn = collection.0.iter().find(|c| c.id == id).unwrap();
        assert_eq!(conn.ip_config, IpConfig::default(), "{id}");
    }
}

#[test]
fn test_a_port_cannot_have_ip_settings() {
    let state = NetworkState::default();
    let bond0 = NetworkConnection {
        id: "bond0".to_string(),
        bond: Some(BondSettings {
            port_connections: Some(vec![nested(NetworkConnection {
                interface: Some("eth0".to_string()),
                method4: Some(Ipv4Method::Disabled),
                ..Default::default()
            })]),
            ..Default::default()
        }),
        ..Default::default()
    };

    let error = state
        .connection_collection_from(&NetworkConnectionsCollection(vec![bond0]))
        .unwrap_err();
    assert!(matches!(error, NetworkStateError::PortIpSettings(..)));
}

/// Before the ports were nested, the profiles gave them at the top level and listed them by
/// name, usually disabling their IP methods. Those IP settings are ignored.
#[test]
fn test_the_ip_settings_of_a_port_given_at_the_top_level_are_ignored() {
    let state = NetworkState::default();
    let eth0 = NetworkConnection {
        id: "eth0".to_string(),
        interface: Some("eth0".to_string()),
        method4: Some(Ipv4Method::Disabled),
        method6: Some(Ipv6Method::Disabled),
        ..Default::default()
    };
    let bond0 = NetworkConnection {
        id: "bond0".to_string(),
        bond: Some(BondSettings {
            ports: Some(vec!["eth0".to_string()]),
            ..Default::default()
        }),
        ..Default::default()
    };

    let collection = state
        .connection_collection_from(&NetworkConnectionsCollection(vec![eth0, bond0]))
        .unwrap();

    let bond0 = collection.0.iter().find(|c| c.id == "bond0").unwrap();
    let eth0 = collection.0.iter().find(|c| c.id == "eth0").unwrap();
    assert_eq!(eth0.controller, Some(bond0.uuid));
    assert_eq!(eth0.ip_config, IpConfig::default());
}

/// An existing connection that joins a controller by name becomes a port as well.
#[test]
fn test_a_connection_joining_a_controller_by_name_loses_its_ip_settings() {
    let mut state = NetworkState::default();
    let mut eth0 = Connection::new("eth0".to_string(), DeviceType::Ethernet);
    eth0.interface = Some("eth0".to_string());
    eth0.ip_config.method4 = Some(Ipv4Method::Manual);
    eth0.ip_config.addresses = vec!["192.168.2.10/24".parse().unwrap()];
    eth0.ip_config.ignore_auto_dns = true;
    state.add_connection(eth0).unwrap();

    let bond0 = NetworkConnection {
        id: "bond0".to_string(),
        bond: Some(BondSettings {
            port_connections: Some(vec![name("eth0")]),
            ..Default::default()
        }),
        ..Default::default()
    };
    let collection = state
        .connection_collection_from(&NetworkConnectionsCollection(vec![bond0]))
        .unwrap();

    let eth0 = collection.0.iter().find(|c| c.id == "eth0").unwrap();
    assert_eq!(eth0.ip_config, IpConfig::default());
}

#[test]
fn test_updating_a_single_connection_keeps_the_rest_of_the_stack() {
    let mut state = stacked_state();
    let mut vlan = find(&exposed(&state), "br0.100");
    vlan.mtu = 1400;

    state
        .update_state(Config {
            connections: Some(NetworkConnectionsCollection(vec![vlan])),
            ..Default::default()
        })
        .unwrap();

    let bond0_uuid = state.get_connection("bond0").unwrap().uuid;
    let br0_uuid = state.get_connection("br0").unwrap().uuid;
    assert_eq!(
        state.get_connection("eth0").unwrap().controller,
        Some(bond0_uuid)
    );
    assert_eq!(
        state.get_connection("eth1").unwrap().controller,
        Some(bond0_uuid)
    );
    assert_eq!(
        state.get_connection("bond0").unwrap().controller,
        Some(br0_uuid)
    );
    assert_eq!(state.get_connection("br0.100").unwrap().mtu, 1400);
}

#[test]
fn test_a_port_given_by_name_is_taken_from_the_state() {
    let state = stacked_state();
    let mut bond0 = find(&exposed(&state), "bond0");
    // A connection at the top level cannot have port settings.
    bond0.port = None;
    bond0.bond.as_mut().unwrap().port_connections = Some(vec![name("eth0"), name("eth1")]);

    let collection = state
        .connection_collection_from(&NetworkConnectionsCollection(vec![bond0]))
        .unwrap();

    let eth0 = collection
        .0
        .iter()
        .find(|c| c.id == "eth0")
        .expect("eth0 was not pulled in");
    // It is the connection that already exists, not a new one built out of thin air.
    assert_eq!(eth0.uuid, state.get_connection("eth0").unwrap().uuid);
    assert_eq!(eth0.mtu, 9000);
}

#[test]
fn test_an_unknown_port_is_created_as_an_ethernet_connection() {
    let state = NetworkState::default();
    let bond0 = NetworkConnection {
        id: "bond0".to_string(),
        bond: Some(BondSettings {
            port_connections: Some(vec![name("eth0")]),
            ..Default::default()
        }),
        ..Default::default()
    };
    let collection = state
        .connection_collection_from(&NetworkConnectionsCollection(vec![bond0]))
        .unwrap();

    let eth0 = collection.0.iter().find(|c| c.id == "eth0").unwrap();
    assert_eq!(eth0.config, ConnectionConfig::Ethernet);
    assert_eq!(eth0.interface.as_deref(), Some("eth0"));
    assert_eq!(
        eth0.controller,
        Some(collection.0.iter().find(|c| c.id == "bond0").unwrap().uuid)
    );
}

#[test]
fn test_a_nested_port_without_an_id_is_named_after_its_interface() {
    let state = NetworkState::default();
    let bond0 = NetworkConnection {
        id: "bond0".to_string(),
        bond: Some(BondSettings {
            port_connections: Some(vec![nested(NetworkConnection {
                interface: Some("eth0".to_string()),
                mtu: 9000,
                ..Default::default()
            })]),
            ..Default::default()
        }),
        ..Default::default()
    };
    let collection = state
        .connection_collection_from(&NetworkConnectionsCollection(vec![bond0]))
        .unwrap();

    let bond0 = collection.0.iter().find(|c| c.id == "bond0").unwrap();
    let eth0 = collection.0.iter().find(|c| c.id == "eth0").unwrap();
    assert_eq!(eth0.mtu, 9000);
    assert_eq!(eth0.controller, Some(bond0.uuid));
}

/// Like a port given by name, a nested port without an ID refers to the connection that is
/// already bound to its interface.
#[test]
fn test_a_nested_port_without_an_id_updates_the_existing_connection() {
    let mut state = NetworkState::default();
    let mut existing = Connection::new("Wired connection 1".to_string(), DeviceType::Ethernet);
    existing.interface = Some("eth0".to_string());
    let uuid = existing.uuid;
    state.add_connection(existing).unwrap();

    let bond0 = NetworkConnection {
        id: "bond0".to_string(),
        bond: Some(BondSettings {
            port_connections: Some(vec![nested(NetworkConnection {
                interface: Some("eth0".to_string()),
                ..Default::default()
            })]),
            ..Default::default()
        }),
        ..Default::default()
    };
    let collection = state
        .connection_collection_from(&NetworkConnectionsCollection(vec![bond0]))
        .unwrap();

    assert_eq!(collection.0.len(), 2);
    let eth0 = collection.0.iter().find(|c| c.uuid == uuid).unwrap();
    assert_eq!(eth0.id, "Wired connection 1");
    assert!(eth0.controller.is_some());
}

#[test]
fn test_a_nested_port_without_an_id_nor_an_interface_is_rejected() {
    let state = NetworkState::default();
    let bond0 = NetworkConnection {
        id: "bond0".to_string(),
        bond: Some(BondSettings {
            port_connections: Some(vec![nested(NetworkConnection {
                mtu: 9000,
                ..Default::default()
            })]),
            ..Default::default()
        }),
        ..Default::default()
    };

    let error = state
        .connection_collection_from(&NetworkConnectionsCollection(vec![bond0]))
        .unwrap_err();
    assert!(matches!(error, NetworkStateError::MissingPortId(id) if id == "bond0"));
}

#[test]
fn test_a_connection_at_the_top_level_requires_an_id() {
    let state = NetworkState::default();
    let eth0 = NetworkConnection {
        interface: Some("eth0".to_string()),
        ..Default::default()
    };

    let error = state
        .connection_collection_from(&NetworkConnectionsCollection(vec![eth0]))
        .unwrap_err();
    assert!(matches!(error, NetworkStateError::MissingConnectionId));
}

#[test]
fn test_a_port_given_by_id_keeps_its_interface() {
    let mut state = stacked_state();
    let mut bond0 = find(&exposed(&state), "bond0");
    // A connection at the top level cannot have port settings.
    bond0.port = None;
    bond0.set_port_connections(Some(vec![
        nested(NetworkConnection {
            id: "eth0".to_string(),
            mtu: 9000,
            ..Default::default()
        }),
        name("eth1"),
    ]));
    apply(&mut state, NetworkConnectionsCollection(vec![bond0]));

    let eth0 = state.get_connection("eth0").unwrap();
    assert_eq!(eth0.mtu, 9000);
    assert_eq!(eth0.interface.as_deref(), Some("eth0"));
}

#[test]
fn test_a_connection_given_twice_is_rejected() {
    let state = NetworkState::default();
    let eth0 = NetworkConnection {
        id: "eth0".to_string(),
        interface: Some("eth0".to_string()),
        ..Default::default()
    };
    let collection = NetworkConnectionsCollection(vec![
        eth0.clone(),
        NetworkConnection {
            id: "bond0".to_string(),
            bond: Some(BondSettings {
                port_connections: Some(vec![nested(eth0)]),
                ..Default::default()
            }),
            ..Default::default()
        },
    ]);

    let error = state.connection_collection_from(&collection).unwrap_err();
    assert!(matches!(error, NetworkStateError::DuplicatedConnection(id) if id == "eth0"));
}

#[test]
fn test_an_ambiguous_port_name_is_rejected() {
    let state = NetworkState::default();
    let collection = NetworkConnectionsCollection(vec![
        NetworkConnection {
            id: "office".to_string(),
            interface: Some("eth0".to_string()),
            ..Default::default()
        },
        NetworkConnection {
            id: "home".to_string(),
            interface: Some("eth0".to_string()),
            ..Default::default()
        },
        NetworkConnection {
            id: "bond0".to_string(),
            bond: Some(BondSettings {
                port_connections: Some(vec![name("eth0")]),
                ..Default::default()
            }),
            ..Default::default()
        },
    ]);

    let error = state.connection_collection_from(&collection).unwrap_err();
    assert!(matches!(error, NetworkStateError::AmbiguousPort(name) if name == "eth0"));
}

#[test]
fn test_a_port_claimed_by_two_controllers_is_rejected() {
    let state = NetworkState::default();
    let collection = NetworkConnectionsCollection(vec![
        NetworkConnection {
            id: "eth0".to_string(),
            interface: Some("eth0".to_string()),
            ..Default::default()
        },
        NetworkConnection {
            id: "bond0".to_string(),
            bond: Some(BondSettings {
                port_connections: Some(vec![name("eth0")]),
                ..Default::default()
            }),
            ..Default::default()
        },
        NetworkConnection {
            id: "br0".to_string(),
            bridge: Some(BridgeSettings {
                port_connections: Some(vec![name("eth0")]),
                ..Default::default()
            }),
            ..Default::default()
        },
    ]);

    let error = state.connection_collection_from(&collection).unwrap_err();
    assert!(matches!(error, NetworkStateError::PortAlreadyClaimed(..)));
}

#[test]
fn test_naming_a_port_nested_in_another_controller_is_rejected() {
    let state = NetworkState::default();
    let collection = NetworkConnectionsCollection(vec![
        NetworkConnection {
            id: "bond0".to_string(),
            bond: Some(BondSettings {
                port_connections: Some(vec![nested(NetworkConnection {
                    id: "eth0".to_string(),
                    interface: Some("eth0".to_string()),
                    ..Default::default()
                })]),
                ..Default::default()
            }),
            ..Default::default()
        },
        NetworkConnection {
            id: "br0".to_string(),
            bridge: Some(BridgeSettings {
                port_connections: Some(vec![name("eth0")]),
                ..Default::default()
            }),
            ..Default::default()
        },
    ]);

    let error = state.connection_collection_from(&collection).unwrap_err();
    assert!(matches!(
        error,
        NetworkStateError::PortAlreadyClaimed(port, first, second)
            if port == "eth0" && first == "bond0" && second == "br0"
    ));
}

#[test]
fn test_a_controller_cannot_be_a_port_of_itself() {
    let state = NetworkState::default();
    let collection = NetworkConnectionsCollection(vec![NetworkConnection {
        id: "bond0".to_string(),
        interface: Some("bond0".to_string()),
        bond: Some(BondSettings {
            port_connections: Some(vec![name("bond0")]),
            ..Default::default()
        }),
        ..Default::default()
    }]);

    let error = state.connection_collection_from(&collection).unwrap_err();
    assert!(matches!(error, NetworkStateError::ControllerCycle(id) if id == "bond0"));
}

/// Nesting cannot express a loop, but a name can still point back to an ancestor.
#[test]
fn test_a_loop_of_controllers_is_rejected() {
    let state = NetworkState::default();
    let collection = NetworkConnectionsCollection(vec![NetworkConnection {
        id: "br0".to_string(),
        interface: Some("br0".to_string()),
        bridge: Some(BridgeSettings {
            port_connections: Some(vec![nested(NetworkConnection {
                id: "bond0".to_string(),
                interface: Some("bond0".to_string()),
                bond: Some(BondSettings {
                    port_connections: Some(vec![name("br0")]),
                    ..Default::default()
                }),
                ..Default::default()
            })]),
            ..Default::default()
        }),
        ..Default::default()
    }]);

    let error = state.connection_collection_from(&collection).unwrap_err();
    assert!(matches!(error, NetworkStateError::ControllerCycle(_)));
}
