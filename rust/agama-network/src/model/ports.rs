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

//! Resolution of the controller/port relationships declared in the HTTP API.
//!
//! Over the API, a controller declares its members through a list of names (`bond.ports` or
//! `bridge.ports`) instead of through UUIDs, which are an implementation detail. This module
//! turns such a list into the `controller` links of the internal model, and rejects the
//! configurations that cannot be represented (unknown or ambiguous names, ports claimed by two
//! controllers, loops, etc.).

use std::collections::{HashMap, HashSet};

use agama_utils::api::network::{DeviceType, NetworkConnection, NetworkConnectionsCollection};
use uuid::Uuid;

use super::{Connection, ConnectionCollection};
use crate::error::NetworkStateError;

/// Turns a collection of API connections into internal connections with their relationships set.
///
/// The resolver needs to know about the connections that already exist, for two reasons:
///
/// * A `ports` list may name a connection that the payload does not include. In that case the
///   existing connection is pulled into the resulting collection instead of being duplicated.
/// * Updating a connection must not drop the settings that the HTTP API does not model, so the
///   incoming settings are merged onto the existing connection when there is one.
pub struct PortResolver<'a> {
    known: &'a [Connection],
}

impl<'a> PortResolver<'a> {
    /// * `known`: connections that already exist in the network state.
    pub fn new(known: &'a [Connection]) -> Self {
        Self { known }
    }

    /// Builds the internal connections for the given API collection.
    ///
    /// The result contains one entry per incoming connection, plus any connection that a `ports`
    /// list refers to and the payload does not include.
    ///
    /// * `incoming`: connections as they arrive from the HTTP API.
    pub fn resolve(
        &self,
        incoming: &NetworkConnectionsCollection,
    ) -> Result<ConnectionCollection, NetworkStateError> {
        let mut conns = self.merge_incoming(incoming)?;
        let claims = self.resolve_claims(incoming, &mut conns)?;
        self.link(incoming, &mut conns, &claims);
        self.check_cycles(&conns)?;

        Ok(ConnectionCollection(conns))
    }

    /// Builds one internal connection per incoming connection.
    ///
    /// When the connection is already known, the incoming settings are applied on top of it so
    /// that its UUID and the settings that the HTTP API does not model are preserved.
    fn merge_incoming(
        &self,
        incoming: &NetworkConnectionsCollection,
    ) -> Result<Vec<Connection>, NetworkStateError> {
        let mut conns = Vec::with_capacity(incoming.0.len());

        for api_conn in &incoming.0 {
            let mut conn = match self.known.iter().find(|c| c.id == api_conn.id) {
                Some(known) => known.clone(),
                None => Connection::new(api_conn.id.clone(), api_conn.device_type()),
            };
            conn.apply_settings(api_conn)?;
            conns.push(conn);
        }

        Ok(conns)
    }

    /// Resolves the `ports` lists into a port UUID -> controller map.
    ///
    /// Connections that are named by a `ports` list but are missing from `conns` are appended to
    /// it, either taken from the known connections or created from scratch.
    fn resolve_claims(
        &self,
        incoming: &NetworkConnectionsCollection,
        conns: &mut Vec<Connection>,
    ) -> Result<HashMap<Uuid, Uuid>, NetworkStateError> {
        // port UUID -> (controller UUID, controller ID), the ID is only kept for error messages.
        let mut claims: HashMap<Uuid, (Uuid, String)> = HashMap::new();

        for api_conn in &incoming.0 {
            let Some(ports) = ports_of(api_conn) else {
                continue;
            };

            // Safe to unwrap: merge_incoming pushed one connection per incoming connection and
            // the HTTP API guarantees that the IDs are unique.
            let controller_uuid = conns.iter().find(|c| c.id == api_conn.id).unwrap().uuid;

            for name in ports {
                let port_uuid = self.resolve_port(name, &api_conn.id, conns)?;

                if port_uuid == controller_uuid {
                    return Err(NetworkStateError::SelfReferencedPort(api_conn.id.clone()));
                }

                if let Some((other_uuid, other_id)) = claims.get(&port_uuid) {
                    if *other_uuid != controller_uuid {
                        return Err(NetworkStateError::PortAlreadyClaimed(
                            name.clone(),
                            other_id.clone(),
                            api_conn.id.clone(),
                        ));
                    }
                }

                claims.insert(port_uuid, (controller_uuid, api_conn.id.clone()));
            }
        }

        Ok(claims.into_iter().map(|(k, (v, _))| (k, v)).collect())
    }

