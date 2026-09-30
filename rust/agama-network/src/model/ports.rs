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
//! Over the API, the ports of a controller are nested in its `ports` list (`bond.ports` or
//! `bridge.ports`), either as connections or by name. This module turns that tree into the
//! `controller` links of the internal model, and rejects the configurations that cannot be
//! represented (unknown or ambiguous names, ports claimed by two controllers, loops, etc.).

use std::collections::{HashMap, HashSet};

use agama_utils::api::network::{
    DeviceType, IpConfig, Ipv4Method, Ipv6Method, NetworkConnection, NetworkConnectionsCollection,
    PortEntry, Status,
};
use uuid::Uuid;

use super::{Connection, ConnectionCollection, ConnectionConfig, PortConfig};
use crate::error::NetworkStateError;

/// A connection of the incoming document, wherever it sits in the tree.
struct Node<'a> {
    conn: &'a NetworkConnection,
    /// ID of the connection. For a nested port that does not give one, it is derived from its
    /// interface (see [`PortResolver::port_id`]).
    id: String,
    /// Index of the node of its controller, for a port nested in its controller.
    parent: Option<usize>,
}

/// A port that the incoming document refers to by name.
struct NamedPort<'a> {
    name: &'a str,
    /// Index of the node of the controller that lists it.
    parent: usize,
}

/// Port UUID -> (controller UUID, controller ID). The ID is only kept for error messages.
type Claims = HashMap<Uuid, (Uuid, String)>;

