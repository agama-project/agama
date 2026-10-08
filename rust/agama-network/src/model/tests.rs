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

//! Tests of the network model, grouped by topic in the modules below. The helpers used by more
//! than one topic live here.

mod ports;
mod profiles;
mod removal;
mod reporting;
mod state;

use super::*;
use crate::error::NetworkStateError;
use uuid::Uuid;

/// Finds a connection by ID in an API collection, wherever it is nested.
fn find(collection: &NetworkConnectionsCollection, id: &str) -> NetworkConnection {
    collection
        .flatten()
        .into_iter()
        .find(|c| c.id == id)
        .unwrap_or_else(|| panic!("{id} is missing from the collection"))
        .clone()
}

/// Mutable version of [`find`].
fn find_mut<'a>(conns: &'a mut [NetworkConnection], id: &str) -> Option<&'a mut NetworkConnection> {
    for conn in conns.iter_mut() {
        if conn.id == id {
            return Some(conn);
        }
        let Some(ports) = conn.port_connections_mut() else {
            continue;
        };
        for port in ports.iter_mut() {
            if let PortEntry::Connection(port) = port {
                if let Some(found) = find_mut(std::slice::from_mut(port.as_mut()), id) {
                    return Some(found);
                }
            }
        }
    }
    None
}

/// Returns the IDs (or names) of the ports listed by a connection.
fn port_ids(conn: &NetworkConnection) -> Vec<String> {
    conn.ports()
        .into_iter()
        .flatten()
        .map(|p| match p {
            PortRef::Name(name) => name.to_string(),
            PortRef::Connection(conn) => conn.id.clone(),
        })
        .collect()
}

/// Returns the sorted IDs of the root connections of an API collection.
fn root_ids(collection: &NetworkConnectionsCollection) -> Vec<&str> {
    let mut ids: Vec<&str> = collection.0.iter().map(|c| c.id.as_str()).collect();
    ids.sort_unstable();
    ids
}

fn name(name: &str) -> PortEntry {
    PortEntry::Name(name.to_string())
}

fn nested(conn: NetworkConnection) -> PortEntry {
    PortEntry::Connection(Box::new(conn))
}

/// Builds a state holding the stacked connections from the test fixture.
fn stacked_state() -> NetworkState {
    let mut state = NetworkState::default();
    for conn in crate::test_utils::stacked_connections() {
        state.add_connection(conn).unwrap();
    }
    state
}

/// Builds the API representation of the whole state, as a client would read it and send it
/// back.
fn exposed(state: &NetworkState) -> NetworkConnectionsCollection {
    ConnectionCollection(state.connections.clone())
        .try_into()
        .unwrap()
}

/// Removes the given connection through the HTTP API, the way a client does it.
fn remove(state: &mut NetworkState, id: &str) {
    state
        .update_state(Config {
            connections: Some(NetworkConnectionsCollection(vec![NetworkConnection {
                id: id.to_string(),
                status: Some(Status::Removed),
                ..Default::default()
            }])),
            ..Default::default()
        })
        .unwrap();
}
