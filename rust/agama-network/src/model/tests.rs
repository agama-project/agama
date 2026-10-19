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
///
/// A nested port is returned as the connection it stands for, without its port settings (see
/// [`bond_port`] and [`bridge_port`]).
fn find(collection: &NetworkConnectionsCollection, id: &str) -> NetworkConnection {
    collection
        .flatten()
        .into_iter()
        .find(|c| c.id == id)
        .unwrap_or_else(|| panic!("{id} is missing from the collection"))
}

/// Returns the bond settings of the connection with the given ID, at the top level or nested in a
/// bridge, to edit them.
fn bond_mut<'a>(
    collection: &'a mut NetworkConnectionsCollection,
    id: &str,
) -> &'a mut BondSettings {
    collection
        .0
        .iter_mut()
        .find_map(|conn| {
            if conn.id == id {
                return conn.bond.as_mut();
            }
            let ports = conn.bridge.as_mut()?.port_connections.as_mut()?;
            ports.iter_mut().find_map(|port| match port {
                BridgePort::Bond(port) if port.id.as_deref() == Some(id) => Some(&mut port.bond),
                _ => None,
            })
        })
        .unwrap_or_else(|| panic!("{id} is not a bond"))
}

/// Returns the bridge settings of the connection with the given ID to edit them. A bridge cannot
/// be nested, so it is at the top level.
fn bridge_mut<'a>(
    collection: &'a mut NetworkConnectionsCollection,
    id: &str,
) -> &'a mut BridgeSettings {
    collection
        .0
        .iter_mut()
        .find(|conn| conn.id == id)
        .and_then(|conn| conn.bridge.as_mut())
        .unwrap_or_else(|| panic!("{id} is not a bridge"))
}

/// Whether the given port is nested and has the given ID.
fn is_nested_port<'a>(port: impl Into<PortRef<'a>>, id: &str) -> bool {
    matches!(port.into(), PortRef::Connection(port) if port.id() == Some(id))
}

/// Finds a port of a bridge by ID in an API collection, as it is given in its controller.
fn bridge_port(collection: &NetworkConnectionsCollection, id: &str) -> BridgePort {
    collection
        .0
        .iter()
        .filter_map(|conn| conn.bridge.as_ref()?.port_connections.as_ref())
        .flatten()
        .find(|port| is_nested_port(*port, id))
        .cloned()
        .unwrap_or_else(|| panic!("{id} is not nested in a bridge"))
}

/// Finds a port of a bond by ID in an API collection, as it is given in its controller.
fn bond_port(collection: &NetworkConnectionsCollection, id: &str) -> BondPort {
    let nested_bonds = |conn: &NetworkConnection| -> Vec<BondSettings> {
        let ports = conn
            .bridge
            .iter()
            .flat_map(|b| b.port_connections.iter().flatten());
        ports
            .filter_map(|port| match port {
                BridgePort::Bond(port) => Some(port.bond.clone()),
                _ => None,
            })
            .collect()
    };

    collection
        .0
        .iter()
        .flat_map(|conn| conn.bond.clone().into_iter().chain(nested_bonds(conn)))
        .flat_map(|bond| bond.port_connections.unwrap_or_default())
        .find(|port| is_nested_port(port, id))
        .unwrap_or_else(|| panic!("{id} is not nested in a bond"))
}

/// Returns the IDs (or names) of the ports listed by a connection.
fn port_ids(conn: &NetworkConnection) -> Vec<String> {
    conn.ports()
        .into_iter()
        .flatten()
        .map(|p| match p {
            PortRef::Name(name) => name.to_string(),
            PortRef::Connection(port) => port.id().unwrap_or_default().to_string(),
        })
        .collect()
}

/// Returns the sorted IDs of the root connections of an API collection.
fn root_ids(collection: &NetworkConnectionsCollection) -> Vec<&str> {
    let mut ids: Vec<&str> = collection.0.iter().map(|c| c.id.as_str()).collect();
    ids.sort_unstable();
    ids
}

/// A port given by name, for either kind of controller.
trait Named {
    fn named(name: &str) -> Self;
}

impl Named for BondPort {
    fn named(name: &str) -> Self {
        Self::Name(name.to_string())
    }
}

impl Named for BridgePort {
    fn named(name: &str) -> Self {
        Self::Name(name.to_string())
    }
}

fn name<P: Named>(name: &str) -> P {
    P::named(name)
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