    /// Finds the connection a port name refers to, adding it to `conns` when needed.
    ///
    /// The name is matched against the interface name first and against the connection ID
    /// afterwards. This is the same order used to build the `ports` lists, so a name always
    /// resolves back to the connection it was generated from.
    ///
    /// * `name`: name to resolve.
    /// * `controller_id`: ID of the controller that lists the port, for error reporting.
    /// * `conns`: connections built so far.
    fn resolve_port(
        &self,
        name: &str,
        controller_id: &str,
        conns: &mut Vec<Connection>,
    ) -> Result<Uuid, NetworkStateError> {
        if let Some(uuid) = find_by_name(conns.iter(), name)? {
            return Ok(uuid);
        }

        // The payload does not include the port, so look for a connection that already exists.
        // Connections that the payload does update are skipped, as the loop above already
        // considered them under their updated name.
        let updated: HashSet<&str> = conns.iter().map(|c| c.id.as_str()).collect();
        let candidates = self
            .known
            .iter()
            .filter(|c| !updated.contains(c.id.as_str()));

        if let Some(uuid) = find_by_name(candidates, name)? {
            // Safe to unwrap: find_by_name only returns UUIDs of the connections it was given.
            let known = self.known.iter().find(|c| c.uuid == uuid).unwrap();
            conns.push(known.clone());
            return Ok(uuid);
        }

        // Creating a connection for a name that is being removed would leave two connections
        // fighting over the same interface, so ask the client to make up its mind.
        if conns
            .iter()
            .chain(self.known)
            .any(|c| c.is_removed() && (c.interface.as_deref() == Some(name) || c.id == name))
        {
            return Err(NetworkStateError::RemovedPort(
                name.to_string(),
                controller_id.to_string(),
            ));
        }

        // Nothing matches the name. Assume it is a network interface with no connection profile
        // yet, which is the usual case for the ports of a bond or a bridge.
        tracing::info!(
            "Creating an Ethernet connection for '{}', listed as a port of '{}'",
            name,
            controller_id
        );
        let mut conn = Connection::new(name.to_string(), DeviceType::Ethernet);
        conn.interface = Some(name.to_string());
        let uuid = conn.uuid;
        conns.push(conn);

        Ok(uuid)
    }

    /// Writes the resolved relationships to the connections.
    ///
    /// A connection that no controller claims is detached, but only when the payload does declare
    /// the ports of its current controller. Otherwise a partial update, which does not have to
    /// mention every connection, would tear the existing stack apart.
    fn link(
        &self,
        incoming: &NetworkConnectionsCollection,
        conns: &mut Vec<Connection>,
        claims: &HashMap<Uuid, Uuid>,
    ) {
        let declared: HashSet<Uuid> = incoming
            .0
            .iter()
            .filter(|c| ports_of(c).is_some())
            .filter_map(|c| conns.iter().find(|k| k.id == c.id))
            .map(|c| c.uuid)
            .collect();

        // Bring in the connections that are currently attached to one of the controllers but are
        // not listed anymore, so that they can be detached below.
        let present: HashSet<Uuid> = conns.iter().map(|c| c.uuid).collect();
        let dropped: Vec<Connection> = self
            .known
            .iter()
            .filter(|c| c.controller.is_some_and(|u| declared.contains(&u)))
            .filter(|c| !present.contains(&c.uuid))
            .cloned()
            .collect();
        conns.extend(dropped);

        for conn in conns.iter_mut() {
            if let Some(controller) = claims.get(&conn.uuid) {
                conn.controller = Some(*controller);
            } else if conn.controller.is_some_and(|c| declared.contains(&c)) {
                tracing::info!("Detaching '{}' from its controller", conn.id);
                conn.controller = None;
            }
        }

        for api_conn in &incoming.0 {
            let Some(conn) = conns.iter().find(|c| c.id == api_conn.id) else {
                continue;
            };
            warn_on_controller_mismatch(api_conn, conn, controller_name(conns, conn.controller));
        }
    }

