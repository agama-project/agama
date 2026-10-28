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

//! Basic operations of the network state: connections, devices, access points and updates.

use super::*;

#[test]
fn test_connection_match_settings_conversion() {
    let match_settings = MatchSettings {
        driver: vec!["e1000e".to_string()],
        interface: vec!["eth0".to_string()],
        path: vec!["pci-0000:00:1f.6".to_string()],
        kernel: vec!["eth*".to_string()],
    };
    let net_conn = NetworkConnection {
        id: "eth0".to_string(),
        match_settings: Some(match_settings),
        ..Default::default()
    };

    // NetworkConnection -> Connection
    let conn = Connection::try_from(net_conn.clone()).unwrap();
    assert_eq!(conn.match_config.driver, vec!["e1000e"]);
    assert_eq!(conn.match_config.interface, vec!["eth0"]);
    assert_eq!(conn.match_config.path, vec!["pci-0000:00:1f.6"]);
    assert_eq!(conn.match_config.kernel, vec!["eth*"]);

    // Connection -> NetworkConnection
    let net_conn2 = NetworkConnection::try_from(conn).unwrap();
    assert_eq!(net_conn.match_settings, net_conn2.match_settings);
}

#[test]
fn test_add_connection() {
    let mut state = NetworkState::default();
    let uuid = Uuid::new_v4();
    let conn0 = Connection {
        id: "eth0".to_string(),
        uuid,
        ..Default::default()
    };
    state.add_connection(conn0).unwrap();
    let found = state.get_connection("eth0").unwrap();
    assert_eq!(found.uuid, uuid);
}

#[test]
fn test_add_duplicated_connection() {
    let mut state = NetworkState::default();
    let mut conn0 = Connection::new("eth0".to_string(), DeviceType::Ethernet);
    conn0.uuid = Uuid::new_v4();
    state.add_connection(conn0.clone()).unwrap();
    let error = state.add_connection(conn0).unwrap_err();
    assert!(matches!(error, NetworkStateError::ConnectionExists(_)));
}

#[test]
fn test_update_connection() {
    let mut state = NetworkState::default();
    let uuid = Uuid::new_v4();
    let conn0 = Connection {
        id: "eth0".to_string(),
        uuid,
        ..Default::default()
    };
    state.add_connection(conn0).unwrap();

    let conn1 = Connection {
        id: "eth0".to_string(),
        uuid,
        firewall_zone: Some("public".to_string()),
        ..Default::default()
    };
    state.update_connection(conn1).unwrap();
    let found = state.get_connection_by_uuid(uuid).unwrap();
    assert_eq!(found.firewall_zone, Some("public".to_string()));
}

#[test]
fn test_update_state_optimized() {
    let mut state = NetworkState::default();
    let uuid = Uuid::new_v4();
    let mut conn0 = Connection::new("eth0".to_string(), DeviceType::Ethernet);
    conn0.uuid = uuid;
    conn0.ip_config.method4 = Some(Ipv4Method::Manual);
    state.add_connection(conn0).unwrap();

    // Initial config
    let net_conn = NetworkConnection {
        id: "eth0".to_string(),
        method4: Some(Ipv4Method::Manual),
        ..Default::default()
    };
    let config = Config {
        connections: Some(NetworkConnectionsCollection(vec![net_conn.clone()])),
        ..Default::default()
    };
    state.update_state(config).unwrap();
    assert_eq!(
        state
            .user_config
            .as_ref()
            .unwrap()
            .connections
            .as_ref()
            .unwrap()
            .0[0]
            .method4,
        Some(Ipv4Method::Manual)
    );

    // Update with SAME config, it should skip processing (pre-filtered)
    let config2 = Config {
        connections: Some(NetworkConnectionsCollection(vec![net_conn.clone()])),
        state: Some(StateSettings {
            copy_network: Some(true),
            ..Default::default()
        }),
    };
    // This should NOT fail even if we modify the runtime state manually and it differs
    state.get_connection_mut("eth0").unwrap().ip_config.method4 = Some(Ipv4Method::Auto);
    state.update_state(config2).unwrap();
    // Since it was skipped, method4 remains Auto in runtime
    assert_eq!(
        state.get_connection("eth0").unwrap().ip_config.method4,
        Some(Ipv4Method::Auto)
    );
    // But general state should be updated
    assert_eq!(state.general_state.copy_network, true);

    // Update with DIFFERENT config
    let net_conn_diff = NetworkConnection {
        id: "eth0".to_string(),
        method4: Some(Ipv4Method::Auto),
        ..Default::default()
    };
    let config3 = Config {
        connections: Some(NetworkConnectionsCollection(vec![net_conn_diff])),
        ..Default::default()
    };
    state.update_state(config3).unwrap();
    // Now it should be updated
    assert_eq!(
        state.get_connection("eth0").unwrap().ip_config.method4,
        Some(Ipv4Method::Auto)
    );
}

