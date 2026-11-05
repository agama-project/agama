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

//! Removal of connections: controllers take their ports, and everything below them, along.

use super::*;

#[test]
fn test_removing_a_controller_removes_its_ports() {
    let mut state = stacked_state();
    remove(&mut state, "bond0");

    for id in ["bond0", "eth0", "eth1"] {
        assert!(
            state.get_connection(id).unwrap().is_removed(),
            "{id} was left behind by the removal of its controller"
        );
    }
}

#[test]
fn test_removing_a_controller_removes_the_whole_stack_below_it() {
    let mut state = stacked_state();
    // br0 is two levels above the NICs: br0 -> bond0 -> eth0 + eth1.
    remove(&mut state, "br0");

    for id in ["br0", "bond0", "eth0", "eth1"] {
        assert!(
            state.get_connection(id).unwrap().is_removed(),
            "{id} survived the removal of the stack it belongs to"
        );
    }
}

/// A VLAN refers to its parent by name, so it is not a port and the removal does not reach it.
/// See `PortResolver::warn_on_dangling_vlans`.
#[test]
fn test_removing_a_controller_does_not_remove_the_vlans_on_top_of_it() {
    let mut state = stacked_state();
    remove(&mut state, "br0");

    assert!(!state.get_connection("br0.100").unwrap().is_removed());
}

#[test]
fn test_removing_a_port_leaves_its_controller_alone() {
    let mut state = stacked_state();
    remove(&mut state, "eth0");

    assert!(state.get_connection("eth0").unwrap().is_removed());
    for id in ["eth1", "bond0", "br0"] {
        assert!(
            !state.get_connection(id).unwrap().is_removed(),
            "removing a port took {id} with it"
        );
    }
}

#[test]
fn test_removing_a_controller_reports_it_without_its_ports() {
    let mut state = stacked_state();
    remove(&mut state, "br0");

    // Everything is on its way out, so nothing is nested anymore.
    let reported = exposed(&state);
    assert!(find(&reported, "br0").bridge.unwrap().ports.is_none());
    assert_eq!(
        root_ids(&reported),
        ["bond0", "br0", "br0.100", "eth0", "eth1"]
    );
}

/// What the web UI sends when the delete button is pressed: the whole connection, ports
/// included, with the status flipped.
#[test]
fn test_removing_a_controller_along_with_its_ports() {
    let mut state = stacked_state();
    let mut bond0 = find(&exposed(&state), "bond0");
    bond0.status = Some(Status::Removed);

    state
        .update_state(Config {
            connections: Some(NetworkConnectionsCollection(vec![bond0])),
            ..Default::default()
        })
        .unwrap();

    for id in ["bond0", "eth0", "eth1"] {
        assert!(state.get_connection(id).unwrap().is_removed(), "{id}");
    }
}

/// The cascade walks the controller links, so a state that somehow ended up with a loop must
/// not keep it spinning.
#[test]
fn test_a_loop_of_controllers_does_not_hang_the_removal() {
    let mut first = Connection::new("first".to_string(), DeviceType::Bridge);
    let mut second = Connection::new("second".to_string(), DeviceType::Bridge);
    first.controller = Some(second.uuid);
    second.controller = Some(first.uuid);

    let mut state = NetworkState::default();
    state.add_connection(first).unwrap();
    state.add_connection(second).unwrap();

    let collection = state
        .connection_collection_from(&NetworkConnectionsCollection(vec![NetworkConnection {
            id: "second".to_string(),
            status: Some(Status::Removed),
            ..Default::default()
        }]))
        .unwrap();

    // Given at the top level, "second" is moved out of "first", which breaks the loop.
    assert!(collection.0.iter().all(|c| c.is_removed()));
}

/// Same as above, when reporting the state: the members of a loop are not reachable from any
/// root, but they must not be lost.
#[test]
fn test_a_loop_of_controllers_is_still_reported() {
    let mut first = Connection::new("first".to_string(), DeviceType::Bridge);
    let mut second = Connection::new("second".to_string(), DeviceType::Bridge);
    first.controller = Some(second.uuid);
    second.controller = Some(first.uuid);

    let exposed: NetworkConnectionsCollection = ConnectionCollection(vec![first, second])
        .try_into()
        .unwrap();

    assert_eq!(exposed.flatten().len(), 2);
}

#[test]
fn test_removing_a_connection_that_is_still_listed_as_a_port_is_rejected() {
    let state = NetworkState::default();
    let collection = NetworkConnectionsCollection(vec![
        NetworkConnection {
            id: "eth0".to_string(),
            interface: Some("eth0".to_string()),
            status: Some(Status::Removed),
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
    assert!(matches!(error, NetworkStateError::RemovedPort(port, _) if port == "eth0"));
}