    /// Checks that following the controllers always leads somewhere.
    fn check_cycles(&self, conns: &[Connection]) -> Result<(), NetworkStateError> {
        let mut by_uuid: HashMap<Uuid, &Connection> =
            self.known.iter().map(|c| (c.uuid, c)).collect();
        by_uuid.extend(conns.iter().map(|c| (c.uuid, c)));

        for conn in conns {
            let mut seen = HashSet::from([conn.uuid]);
            let mut current = conn;

            while let Some(uuid) = current.controller {
                if !seen.insert(uuid) {
                    return Err(NetworkStateError::ControllerCycle(conn.id.clone()));
                }

                let Some(next) = by_uuid.get(&uuid) else {
                    break;
                };
                current = next;
            }
        }

        Ok(())
    }
}

/// Returns the ports declared by an API connection, if it declares any.
///
/// An empty list is not the same as no list at all: a connection with a `bond` or a `bridge`
/// section declares its ports, even when there is none.
fn ports_of(conn: &NetworkConnection) -> Option<&Vec<String>> {
    conn.bond
        .as_ref()
        .map(|b| &b.ports)
        .or_else(|| conn.bridge.as_ref().map(|b| &b.ports))
}

/// Finds the connection referred to by the given name.
///
/// The interface name takes precedence over the connection ID, matching the way the names are
/// generated. Connections that are about to be removed are ignored, as they are on their way out.
fn find_by_name<'a>(
    mut conns: impl Iterator<Item = &'a Connection> + Clone,
    name: &str,
) -> Result<Option<Uuid>, NetworkStateError> {
    let mut by_interface = conns
        .clone()
        .filter(|c| !c.is_removed() && c.interface.as_deref() == Some(name));

    if let Some(conn) = by_interface.next() {
        if by_interface.next().is_some() {
            return Err(NetworkStateError::AmbiguousPort(name.to_string()));
        }
        return Ok(Some(conn.uuid));
    }

    let by_id = conns.find(|c| !c.is_removed() && c.id == name);

    Ok(by_id.map(|c| c.uuid))
}

/// Returns the name used to refer to the connection with the given UUID.
fn controller_name(conns: &[Connection], uuid: Option<Uuid>) -> Option<String> {
    let uuid = uuid?;
    conns
        .iter()
        .find(|c| c.uuid == uuid)
        .map(|c| ConnectionCollection::reference_name(c).to_string())
}

/// Logs a warning when the `controller` field disagrees with the resolved relationship.
///
/// The `ports` lists are the only way to change the membership, so the field is ignored. Clients
/// read the whole configuration, change a piece of it and write it back, and they would trip over
/// a stale `controller` all the time if it were an error.
fn warn_on_controller_mismatch(
    api_conn: &NetworkConnection,
    conn: &Connection,
    resolved: Option<String>,
) {
    let Some(declared) = api_conn.controller.as_deref() else {
        return;
    };

    if resolved.as_deref() != Some(declared) {
        tracing::warn!(
            "Ignoring the controller '{}' declared by '{}': the ports lists put it under {}. \
             Change the controller's ports to move the connection.",
            declared,
            conn.id,
            resolved
                .map(|c| format!("'{c}'"))
                .unwrap_or_else(|| "no controller".to_string())
        );
    }
}