#[test]
fn test_changed_connections() {
    let mut state = NetworkState::default();
    let conn1 = NetworkConnection {
        id: "eth1".to_string(),
        method4: Some(Ipv4Method::Auto),
        ..Default::default()
    };
    let conn2 = NetworkConnection {
        id: "eth2".to_string(),
        method4: Some(Ipv4Method::Manual),
        ..Default::default()
    };

    // Initially all are changed (new)
    let collection = NetworkConnectionsCollection(vec![conn1.clone(), conn2.clone()]);
    let changed = state.changed_connections(&collection);
    assert_eq!(changed.len(), 2);

    // Set initial user config
    state.user_config = Some(Config {
        connections: Some(collection),
        ..Default::default()
    });

    // No changes
    let collection = NetworkConnectionsCollection(vec![conn1.clone(), conn2.clone()]);
    let changed = state.changed_connections(&collection);
    assert_eq!(changed.len(), 0);

    // One changed, one new
    let conn1_mod = NetworkConnection {
        id: "eth1".to_string(),
        method4: Some(Ipv4Method::Manual),
        ..Default::default()
    };
    let conn3 = NetworkConnection {
        id: "eth3".to_string(),
        ..Default::default()
    };
    let collection =
        NetworkConnectionsCollection(vec![conn1_mod.clone(), conn2.clone(), conn3.clone()]);
    let changed = state.changed_connections(&collection);
    assert_eq!(changed.len(), 2);
    assert!(changed.iter().any(|c| c.id == "eth1"));
    assert!(changed.iter().any(|c| c.id == "eth3"));
}

#[test]
fn test_update_state_only_general_state() {
    let mut state = NetworkState::default();
    state.general_state.copy_network = false;

    let config = Config {
        connections: None,
        state: Some(StateSettings {
            copy_network: Some(true),
            ..Default::default()
        }),
    };

    state.update_state(config).unwrap();
    assert_eq!(state.general_state.copy_network, true);
    assert!(state.user_config.is_some());
}

#[test]
fn test_update_unknown_connection() {
    let mut state = NetworkState::default();
    let conn0 = Connection::new("eth0".to_string(), DeviceType::Ethernet);
    let error = state.update_connection(conn0).unwrap_err();
    assert!(matches!(error, NetworkStateError::UnknownConnection(_)));
}

#[test]
fn test_remove_connection() {
    let mut state = NetworkState::default();
    let uuid = Uuid::new_v4();
    let conn0 = Connection {
        id: "eth0".to_string(),
        uuid,
        ..Default::default()
    };
    state.add_connection(conn0).unwrap();
    state.remove_connection(uuid).unwrap();
    let found = state.get_connection_by_uuid(uuid);
    assert!(found.is_none());
}

#[test]
fn test_remove_unknown_connection() {
    let mut state = NetworkState::default();
    let uuid = Uuid::new_v4();
    let error = state.remove_connection(uuid).unwrap_err();
    assert!(matches!(error, NetworkStateError::UnknownConnection(_)));
}

#[test]
fn test_remove_device() {
    let mut state = NetworkState::default();
    let device = Device {
        name: "eth0".to_string(),
        ..Default::default()
    };
    state.add_device(device).unwrap();
    state.remove_device("eth0").unwrap();
    assert!(state.get_device("eth0").is_none());
}

#[test]
fn test_add_access_point() {
    let mut state = NetworkState::default();
    let ap = AccessPoint {
        hw_address: "AA:BB:CC:DD:EE:FF".to_string(),
        ssid: SSID(b"test".to_vec()),
        ..Default::default()
    };
    state.add_access_point(ap.clone()).unwrap();
    assert_eq!(state.access_points.len(), 1);
    assert_eq!(state.access_points[0].hw_address, "AA:BB:CC:DD:EE:FF");

    // Adding same AP should replace it (in our implementation we remove and push)
    let mut ap2 = ap.clone();
    ap2.strength = 80;
    state.add_access_point(ap2).unwrap();
    assert_eq!(state.access_points.len(), 1);
    assert_eq!(state.access_points[0].strength, 80);
}