/// Turns a collection of API connections into internal connections with their relationships set.
///
/// The resolver needs to know about the connections that already exist, for two reasons:
///
/// * A port given by name may refer to a connection that the payload does not include. In that
///   case the existing connection is pulled into the resulting collection instead of being
///   duplicated.
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
    /// The result contains one entry per incoming connection, nested ports included, plus any
    /// connection that a port name refers to and the payload does not include.
    ///
    /// * `incoming`: connections as they arrive from the HTTP API.
    pub fn resolve(
        &self,
        incoming: &NetworkConnectionsCollection,
    ) -> Result<ConnectionCollection, NetworkStateError> {
        let (nodes, named) = self.walk(incoming)?;
        let mut conns = self.merge_incoming(&nodes)?;
        let claims = self.resolve_claims(&nodes, &named, &mut conns)?;
        self.link(&nodes, &mut conns, &claims);
        self.check_port_settings(&nodes, &conns)?;
        self.cascade_removals(&mut conns);
        self.check_cycles(&conns)?;

        Ok(ConnectionCollection(conns))
    }

    /// Flattens the incoming tree, parents before their ports.
    ///
    /// It returns the connections and, separately, the ports given by name, which cannot be told
    /// apart from a new connection until they are resolved.
    fn walk<'b>(
        &self,
        incoming: &'b NetworkConnectionsCollection,
    ) -> Result<(Vec<Node<'b>>, Vec<NamedPort<'b>>), NetworkStateError> {
        let mut nodes = vec![];
        let mut named = vec![];

        for conn in &incoming.0 {
            self.visit(conn, None, &mut nodes, &mut named)?;
        }

        let mut seen = HashSet::new();
        if let Some(node) = nodes.iter().find(|n| !seen.insert(n.id.as_str())) {
            return Err(NetworkStateError::DuplicatedConnection(node.id.clone()));
        }

        Ok((nodes, named))
    }

    /// Adds the connection and its ports, recursively, to the given lists.
    fn visit<'b>(
        &self,
        conn: &'b NetworkConnection,
        parent: Option<usize>,
        nodes: &mut Vec<Node<'b>>,
        named: &mut Vec<NamedPort<'b>>,
    ) -> Result<(), NetworkStateError> {
        let id = match parent {
            Some(parent) if conn.id.is_empty() => self.port_id(conn, &nodes[parent].id)?,
            _ => conn.id.clone(),
        };

        let index = nodes.len();
        nodes.push(Node { conn, id, parent });

        for port in conn.ports().into_iter().flatten() {
            match port {
                PortEntry::Name(name) => named.push(NamedPort {
                    name,
                    parent: index,
                }),
                PortEntry::Connection(port) => self.visit(port, Some(index), nodes, named)?,
            }
        }

        Ok(())
    }

    /// Returns the ID of a nested port that does not give one.
    ///
    /// Like a port given by name, it refers to the existing connection bound to its interface,
    /// if any. Otherwise, the interface name becomes the ID of the new connection.
    ///
    /// * `conn`: nested port.
    /// * `controller_id`: ID of its controller, for error reporting.
    fn port_id(
        &self,
        conn: &NetworkConnection,
        controller_id: &str,
    ) -> Result<String, NetworkStateError> {
        let Some(interface) = conn.interface.as_deref().filter(|i| !i.is_empty()) else {
            return Err(NetworkStateError::MissingPortId(controller_id.to_string()));
        };

        let existing = find_by_name(self.known.iter(), interface)?
            .and_then(|uuid| self.known.iter().find(|c| c.uuid == uuid));

        Ok(existing
            .map(|c| c.id.clone())
            .unwrap_or_else(|| interface.to_string()))
    }

    /// Builds one internal connection per node, in the same order.
    ///
    /// When the connection is already known, the incoming settings are applied on top of it so
    /// that its UUID and the settings that the HTTP API does not model are preserved.
    fn merge_incoming(&self, nodes: &[Node]) -> Result<Vec<Connection>, NetworkStateError> {
        let mut conns = Vec::with_capacity(nodes.len());

        for node in nodes {
            let mut conn = match self.known.iter().find(|c| c.id == node.id) {
                Some(known) => known.clone(),
                None => Connection::new(node.id.clone(), node.conn.device_type()),
            };
            conn.apply_settings(node.conn)?;
            conns.push(conn);
        }

        Ok(conns)
    }

    /// Resolves the controller of every port in the document.
    ///
    /// A nested port is claimed by the controller it sits in, and those claims cannot conflict:
    /// every node has a single parent and the IDs are unique. The ports given by name are the ones
    /// that can end up claimed twice.
    ///
    /// Connections that are named as ports but are missing from `conns` are appended to it,
    /// either taken from the known connections or created from scratch.
    fn resolve_claims(
        &self,
        nodes: &[Node],
        named: &[NamedPort],
        conns: &mut Vec<Connection>,
    ) -> Result<Claims, NetworkStateError> {
        let mut claims = Claims::new();

        for (index, node) in nodes.iter().enumerate() {
            if let Some(parent) = node.parent {
                claims.insert(
                    conns[index].uuid,
                    (conns[parent].uuid, nodes[parent].id.clone()),
                );
            }
        }

        for port in named {
            let controller_uuid = conns[port.parent].uuid;
            let controller_id = &nodes[port.parent].id;
            let port_uuid = self.resolve_port(port.name, controller_id, conns)?;

            if let Some((other_uuid, other_id)) = claims.get(&port_uuid) {
                if *other_uuid != controller_uuid {
                    return Err(NetworkStateError::PortAlreadyClaimed(
                        port.name.to_string(),
                        other_id.clone(),
                        controller_id.clone(),
                    ));
                }
            }

            claims.insert(port_uuid, (controller_uuid, controller_id.clone()));
        }

        Ok(claims)
    }

    /// Finds the connection a port name refers to, adding it to `conns` when needed.
    ///
    /// The name is matched against the interface name first and against the connection ID
    /// afterwards.
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
    /// The position in the document decides the controller of every connection it mentions:
    ///
    /// * A port, nested or given by name, is attached to the controller that lists it. A port has
    ///   no IP configuration of its own, as its controller holds it, so it is cleared. That is also
    ///   what NetworkManager does with the IP settings of a port.
    /// * A connection at the top level is not a port. If it was one, it is moved out of its
    ///   controller, and its IP methods default to `auto`: a NIC taken out of a bond should not be
    ///   left without an address.
    ///
    /// A port that is dropped from the `ports` list of its controller, and that the document does
    /// not mention anywhere else, is removed. Detaching it would leave behind a profile without IP
    /// settings, which can still grab the NIC without giving it an address. This only
    /// applies to the controllers whose `ports` list is part of the payload, so a partial update
    /// that does not mention a controller leaves its ports alone.
    fn link(&self, nodes: &[Node], conns: &mut Vec<Connection>, claims: &Claims) {
        let declared: HashSet<Uuid> = nodes
            .iter()
            .enumerate()
            .filter(|(_, node)| node.conn.ports().is_some())
            .map(|(index, _)| conns[index].uuid)
            .collect();

        let present: HashSet<Uuid> = conns.iter().map(|c| c.uuid).collect();
        let dropped = self
            .known
            .iter()
            .filter(|c| c.controller.is_some_and(|u| declared.contains(&u)))
            .filter(|c| !present.contains(&c.uuid))
            .map(|c| {
                tracing::info!("Removing '{}', which is not listed as a port anymore", c.id);
                let mut conn = c.clone();
                conn.remove();
                conn
            })
            .collect::<Vec<_>>();
        conns.extend(dropped);

        let present: HashSet<Uuid> = conns.iter().map(|c| c.uuid).collect();
        let bridges: HashSet<Uuid> = conns
            .iter()
            .chain(self.known.iter().filter(|c| !present.contains(&c.uuid)))
            .filter(|c| matches!(c.config, ConnectionConfig::Bridge(_)))
            .map(|c| c.uuid)
            .collect();

        for (index, conn) in conns.iter_mut().enumerate() {
            let node = nodes.get(index);

            if let Some((controller, _)) = claims.get(&conn.uuid) {
                // Ports that are not part of the payload only change when they join a controller.
                if node.is_some() || conn.controller != Some(*controller) {
                    conn.ip_config = IpConfig::default();
                }
                // The bridge port settings of a port that joins a bond would not be accepted
                // back, so they go away with the bridge.
                if !bridges.contains(controller) {
                    conn.port_config = PortConfig::None;
                }
                conn.controller = Some(*controller);
            } else if node.is_some_and(|n| n.parent.is_none()) && conn.controller.is_some() {
                tracing::info!("Moving '{}' out of its controller", conn.id);
                conn.controller = None;
                conn.port_config = PortConfig::None;
                if !conn.is_removed() {
                    default_ip_methods(
                        conn,
                        node.map(|n| n.conn),
                        Ipv4Method::Auto,
                        Ipv6Method::Auto,
                    );
                }
            }
        }
    }

    /// Checks that the settings given to each port fit it.
    ///
    /// * A port cannot have IP settings, as its controller holds the IP configuration.
    /// * The `port` settings must match the kind of its controller. They are flat, so a bridge port
    ///   priority given to a port of a bond would be silently dropped otherwise.
    fn check_port_settings(
        &self,
        nodes: &[Node],
        conns: &[Connection],
    ) -> Result<(), NetworkStateError> {
        for (node, conn) in nodes.iter().zip(conns) {
            let Some(uuid) = conn.controller else {
                continue;
            };
            let Some(controller) = conns.iter().chain(self.known).find(|c| c.uuid == uuid) else {
                continue;
            };

            // A port on its way out does not get any setting anyway.
            if node.conn.status != Some(Status::Removed) && node.conn.has_ip_settings() {
                return Err(NetworkStateError::PortIpSettings(
                    node.id.clone(),
                    controller.id.clone(),
                ));
            }

            let Some(settings) = &node.conn.port else {
                continue;
            };

            let fits = match controller.config {
                ConnectionConfig::Bridge(_) => true,
                _ => !settings.has_bridge_settings(),
            };
            if !fits {
                return Err(NetworkStateError::InvalidPortSettings(
                    node.id.clone(),
                    controller.id.clone(),
                ));
            }
        }

        Ok(())
    }

    /// Marks the ports of the connections that are being removed, all the way down.
    ///
    /// A port does not outlive its controller. It is a connection without IP settings
    /// and, in the case of a bond or a bridge, a device that only exists because something asked
    /// for it. Leaving it behind would mean writing a connection that points at a controller that
    /// is being deleted in the very same operation.
    ///
    /// The ports do not have to be part of the payload: removing a whole stack is a single entry,
    /// and everything below it is pulled in from the connections that already exist.
    fn cascade_removals(&self, conns: &mut Vec<Connection>) {
        let mut removed: HashSet<Uuid> = conns
            .iter()
            .filter(|c| c.is_removed())
            .map(|c| c.uuid)
            .collect();

        if removed.is_empty() {
            return;
        }

        // One pass per level of the stack. A pass that neither pulls a connection in nor removes
        // one is the last, so a loop of controllers cannot keep this spinning.
        loop {
            let present: HashSet<Uuid> = conns.iter().map(|c| c.uuid).collect();
            let pulled: Vec<Connection> = self
                .known
                .iter()
                .filter(|c| !present.contains(&c.uuid))
                .filter(|c| c.controller.is_some_and(|uuid| removed.contains(&uuid)))
                .cloned()
                .collect();

            let mut changed = !pulled.is_empty();
            conns.extend(pulled);

            for conn in conns.iter_mut() {
                if conn.is_removed() || !conn.controller.is_some_and(|u| removed.contains(&u)) {
                    continue;
                }

                tracing::info!("Removing '{}' along with its controller", conn.id);
                conn.remove();
                removed.insert(conn.uuid);
                changed = true;
            }

            if !changed {
                break;
            }
        }

        self.warn_on_dangling_vlans(conns);
    }

    /// Warns about the VLANs that a removal leaves without a parent.
    ///
    /// A VLAN names its parent by interface name instead of joining it as a port, so it is not
    /// part of the tree that [`Self::cascade_removals`] walks. Whether it should be is not
    /// obvious: a VLAN over a bridge or a bond goes down with it, because the parent device
    /// disappears along with its connection, but a VLAN over a physical NIC keeps working after
    /// the profile of that NIC is deleted. Until that is settled, at least say it out loud.
    fn warn_on_dangling_vlans(&self, conns: &[Connection]) {
        let present: HashSet<Uuid> = conns.iter().map(|c| c.uuid).collect();
        let all = || {
            conns
                .iter()
                .chain(self.known.iter().filter(|c| !present.contains(&c.uuid)))
        };

        for conn in all().filter(|c| c.is_removed()) {
            let parent = ConnectionCollection::reference_name(conn);

            for vlan in all().filter(|c| !c.is_removed()) {
                let ConnectionConfig::Vlan(config) = &vlan.config else {
                    continue;
                };

                if config.parent == parent {
                    tracing::warn!(
                        "The VLAN '{}' is left without its parent '{}', which is being removed",
                        vlan.id,
                        parent
                    );
                }
            }
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

/// Sets the IP methods that the incoming connection does not set.
///
/// * `conn`: connection to update.
/// * `api_conn`: incoming connection, if it is part of the payload. When it is not, both methods
///   are set.
/// * `method4`, `method6`: methods to use.
fn default_ip_methods(
    conn: &mut Connection,
    api_conn: Option<&NetworkConnection>,
    method4: Ipv4Method,
    method6: Ipv6Method,
) {
    if api_conn.is_none_or(|c| c.method4.is_none()) {
        conn.ip_config.method4 = Some(method4);
    }
    if api_conn.is_none_or(|c| c.method6.is_none()) {
        conn.ip_config.method6 = Some(method6);
    }
}

/// Finds the connection referred to by the given name.
///
/// The interface name takes precedence over the connection ID. Connections that are about to be
/// removed are ignored, as they are on their way out.
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
