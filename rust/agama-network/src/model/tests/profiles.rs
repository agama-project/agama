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

//! Whole profiles applied to the network state and reported back, like the stacked setup of
//! autoyast-examples/04-full.xml.

use super::*;

/// The network section of `autoyast-examples/04-full.xml` once imported, with the ports
/// given by name.
///
/// ```text
/// eth0 + eth1  ->  bond0  ->  br0  ->  br0.100 (VLAN)
/// ```
const STACKED_PROFILE: &str = r#"[
  { "id": "eth0", "interface": "eth0", "mtu": 9000 },
  { "id": "eth1", "interface": "eth1" },
  { "id": "bond0", "interface": "bond0",
    "bond": { "mode": "802.3ad", "options": "miimon=100 lacp_rate=fast",
              "ports": ["eth0", "eth1"] } },
  { "id": "br0", "interface": "br0", "method4": "manual",
    "addresses": ["192.168.1.100/24"],
    "bridge": { "stp": true, "forwardDelay": 4, "maxAge": 20, "ports": ["bond0"] } },
  { "id": "br0.100", "interface": "br0.100", "method4": "manual",
    "addresses": ["10.100.0.10/24"],
    "vlan": { "id": 100, "parent": "br0" } }
]"#;

/// Same as [`STACKED_PROFILE`], with the ports nested in their controllers.
const NESTED_PROFILE: &str = r#"[
  { "id": "br0", "interface": "br0", "method4": "manual",
    "addresses": ["192.168.1.100/24"],
    "bridge": { "stp": true, "forwardDelay": 4, "maxAge": 20, "portConnections": [
      { "id": "bond0", "interface": "bond0",
        "bond": { "mode": "802.3ad", "options": "miimon=100 lacp_rate=fast", "portConnections": [
          { "interface": "eth0", "mtu": 9000 },
          { "interface": "eth1" }
        ] } }
    ] } },
  { "id": "br0.100", "interface": "br0.100", "method4": "manual",
    "addresses": ["10.100.0.10/24"],
    "vlan": { "id": 100, "parent": "br0" } }
]"#;

/// Applies the given profile to an empty state.
fn apply_profile(profile: &str) -> NetworkState {
    let connections: Vec<NetworkConnection> = serde_json::from_str(profile).unwrap();
    let mut state = NetworkState::default();
    state
        .update_state(Config {
            connections: Some(NetworkConnectionsCollection(connections)),
            ..Default::default()
        })
        .unwrap();
    state
}

#[test]
fn test_a_stacked_profile_is_applied_and_reported_back_nested() {
    let reported = exposed(&apply_profile(STACKED_PROFILE));

    assert_eq!(root_ids(&reported), ["br0", "br0.100"]);

    let bridge = find(&reported, "br0").bridge.unwrap();
    assert_eq!(bridge.max_age, Some(20));

    // The bond is a port of the bridge and a controller of the two NICs at once.
    let bond0 = find(&reported, "bond0");
    assert_eq!(port_ids(&find(&reported, "br0")), ["bond0"]);
    assert_eq!(port_ids(&bond0), ["eth0", "eth1"]);
    assert_eq!(bond0.bond.as_ref().unwrap().mode, "802.3ad");
    assert_eq!(find(&reported, "eth0").mtu, 9000);

    assert_eq!(find(&reported, "br0.100").vlan.unwrap().parent, "br0");
}

#[test]
fn test_a_nested_profile_gives_the_same_result_as_ports_given_by_name() {
    // The order of the bond options is not stable, so compare them parsed.
    let normalized = |state: NetworkState| {
        let mut reported = exposed(&state);
        let bond = find_mut(&mut reported.0, "bond0")
            .unwrap()
            .bond
            .as_mut()
            .unwrap();
        let options = BondOptions::try_from(bond.options.take().unwrap().as_str()).unwrap();
        (reported, options)
    };

    assert_eq!(
        normalized(apply_profile(STACKED_PROFILE)),
        normalized(apply_profile(NESTED_PROFILE))
    );
}

/// Reading the configuration and writing it back as it is must not change anything.
#[test]
fn test_the_reported_configuration_can_be_written_back() {
    let mut state = apply_profile(NESTED_PROFILE);
    let before = state.connections.clone();

    let reported = exposed(&state);
    state.user_config = None;
    state
        .update_state(Config {
            connections: Some(reported),
            ..Default::default()
        })
        .unwrap();

    assert_eq!(state.connections, before);
}

#[test]
fn test_editing_a_stacked_profile_keeps_the_settings_of_the_ports() {
    let mut state = apply_profile(STACKED_PROFILE);

    // What the web UI does: read the whole config, change one connection and write it back.
    let mut reported = exposed(&state);
    let br0 = find_mut(&mut reported.0, "br0").unwrap();
    br0.addresses = vec!["192.168.1.200/24".parse().unwrap()];

    state
        .update_state(Config {
            connections: Some(reported),
            ..Default::default()
        })
        .unwrap();

    let eth0 = state.get_connection("eth0").unwrap();
    assert_eq!(eth0.mtu, 9000, "the MTU of a port must survive an edit");
    assert_eq!(
        eth0.controller,
        Some(state.get_connection("bond0").unwrap().uuid)
    );
    assert_eq!(
        state.get_connection("br0").unwrap().ip_config.addresses,
        vec!["192.168.1.200/24".parse().unwrap()]
    );
}