#[test]
fn test_remove_access_point() {
    let mut state = NetworkState::default();
    let ap = AccessPoint {
        hw_address: "AA:BB:CC:DD:EE:FF".to_string(),
        ..Default::default()
    };
    state.add_access_point(ap).unwrap();
    state.remove_access_point("AA:BB:CC:DD:EE:FF").unwrap();
    assert_eq!(state.access_points.len(), 0);
}

#[test]
fn test_remove_unknown_access_point() {
    let mut state = NetworkState::default();
    let error = state.remove_access_point("unknown").unwrap_err();
    assert!(matches!(error, NetworkStateError::UnknownAccessPoint(_)));
}

#[test]
fn test_is_loopback() {
    let conn = Connection::new("eth0".to_string(), DeviceType::Ethernet);
    assert!(!conn.is_loopback());

    let conn = Connection::new("eth0".to_string(), DeviceType::Loopback);
    assert!(conn.is_loopback());
}

#[test]
fn test_set_bonding_ports() {
    let mut state = NetworkState::default();
    let eth0 = Connection {
        id: "eth0".to_string(),
        interface: Some("eth0".to_string()),
        ..Default::default()
    };
    let eth1 = Connection {
        id: "eth1".to_string(),
        interface: Some("eth1".to_string()),
        ..Default::default()
    };
    let bond0 = Connection {
        id: "bond0".to_string(),
        interface: Some("bond0".to_string()),
        config: ConnectionConfig::Bond(Default::default()),
        ..Default::default()
    };

    state.add_connection(eth0).unwrap();
    state.add_connection(eth1).unwrap();
    state.add_connection(bond0.clone()).unwrap();

    state.set_ports(&bond0, vec!["eth1".to_string()]).unwrap();

    let eth1_found = state.get_connection("eth1").unwrap();
    assert_eq!(eth1_found.controller, Some(bond0.uuid));
    let eth0_found = state.get_connection("eth0").unwrap();
    assert_eq!(eth0_found.controller, None);
}

#[test]
fn test_set_bonding_missing_port() {
    let mut state = NetworkState::default();
    let bond0 = Connection {
        id: "bond0".to_string(),
        interface: Some("bond0".to_string()),
        config: ConnectionConfig::Bond(Default::default()),
        ..Default::default()
    };
    state.add_connection(bond0.clone()).unwrap();

    let error = state
        .set_ports(&bond0, vec!["eth0".to_string()])
        .unwrap_err();
    assert!(matches!(error, NetworkStateError::UnknownConnection(_)));
}

#[test]
fn test_set_non_controller_ports() {
    let mut state = NetworkState::default();
    let eth0 = Connection {
        id: "eth0".to_string(),
        ..Default::default()
    };
    state.add_connection(eth0.clone()).unwrap();

    let error = state
        .set_ports(&eth0, vec!["eth1".to_string()])
        .unwrap_err();
    assert!(matches!(
        error,
        NetworkStateError::NotControllerConnection(_),
    ));
}

#[test]
fn test_copy_files() {
    use std::fs;

    let tmp_dir = std::env::temp_dir().join(format!("test_agama_network_{}", Uuid::new_v4()));
    let source = tmp_dir.join("source");
    let dest = tmp_dir.join("dest");

    fs::create_dir_all(&source).unwrap();
    fs::write(source.join("conn1.nmconnection"), "content1").unwrap();
    fs::write(source.join("conn2.nmconnection"), "content2").unwrap();
    fs::write(source.join("device.link"), "link content").unwrap();
    fs::create_dir(source.join("ignored_dir")).unwrap();

    let state = NetworkState::default();
    state.copy_files(&source, &dest).unwrap();

    assert!(dest.join("conn1.nmconnection").exists());
    assert_eq!(
        fs::read_to_string(dest.join("conn1.nmconnection")).unwrap(),
        "content1"
    );
    assert!(dest.join("conn2.nmconnection").exists());
    assert_eq!(
        fs::read_to_string(dest.join("conn2.nmconnection")).unwrap(),
        "content2"
    );
    assert!(dest.join("device.link").exists());
    assert!(!dest.join("ignored_dir").exists());

    let dest_link = tmp_dir.join("dest_link");
    state.copy_files(&source, &dest_link).unwrap();
    assert!(dest_link.join("device.link").exists());
    assert!(dest_link.join("conn1.nmconnection").exists());

    fs::remove_dir_all(tmp_dir).unwrap();
}
