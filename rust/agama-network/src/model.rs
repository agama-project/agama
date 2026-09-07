// Copyright (c) [2024] SUSE LLC
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

//! Representation of the network configuration
//!
//! * This module contains the types that represent the network concepts. They are supposed to be
//!   agnostic from the real network service (e.g., NetworkManager).
mod ports;

use crate::error::NetworkStateError;
use crate::types::*;
pub use ports::PortResolver;

use macaddr::MacAddr6;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_with::{serde_as, skip_serializing_none, DisplayFromStr};
use std::{
    collections::HashMap,
    default::Default,
    fmt,
    path::{Path, PathBuf},
    str::{self, FromStr},
};
use thiserror::Error;
use tokio::process;
use uuid::Uuid;

#[derive(PartialEq)]
/// Configuration for determining which parts of the network state should be retrieved or managed.
pub struct StateConfig {
    /// Whether to include access points in the state.
    pub access_points: bool,
    /// Whether to include devices in the state.
    pub devices: bool,
    /// Whether to include connections in the state.
    pub connections: bool,
    /// Whether to include general state information.
    pub general_state: bool,
}

impl Default for StateConfig {
    fn default() -> Self {
        Self {
            access_points: true,
            devices: true,
            connections: true,
            general_state: true,
        }
    }
}

#[derive(Default, Clone, Debug, PartialEq)]
/// Represents the overall network state, including configuration and runtime information.
pub struct NetworkState {
    /// The user-defined configuration for the network.
    pub user_config: Option<Config>,
    /// General network state and settings.
    pub general_state: GeneralState,
    /// List of detected wireless access points.
    pub access_points: Vec<AccessPoint>,
    /// List of network devices present in the system.
    pub devices: Vec<Device>,
    /// List of network connections (profiles).
    pub connections: Vec<Connection>,
}

impl NetworkState {
    /// Returns a NetworkState struct with the given general_state, access_points, devices
    /// and connections.
    ///
    /// * `user_config`: User-defined network configuration.
    /// * `general_state`: General network configuration
    /// * `access_points`: Access points to include in the state.
    /// * `devices`: devices to include in the state.
    /// * `connections`: connections to include in the state.
    pub fn new(
        user_config: Option<Config>,
        general_state: GeneralState,
        access_points: Vec<AccessPoint>,
        devices: Vec<Device>,
        connections: Vec<Connection>,
    ) -> Self {
        Self {
            user_config,
            general_state,
            access_points,
            devices,
            connections,
        }
    }

    /// Get device by name
    ///
    /// * `name`: device name
    pub fn get_device(&self, name: &str) -> Option<&Device> {
        self.devices.iter().find(|d| d.name == name)
    }

    /// Get connection by UUID
    ///
    /// * `uuid`: connection UUID
    pub fn get_connection_by_uuid(&self, uuid: Uuid) -> Option<&Connection> {
        self.connections.iter().find(|c| c.uuid == uuid)
    }

    /// Get connection by UUID as mutable
    ///
    /// * `uuid`: connection UUID
    pub fn get_connection_by_uuid_mut(&mut self, uuid: Uuid) -> Option<&mut Connection> {
        self.connections.iter_mut().find(|c| c.uuid == uuid)
    }

    /// Get connection by interface
    ///
    /// * `name`: connection interface name
    pub fn get_connection_by_interface(&self, name: &str) -> Option<&Connection> {
        let interface = Some(name);
        self.connections
            .iter()
            .find(|c| c.interface.as_deref() == interface)
    }

    /// Get connection by ID
    ///
    /// * `id`: connection ID
    pub fn get_connection(&self, id: &str) -> Option<&Connection> {
        self.connections.iter().find(|c| c.id == id)
    }

    /// Get connection by ID as mutable
    ///
    /// * `id`: connection ID
    pub fn get_connection_mut(&mut self, id: &str) -> Option<&mut Connection> {
        self.connections.iter_mut().find(|c| c.id == id)
    }

    /// Get a device by name as mutable
    ///
    /// * `name`: device name
    pub fn get_device_mut(&mut self, name: &str) -> Option<&mut Device> {
        self.devices.iter_mut().find(|c| c.name == name)
    }

    /// Updates the current state from the one read from the system.
    ///
    /// It replaces all the state except for the `user_config`.
    ///
    /// Returns true if the state has changed.
    ///
    /// * `state`: The new network state to sync from.
    pub fn sync_from(&mut self, mut state: NetworkState) -> bool {
        state.user_config = self.user_config.clone();
        if *self != state {
            *self = state;
            true
        } else {
            false
        }
    }

    /// Returns the controller's connection for the given connection Uuid.
    ///
    /// * `uuid`: connection UUID.
    pub fn get_controlled_by(&mut self, uuid: Uuid) -> Vec<&Connection> {
        let uuid = Some(uuid);
        self.connections
            .iter()
            .filter(|c| c.controller == uuid)
            .collect()
    }

    /// Adds a new connection.
    ///
    /// It uses the `id` to decide whether the connection already exists.
    ///
    /// * `conn`: The connection to add.
    pub fn add_connection(&mut self, conn: Connection) -> Result<(), NetworkStateError> {
        if self.get_connection(&conn.id).is_some() {
            return Err(NetworkStateError::ConnectionExists(conn.id));
        }
        self.connections.push(conn);

        Ok(())
    }

    // Persist the existing connections if there is no one to be persisted and the copy of the
    // network is not disabled
    pub fn propose_default(&mut self) -> Result<(), NetworkStateError> {
        if !self.general_state.copy_network {
            return Ok(());
        }
        if self.connections.is_empty() {
            return Ok(());
        }

        let to_persist: Vec<&Connection> =
            self.connections.iter().filter(|c| c.persistent).collect();
        if !to_persist.is_empty() {
            return Ok(());
        }

        for conn in self.connections.iter_mut() {
            conn.persistent = true;
            conn.keep_status();
        }

        Ok(())
    }

    pub async fn install(&self) -> Result<(), NetworkStateError> {
        const CONNECTIONS_PATH: &str = "/etc/NetworkManager/system-connections";
        let from = PathBuf::from(CONNECTIONS_PATH);
        let to = PathBuf::from(self.target_dir()).join(CONNECTIONS_PATH.trim_start_matches('/'));

        self.copy_files(&from, &to)?;

        const NETWORKD_PATH: &str = "/run/agama/systemd/network";
        const TARGET_NETWORKD_PATH: &str = "/etc/systemd/network";
        let from = PathBuf::from(NETWORKD_PATH);
        let to =
            PathBuf::from(self.target_dir()).join(TARGET_NETWORKD_PATH.trim_start_matches('/'));

        self.copy_files(&from, &to)?;

        self.enable_service(self.target_dir()).await
    }

    /// Enables the NetworkManager service in the given path.
    ///
    /// * `path`: The path to the root directory where the service should be enabled.
    pub async fn enable_service(&self, path: &str) -> Result<(), NetworkStateError> {
        let mut command = process::Command::new("chroot");
        command.args([path, "systemctl", "enable", "NetworkManager.service"]);

        match command.output().await {
            Ok(output) => {
                if !output.status.success() {
                    tracing::error!("Failed to enable the NetworkManager service: {output:?}")
                }
            }
            Err(error) => {
                tracing::error!("Failed to run the command to enable the NetworkManager service command: {error}");
            }
        }

        Ok(())
    }

    /// Copies the network configuration files from one directory to another.
    ///
    /// * `from`: The source directory.
    /// * `to`: The destination directory.
    fn copy_files(&self, from: &Path, to: &Path) -> Result<(), NetworkStateError> {
        if !from.exists() {
            return Ok(());
        }

        if !to.exists() {
            std::fs::create_dir_all(to).map_err(|e| NetworkStateError::IoError(e.to_string()))?;
        }

        for entry in
            std::fs::read_dir(from).map_err(|e| NetworkStateError::IoError(e.to_string()))?
        {
            let entry = entry.map_err(|e| NetworkStateError::IoError(e.to_string()))?;
            let path = entry.path();
            if path.is_file() {
                if let Some(file_name) = path.file_name() {
                    let dest = to.join(file_name);
                    if let Err(e) = std::fs::copy(&path, &dest) {
                        tracing::error!("It was not possible to copy {:?}: {:?}", &file_name, e);
                    }
                } else {
                    tracing::error!("The path {:?} looks wrong, skipping it.", &path);
                }
            }
        }

        Ok(())
    }

    fn target_dir(&self) -> &str {
        "/mnt"
    }

    /// Builds the internal connections for the given HTTP API connections.
    ///
    /// The connections that already exist are updated in place, keeping their UUID and the
    /// settings that the HTTP API does not model. The controller/port relationships declared
    /// through the `ports` lists are resolved against both the given connections and the ones
    /// already in the state.
    ///
    /// * `connections`: connections as they arrive from the HTTP API.
    pub fn connection_collection_from(
        &self,
        connections: &NetworkConnectionsCollection,
    ) -> Result<ConnectionCollection, NetworkStateError> {
        PortResolver::new(&self.connections).resolve(connections)
    }

    /// Updates the current [NetworkState] with the configuration provided.
    ///
    /// The config could contain a [NetworkConnectionsCollection] to be updated, in case of
    /// provided it will iterate over the connections adding or updating them.
    ///
    /// If the general state is provided it will sets the options given.
    ///
    /// * `config`: The new configuration to apply.
    pub fn update_state(&mut self, config: Config) -> Result<(), NetworkStateError> {
        if self.user_config.as_ref() == Some(&config) {
            tracing::info!("There is no user config change");
            return Ok(());
        }

        if let Some(connections) = &config.connections {
            let changed_connections = self.changed_connections(connections);

            if !changed_connections.is_empty() {
                let collection = self.connection_collection_from(&NetworkConnectionsCollection(
                    changed_connections,
                ))?;

                for conn in collection.iter() {
                    if self.get_connection(&conn.id).is_some() {
                        tracing::info!("Updating connection {}", &conn.id);
                        self.update_connection(conn.clone())?;
                    } else {
                        tracing::info!("Adding connection {}", &conn.id);
                        self.add_connection(conn.clone())?;
                    }
                }
            } else {
                tracing::info!("There is no connections change");
            }
        }

        if let Some(state) = &config.state {
            self.update_general_state(state.clone());
        }

        self.user_config = Some(config);

        Ok(())
    }

    /// Returns the connections that have changed.
    ///
    /// * `connections`: The connections to check.
    fn changed_connections(
        &self,
        connections: &NetworkConnectionsCollection,
    ) -> Vec<NetworkConnection> {
        connections
            .0
            .iter()
            .filter(|conn| {
                if let Some(user_config) = &self.user_config {
                    user_config
                        .connections
                        .as_ref()
                        .and_then(|c| c.0.iter().find(|cc| cc.id == conn.id))
                        .map(|cc| conn != &cc)
                        .unwrap_or(true)
                } else {
                    tracing::info!("There is no user config");
                    true
                }
            })
            .cloned()
            .collect()
    }

    /// Updates the general state from the given settings.
    ///
    /// * `state`: The new general state settings.
    fn update_general_state(&mut self, state: StateSettings) {
        if let Some(wireless_enabled) = state.wireless_enabled {
            self.general_state.wireless_enabled = wireless_enabled;
        }

        if let Some(networking_enabled) = state.networking_enabled {
            self.general_state.networking_enabled = networking_enabled;
        }

        if let Some(copy_network) = state.copy_network {
            self.general_state.copy_network = copy_network;
        }
    }

    /// Updates a connection with a new one.
    ///
    /// It uses the `uuid` to decide which connection to update.
    ///
    /// * `conn`: The connection to update.
    pub fn update_connection(&mut self, conn: Connection) -> Result<(), NetworkStateError> {
        let Some(old_conn) = self.get_connection_by_uuid_mut(conn.uuid) else {
            return Err(NetworkStateError::UnknownConnection(conn.uuid.to_string()));
        };
        *old_conn = conn;

        Ok(())
    }

    /// Removes a connection from the state.
    ///
    /// Additionally, it registers the connection to be removed when the changes are applied.
    ///
    /// * `uuid`: The UUID of the connection to remove.
    pub fn remove_connection(&mut self, uuid: Uuid) -> Result<(), NetworkStateError> {
        let Some(position) = self.connections.iter().position(|d| d.uuid == uuid) else {
            return Err(NetworkStateError::UnknownConnection(uuid.to_string()));
        };

        self.connections.remove(position);
        Ok(())
    }

    /// Adds a new device to the state.
    ///
    /// * `device`: The device to add.
    pub fn add_device(&mut self, device: Device) -> Result<(), NetworkStateError> {
        self.devices.push(device);
        Ok(())
    }

    /// Updates a device in the state.
    ///
    /// * `name`: The name of the device to update.
    /// * `device`: The new device information.
    pub fn update_device(&mut self, name: &str, device: Device) -> Result<(), NetworkStateError> {
        let Some(old_device) = self.get_device_mut(name) else {
            return Err(NetworkStateError::UnknownDevice(device.name.clone()));
        };
        *old_device = device;

        Ok(())
    }

    /// Removes a device from the state.
    ///
    /// * `name`: The name of the device to remove.
    pub fn remove_device(&mut self, name: &str) -> Result<(), NetworkStateError> {
        let Some(position) = self.devices.iter().position(|d| d.name == name) else {
            return Err(NetworkStateError::UnknownDevice(name.to_string()));
        };

        self.devices.remove(position);
        Ok(())
    }

    /// Adds a new access point to the state.
    ///
    /// * `ap`: The access point to add.
    pub fn add_access_point(&mut self, ap: AccessPoint) -> Result<(), NetworkStateError> {
        if let Some(position) = self
            .access_points
            .iter()
            .position(|a| a.hw_address == ap.hw_address)
        {
            self.access_points.remove(position);
        }
        self.access_points.push(ap);

        Ok(())
    }

    /// Removes an access point from the state.
    ///
    /// * `hw_address`: The hardware address of the access point to remove.
    pub fn remove_access_point(&mut self, hw_address: &str) -> Result<(), NetworkStateError> {
        let Some(position) = self
            .access_points
            .iter()
            .position(|a| a.hw_address == hw_address)
        else {
            return Err(NetworkStateError::UnknownAccessPoint(
                hw_address.to_string(),
            ));
        };

        self.access_points.remove(position);
        Ok(())
    }

    /// Sets a controller's ports.
    ///
    /// The ports that are not listed anymore are detached from the controller, but they are kept.
    /// Removing a connection is an explicit operation, and a port that is no longer part of a
    /// bond or a bridge is a perfectly usable stand-alone connection.
    ///
    /// This is the imperative counterpart of what [`Self::connection_collection_from`] does for a
    /// whole document. Unlike the resolver, it only looks at the connections that already exist:
    /// it does not create the missing ones and it does not validate the resulting graph.
    ///
    /// If the connection is not a controller, returns an error.
    ///
    /// * `controller`: controller to set ports on.
    /// * `ports`: list of port names (using the interface name or, failing that, the connection
    ///   ID).
    pub fn set_ports(
        &mut self,
        controller: &Connection,
        ports: Vec<String>,
    ) -> Result<(), NetworkStateError> {
        if !matches!(
            controller.config,
            ConnectionConfig::Bond(_) | ConnectionConfig::Bridge(_)
        ) {
            return Err(NetworkStateError::NotControllerConnection(
                controller.id.to_owned(),
            ));
        }

        let mut controlled = vec![];
        for port in ports {
            let connection = self
                .get_connection_by_interface(&port)
                .or_else(|| self.get_connection(&port))
                .ok_or(NetworkStateError::UnknownConnection(port))?;
            controlled.push(connection.uuid);
        }

        for conn in self.connections.iter_mut() {
            if controlled.contains(&conn.uuid) {
                conn.controller = Some(controller.uuid);
            } else if conn.controller == Some(controller.uuid) {
                tracing::info!(
                    "Controller {} does not contain {} anymore, detaching the port",
                    &controller.id,
                    &conn.id
                );
                conn.controller = None;
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::NetworkStateError;
    use uuid::Uuid;

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

    /// Finds a connection by ID in an API collection.
    fn find(collection: &NetworkConnectionsCollection, id: &str) -> NetworkConnection {
        collection
            .0
            .iter()
            .find(|c| c.id == id)
            .unwrap_or_else(|| panic!("{id} is missing from the collection"))
            .clone()
    }

    #[test]
    fn test_stacked_connections_are_all_exposed() {
        let collection = ConnectionCollection(crate::test_utils::stacked_connections());
        let exposed: NetworkConnectionsCollection = collection.try_into().unwrap();

        let mut ids: Vec<&str> = exposed.0.iter().map(|c| c.id.as_str()).collect();
        ids.sort_unstable();
        assert_eq!(ids, ["bond0", "br0", "br0.100", "eth0", "eth1"]);
    }

    #[test]
    fn test_stacked_connections_expose_their_controller() {
        let collection = ConnectionCollection(crate::test_utils::stacked_connections());
        let exposed: NetworkConnectionsCollection = collection.try_into().unwrap();

        assert_eq!(find(&exposed, "eth0").controller.as_deref(), Some("bond0"));
        assert_eq!(find(&exposed, "eth1").controller.as_deref(), Some("bond0"));
        assert_eq!(find(&exposed, "bond0").controller.as_deref(), Some("br0"));
        assert_eq!(find(&exposed, "br0").controller, None);
        assert_eq!(find(&exposed, "br0.100").controller, None);
    }

    #[test]
    fn test_a_controller_that_is_also_a_port_keeps_its_own_ports() {
        let collection = ConnectionCollection(crate::test_utils::stacked_connections());
        let exposed: NetworkConnectionsCollection = collection.try_into().unwrap();

        // bond0 is a port of br0 *and* a controller of eth0/eth1 at the same time.
        let bond0 = find(&exposed, "bond0");
        assert_eq!(bond0.controller.as_deref(), Some("br0"));
        assert_eq!(bond0.bond.unwrap().ports, vec!["eth0", "eth1"]);

        assert_eq!(find(&exposed, "br0").bridge.unwrap().ports, vec!["bond0"]);
    }

    #[test]
    fn test_ports_are_named_after_their_interface() {
        let mut connections = crate::test_utils::stacked_connections();
        // A connection read from NetworkManager usually has an ID that is not the
        // interface name.
        connections[0].id = "Wired connection 1".to_string();

        let collection = ConnectionCollection(connections);
        let exposed: NetworkConnectionsCollection = collection.try_into().unwrap();

        let bond0 = find(&exposed, "bond0");
        assert_eq!(bond0.bond.unwrap().ports, vec!["eth0", "eth1"]);
        assert_eq!(
            find(&exposed, "Wired connection 1").controller.as_deref(),
            Some("bond0")
        );
    }

    #[test]
    fn test_ports_fall_back_to_the_connection_id() {
        let mut connections = crate::test_utils::stacked_connections();
        // A connection bound by MAC address does not have an interface name.
        connections[0].id = "office-nic".to_string();
        connections[0].interface = None;

        let collection = ConnectionCollection(connections);
        let exposed: NetworkConnectionsCollection = collection.try_into().unwrap();

        let bond0 = find(&exposed, "bond0");
        assert_eq!(bond0.bond.unwrap().ports, vec!["office-nic", "eth1"]);
    }

    #[test]
    fn test_removed_connections_are_not_listed_as_ports() {
        let mut connections = crate::test_utils::stacked_connections();
        connections[1].remove();

        let collection = ConnectionCollection(connections);
        let exposed: NetworkConnectionsCollection = collection.try_into().unwrap();

        let bond0 = find(&exposed, "bond0");
        assert_eq!(bond0.bond.unwrap().ports, vec!["eth0"]);
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

    /// Builds a state holding the stacked connections from the test fixture.
    fn stacked_state() -> NetworkState {
        let mut state = NetworkState::default();
        for conn in crate::test_utils::stacked_connections() {
            state.add_connection(conn).unwrap();
        }
        state
    }

    /// Builds the API representation of the whole state, as a client would read it.
    fn exposed(state: &NetworkState) -> NetworkConnectionsCollection {
        ConnectionCollection(state.connections.clone())
            .try_into()
            .unwrap()
    }

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
    fn test_bridge_port_settings_are_exposed_and_survive_a_round_trip() {
        let state = stacked_state();
        let exposed = exposed(&state);

        let bond0 = find(&exposed, "bond0");
        assert_eq!(
            bond0.port,
            Some(PortSettings {
                bridge: Some(BridgePortSettings {
                    priority: Some(32),
                    path_cost: Some(100),
                })
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
    fn test_omitting_the_port_settings_leaves_them_alone() {
        let state = stacked_state();
        let mut update = find(&exposed(&state), "bond0");
        update.port = None;

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
    fn test_dropping_a_port_detaches_it_instead_of_removing_it() {
        let mut state = stacked_state();
        let mut connections = exposed(&state);

        let bond0 = connections.0.iter_mut().find(|c| c.id == "bond0").unwrap();
        bond0.bond.as_mut().unwrap().ports = vec!["eth0".to_string()];

        state
            .update_state(Config {
                connections: Some(connections),
                ..Default::default()
            })
            .unwrap();

        let bond0_uuid = state.get_connection("bond0").unwrap().uuid;
        let eth1 = state.get_connection("eth1").expect("eth1 was removed");
        assert_eq!(eth1.controller, None);
        assert!(!eth1.is_removed());
        assert_eq!(
            state.get_connection("eth0").unwrap().controller,
            Some(bond0_uuid)
        );
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
    fn test_a_port_missing_from_the_payload_is_taken_from_the_state() {
        let state = stacked_state();
        let bond0 = find(&exposed(&state), "bond0");
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
                ports: vec!["eth0".to_string()],
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
                    ports: vec!["eth0".to_string()],
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
                    ports: vec!["eth0".to_string()],
                    ..Default::default()
                }),
                ..Default::default()
            },
            NetworkConnection {
                id: "br0".to_string(),
                bridge: Some(BridgeSettings {
                    ports: vec!["eth0".to_string()],
                    ..Default::default()
                }),
                ..Default::default()
            },
        ]);

        let error = state.connection_collection_from(&collection).unwrap_err();
        assert!(matches!(error, NetworkStateError::PortAlreadyClaimed(..)));
    }

    #[test]
    fn test_a_controller_cannot_be_a_port_of_itself() {
        let state = NetworkState::default();
        let collection = NetworkConnectionsCollection(vec![NetworkConnection {
            id: "bond0".to_string(),
            interface: Some("bond0".to_string()),
            bond: Some(BondSettings {
                ports: vec!["bond0".to_string()],
                ..Default::default()
            }),
            ..Default::default()
        }]);

        let error = state.connection_collection_from(&collection).unwrap_err();
        assert!(matches!(error, NetworkStateError::SelfReferencedPort(id) if id == "bond0"));
    }

    #[test]
    fn test_a_loop_of_controllers_is_rejected() {
        let state = NetworkState::default();
        let collection = NetworkConnectionsCollection(vec![
            NetworkConnection {
                id: "bond0".to_string(),
                interface: Some("bond0".to_string()),
                bond: Some(BondSettings {
                    ports: vec!["br0".to_string()],
                    ..Default::default()
                }),
                ..Default::default()
            },
            NetworkConnection {
                id: "br0".to_string(),
                interface: Some("br0".to_string()),
                bridge: Some(BridgeSettings {
                    ports: vec!["bond0".to_string()],
                    ..Default::default()
                }),
                ..Default::default()
            },
        ]);

        let error = state.connection_collection_from(&collection).unwrap_err();
        assert!(matches!(error, NetworkStateError::ControllerCycle(_)));
    }

    /// The network section of `autoyast-examples/04-full.xml` once imported.
    ///
    /// ```text
    /// eth0 + eth1  ->  bond0  ->  br0  ->  br0.100 (VLAN)
    /// ```
    const STACKED_PROFILE: &str = r#"[
      { "id": "eth0", "interface": "eth0",
        "method4": "disabled", "method6": "disabled", "mtu": 9000 },
      { "id": "eth1", "interface": "eth1",
        "method4": "disabled", "method6": "disabled" },
      { "id": "bond0", "interface": "bond0",
        "method4": "disabled", "method6": "disabled",
        "bond": { "mode": "802.3ad", "options": "miimon=100 lacp_rate=fast",
                  "ports": ["eth0", "eth1"] } },
      { "id": "br0", "interface": "br0", "method4": "manual",
        "addresses": ["192.168.1.100/24"],
        "bridge": { "stp": true, "forwardDelay": 4, "maxAge": 20, "ports": ["bond0"] } },
      { "id": "br0.100", "interface": "br0.100", "method4": "manual",
        "addresses": ["10.100.0.10/24"],
        "vlan": { "id": 100, "parent": "br0" } }
    ]"#;

    #[test]
    fn test_a_stacked_profile_is_applied_and_reported_back() {
        let connections: Vec<NetworkConnection> = serde_json::from_str(STACKED_PROFILE).unwrap();
        let mut state = NetworkState::default();
        state
            .update_state(Config {
                connections: Some(NetworkConnectionsCollection(connections)),
                ..Default::default()
            })
            .unwrap();

        let reported = exposed(&state);
        let mut ids: Vec<&str> = reported.0.iter().map(|c| c.id.as_str()).collect();
        ids.sort_unstable();
        assert_eq!(ids, ["bond0", "br0", "br0.100", "eth0", "eth1"]);

        assert_eq!(find(&reported, "eth0").controller.as_deref(), Some("bond0"));
        assert_eq!(find(&reported, "eth1").controller.as_deref(), Some("bond0"));

        // The bond is a port of the bridge and a controller of the two NICs at once.
        let bond0 = find(&reported, "bond0");
        assert_eq!(bond0.controller.as_deref(), Some("br0"));
        assert_eq!(bond0.bond.as_ref().unwrap().ports, vec!["eth0", "eth1"]);
        assert_eq!(bond0.bond.as_ref().unwrap().mode, "802.3ad");

        let bridge = find(&reported, "br0").bridge.unwrap();
        assert_eq!(bridge.ports, vec!["bond0"]);
        assert_eq!(bridge.max_age, Some(20));

        assert_eq!(find(&reported, "br0.100").vlan.unwrap().parent, "br0");
    }

    #[test]
    fn test_editing_a_stacked_profile_keeps_the_settings_of_the_ports() {
        let connections: Vec<NetworkConnection> = serde_json::from_str(STACKED_PROFILE).unwrap();
        let mut state = NetworkState::default();
        state
            .update_state(Config {
                connections: Some(NetworkConnectionsCollection(connections)),
                ..Default::default()
            })
            .unwrap();

        // What the web UI does: read the whole config, change one connection and write it back.
        let mut reported = exposed(&state);
        let br0 = reported.0.iter_mut().find(|c| c.id == "br0").unwrap();
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
                    ports: vec!["eth0".to_string()],
                    ..Default::default()
                }),
                ..Default::default()
            },
        ]);

        let error = state.connection_collection_from(&collection).unwrap_err();
        assert!(matches!(error, NetworkStateError::RemovedPort(port, _) if port == "eth0"));
    }
}

pub const NOT_COPY_NETWORK_PATH: &str = "/run/agama/not_copy_network";

/// General network state and settings.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct GeneralState {
    pub hostname: String,
    pub connectivity: ConnectivityState,
    pub copy_network: bool,
    pub wireless_enabled: bool,
    pub networking_enabled: bool, // pub network_state: NMSTATE
}

/// Represents a known network connection.
#[serde_as]
#[skip_serializing_none]
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub id: String,
    pub uuid: Uuid,
    #[schemars(with = "Option<String>")]
    pub mac_address: Option<MacAddr6>,
    #[serde_as(as = "DisplayFromStr")]
    #[schemars(with = "String")]
    pub custom_mac_address: MacAddress,
    pub firewall_zone: Option<String>,
    pub mtu: u32,
    pub ip_config: IpConfig,
    pub status: Status,
    pub interface: Option<String>,
    pub controller: Option<Uuid>,
    pub port_config: PortConfig,
    pub match_config: MatchConfig,
    pub config: ConnectionConfig,
    pub ieee_8021x_config: Option<IEEE8021XConfig>,
    pub autoconnect: bool,
    pub state: ConnectionState,
    pub persistent: bool,
    pub flags: u32,
}

impl Connection {
    /// Creates a new connection with the given ID and device type.
    ///
    /// * `id`: The connection identifier.
    /// * `device_type`: The type of the device.
    pub fn new(id: String, device_type: DeviceType) -> Self {
        let config = match device_type {
            DeviceType::Ethernet => ConnectionConfig::Ethernet,
            DeviceType::Wireless => ConnectionConfig::Wireless(Default::default()),
            DeviceType::Loopback => ConnectionConfig::Loopback,
            DeviceType::Dummy => ConnectionConfig::Dummy,
            DeviceType::Bond => ConnectionConfig::Bond(Default::default()),
            DeviceType::Vlan => ConnectionConfig::Vlan(Default::default()),
            DeviceType::Bridge => ConnectionConfig::Bridge(Default::default()),
        };
        Self {
            id,
            config,
            ..Default::default()
        }
    }

    pub fn remove(&mut self) {
        self.status = Status::Removed;
    }

    pub fn is_removed(&self) -> bool {
        self.status == Status::Removed
    }

    pub fn is_up(&self) -> bool {
        self.status == Status::Up
    }

    pub fn is_down(&self) -> bool {
        self.status == Status::Down
    }

    pub fn set_up(&mut self) {
        self.status = Status::Up
    }

    pub fn keep_status(&mut self) {
        self.status = Status::Keep
    }

    pub fn set_down(&mut self) {
        self.status = Status::Down
    }

    /// Determines whether it is a loopback interface.
    pub fn is_loopback(&self) -> bool {
        matches!(self.config, ConnectionConfig::Loopback)
    }

    pub fn is_ethernet(&self) -> bool {
        matches!(self.config, ConnectionConfig::Loopback)
            || matches!(self.config, ConnectionConfig::Ethernet)
            || matches!(self.config, ConnectionConfig::Dummy)
            || matches!(self.config, ConnectionConfig::Bond(_))
            || matches!(self.config, ConnectionConfig::Vlan(_))
            || matches!(self.config, ConnectionConfig::Bridge(_))
    }

    /// Applies the settings coming from the HTTP API.
    ///
    /// The HTTP API does not model every setting of a connection, and the ones it does not know
    /// about are left untouched. Otherwise, editing a connection over the API would silently drop
    /// the settings that were read from NetworkManager or imported from an AutoYaST profile.
    ///
    /// Note that the controller/port relationships are not handled here, as they cannot be
    /// resolved without looking at the other connections. See [`crate::model::ports`].
    ///
    /// * `conn`: settings to apply.
    pub fn apply_settings(&mut self, conn: &NetworkConnection) -> Result<(), NetworkStateError> {
        self.ip_config.method4 = conn.method4;
        self.ip_config.method6 = conn.method6;

        if let Some(status) = conn.status {
            self.status = status;
        }

        if let Some(autoconnect) = conn.autoconnect {
            self.autoconnect = autoconnect;
        }

        if let Some(persistent) = conn.persistent {
            self.persistent = persistent;
        }

        if let Some(ignore_auto_dns) = conn.ignore_auto_dns {
            self.ip_config.ignore_auto_dns = ignore_auto_dns;
        }

        // A missing section means "do not touch the device settings", not "turn this into an
        // Ethernet connection". Changing the type of a connection requires removing it and
        // creating a new one.
        if let Some(vlan_config) = &conn.vlan {
            self.config = VlanConfig::try_from(vlan_config.clone())?.into();
        }
        if let Some(wireless_config) = &conn.wireless {
            self.config = WirelessConfig::try_from(wireless_config.clone())?.into();
        }
        if let Some(bond_config) = &conn.bond {
            self.config = BondConfig::try_from(bond_config.clone())?.into();
        }
        if let Some(bridge_config) = &conn.bridge {
            self.config = BridgeConfig::try_from(bridge_config.clone())?.into();
        }

        if let Some(ieee_8021x_config) = &conn.ieee_8021x {
            self.ieee_8021x_config = Some(IEEE8021XConfig::try_from(ieee_8021x_config.clone())?);
        }

        if let Some(mac) = &conn.mac_address {
            self.mac_address = MacAddr6::from_str(mac).ok();
        }

        if let Some(mac) = &conn.custom_mac_address {
            self.custom_mac_address = MacAddress::from_str(mac)
                .map_err(|_| NetworkStateError::InvalidMacAddress(mac.to_string()))?;
        }

        self.ip_config.addresses = conn.addresses.clone();
        self.ip_config.nameservers = conn.nameservers.clone();
        self.ip_config.dns_searchlist = conn.dns_searchlist.clone();
        self.ip_config.gateway4 = conn.gateway4;
        self.ip_config.gateway6 = conn.gateway6;
        self.interface = conn.interface.clone();
        self.mtu = conn.mtu;

        if let Some(match_settings) = &conn.match_settings {
            self.match_config = MatchConfig {
                driver: match_settings.driver.clone(),
                interface: match_settings.interface.clone(),
                path: match_settings.path.clone(),
                kernel: match_settings.kernel.clone(),
            };
        }

        if let Some(port_settings) = &conn.port {
            self.port_config = port_settings.clone().into();
        }

        Ok(())
    }

    /// Determines whether the connection is bound to a specific interface or MAC address.
    pub fn is_bound(&self) -> bool {
        !self.interface.as_deref().unwrap_or("").is_empty() || self.mac_address.is_some()
    }

    /// Determines whether the connection is compatible with the given device name and MAC address.
    pub fn is_compatible(&self, device_name: &str, device_mac: &MacAddress) -> bool {
        if let Some(interface) = &self.interface {
            if !interface.is_empty() && interface != device_name {
                return false;
            }
        }
        if let Some(mac) = self.mac_address {
            if let MacAddress::MacAddress(d_mac) = device_mac {
                if mac != *d_mac {
                    return false;
                }
            } else {
                return false;
            }
        }
        true
    }

    /// Determines whether the connection matches the given device name or MAC address.
    pub fn matches_device(&self, device_name: &str, device_mac: &MacAddress) -> bool {
        if let Some(interface) = &self.interface {
            if !interface.is_empty() && interface == device_name {
                return true;
            }
        }
        if let Some(mac) = self.mac_address {
            if let MacAddress::MacAddress(d_mac) = device_mac {
                if mac == *d_mac {
                    return true;
                }
            }
        }
        false
    }
}

impl Default for Connection {
    fn default() -> Self {
        Self {
            id: Default::default(),
            uuid: Uuid::new_v4(),
            mac_address: Default::default(),
            custom_mac_address: Default::default(),
            firewall_zone: Default::default(),
            mtu: Default::default(),
            ip_config: Default::default(),
            status: Default::default(),
            interface: Default::default(),
            controller: Default::default(),
            port_config: Default::default(),
            match_config: Default::default(),
            config: Default::default(),
            ieee_8021x_config: Default::default(),
            autoconnect: true,
            state: Default::default(),
            persistent: true,
            flags: Default::default(),
        }
    }
}

impl TryFrom<NetworkConnection> for Connection {
    type Error = NetworkStateError;

    fn try_from(conn: NetworkConnection) -> Result<Self, Self::Error> {
        let mut connection = Connection::new(conn.id.clone(), conn.device_type());
        connection.apply_settings(&conn)?;

        Ok(connection)
    }
}

impl TryFrom<Connection> for NetworkConnection {
    type Error = NetworkStateError;

    fn try_from(conn: Connection) -> Result<Self, Self::Error> {
        let id = conn.clone().id;
        let custom_mac = conn.custom_mac_address.to_string();
        let method4 = conn.ip_config.method4;
        let method6 = conn.ip_config.method6;
        let mac_address = conn.mac_address.map(|mac| mac.to_string());
        let custom_mac_address = (!custom_mac.is_empty()).then_some(custom_mac);
        let nameservers = conn.ip_config.nameservers;
        let dns_searchlist = conn.ip_config.dns_searchlist;
        let ignore_auto_dns = Some(conn.ip_config.ignore_auto_dns);
        let addresses = conn.ip_config.addresses;
        let gateway4 = conn.ip_config.gateway4;
        let gateway6 = conn.ip_config.gateway6;
        let interface = conn.interface;
        let status = Some(conn.status);
        let mtu = conn.mtu;
        let ieee_8021x: Option<IEEE8021XSettings> = conn
            .ieee_8021x_config
            .and_then(|x| IEEE8021XSettings::try_from(x).ok());
        let autoconnect = Some(conn.autoconnect);
        let persistent = Some(conn.persistent);

        let match_settings = (!conn.match_config.is_empty()).then(|| MatchSettings {
            driver: conn.match_config.driver.clone(),
            interface: conn.match_config.interface.clone(),
            path: conn.match_config.path.clone(),
            kernel: conn.match_config.kernel.clone(),
        });

        let port_settings = PortSettings::from(&conn.port_config);
        let port = (!port_settings.is_empty()).then_some(port_settings);

        let mut connection = NetworkConnection {
            id,
            status,
            method4,
            method6,
            gateway4,
            gateway6,
            nameservers,
            dns_searchlist,
            ignore_auto_dns,
            custom_mac_address,
            mac_address,
            interface,
            addresses,
            mtu,
            ieee_8021x,
            autoconnect,
            persistent,
            match_settings,
            port,
            ..Default::default()
        };

        match conn.config {
            ConnectionConfig::Wireless(config) => {
                connection.wireless = Some(WirelessSettings::try_from(config)?);
            }
            ConnectionConfig::Bond(config) => {
                connection.bond = Some(BondSettings::try_from(config)?);
            }
            ConnectionConfig::Bridge(config) => {
                connection.bridge = Some(BridgeSettings::try_from(config)?);
            }
            ConnectionConfig::Vlan(config) => {
                connection.vlan = Some(VlanSettings::try_from(config)?);
            }
            _ => {}
        }

        Ok(connection)
    }
}

#[derive(Default, Debug, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub enum ConnectionConfig {
    #[default]
    Ethernet,
    Wireless(WirelessConfig),
    Loopback,
    Dummy,
    Bond(BondConfig),
    Vlan(VlanConfig),
    Bridge(BridgeConfig),
    Infiniband(InfinibandConfig),
    Tun(TunConfig),
    OvsBridge(OvsBridgeConfig),
    OvsPort(OvsPortConfig),
    OvsInterface(OvsInterfaceConfig),
}

#[derive(Default, Debug, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub enum PortConfig {
    #[default]
    None,
    Bridge(BridgePortConfig),
    OvsBridge(OvsBridgePortConfig),
}

impl From<BridgeConfig> for ConnectionConfig {
    fn from(value: BridgeConfig) -> Self {
        Self::Bridge(value)
    }
}

impl From<BondConfig> for ConnectionConfig {
    fn from(value: BondConfig) -> Self {
        Self::Bond(value)
    }
}

impl From<VlanConfig> for ConnectionConfig {
    fn from(value: VlanConfig) -> Self {
        Self::Vlan(value)
    }
}

impl From<WirelessConfig> for ConnectionConfig {
    fn from(value: WirelessConfig) -> Self {
        Self::Wireless(value)
    }
}

#[skip_serializing_none]
#[derive(Debug, Default, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub struct MatchConfig {
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub driver: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub interface: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub path: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub kernel: Vec<String>,
}

impl MatchConfig {
    pub fn is_empty(&self) -> bool {
        self.driver.is_empty()
            && self.interface.is_empty()
            && self.path.is_empty()
            && self.kernel.is_empty()
    }
}

#[derive(Debug, Default, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub enum VlanProtocol {
    #[default]
    IEEE802_1Q,
    IEEE802_1ad,
}

#[derive(Debug, Error)]
#[error("Invalid VlanProtocol: {0}")]
pub struct InvalidVlanProtocol(String);

impl std::str::FromStr for VlanProtocol {
    type Err = InvalidVlanProtocol;

    fn from_str(s: &str) -> Result<VlanProtocol, Self::Err> {
        match s {
            "802.1Q" => Ok(VlanProtocol::IEEE802_1Q),
            "802.1ad" => Ok(VlanProtocol::IEEE802_1ad),
            _ => Err(InvalidVlanProtocol(s.to_string())),
        }
    }
}

impl fmt::Display for VlanProtocol {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            VlanProtocol::IEEE802_1Q => "802.1Q",
            VlanProtocol::IEEE802_1ad => "802.1ad",
        };
        write!(f, "{}", name)
    }
}

#[derive(Debug, Default, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub struct VlanConfig {
    pub parent: String,
    pub id: u32,
    pub protocol: VlanProtocol,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flags: Option<Vec<VlanFlag>>,
}

#[serde_as]
#[derive(Debug, Default, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct WirelessConfig {
    pub mode: WirelessMode,
    #[serde_as(as = "DisplayFromStr")]
    #[schemars(with = "String")]
    pub ssid: SSID,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    pub security: SecurityProtocol,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub band: Option<WirelessBand>,
    pub channel: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schemars(with = "Option<String>")]
    pub bssid: Option<macaddr::MacAddr6>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wep_security: Option<WEPSecurity>,
    pub hidden: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub group_algorithms: Vec<GroupAlgorithm>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub pairwise_algorithms: Vec<PairwiseAlgorithm>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub wpa_protocol_versions: Vec<WPAProtocolVersion>,
    pub pmf: i32,
}

impl TryFrom<ConnectionConfig> for WirelessConfig {
    type Error = NetworkStateError;

    fn try_from(value: ConnectionConfig) -> Result<Self, Self::Error> {
        match value {
            ConnectionConfig::Wireless(config) => Ok(config),
            _ => Err(NetworkStateError::UnexpectedConfiguration),
        }
    }
}

impl TryFrom<VlanSettings> for VlanConfig {
    type Error = NetworkStateError;

    fn try_from(settings: VlanSettings) -> Result<Self, Self::Error> {
        let id = settings.id;
        let parent = settings.parent;

        let mut config = VlanConfig {
            id,
            parent,
            flags: settings.flags,
            ..Default::default()
        };

        if let Some(protocol) = &settings.protocol {
            config.protocol = VlanProtocol::from_str(protocol)
                .map_err(|_| NetworkStateError::InvalidVlanProtocol(protocol.to_string()))?;
        }

        Ok(config)
    }
}

impl TryFrom<VlanConfig> for VlanSettings {
    type Error = NetworkStateError;

    fn try_from(vlan: VlanConfig) -> Result<Self, Self::Error> {
        Ok(VlanSettings {
            id: vlan.id,
            parent: vlan.parent,
            protocol: Some(vlan.protocol.to_string()),
            flags: vlan.flags,
        })
    }
}

impl TryFrom<WirelessSettings> for WirelessConfig {
    type Error = NetworkStateError;

    fn try_from(settings: WirelessSettings) -> Result<Self, Self::Error> {
        let ssid = SSID(settings.ssid.as_bytes().into());
        let mode = WirelessMode::try_from(settings.mode.as_str())?;
        let security = SecurityProtocol::try_from(settings.security.as_str())?;
        let band = if let Some(band) = &settings.band {
            Some(
                WirelessBand::try_from(band.as_str())
                    .map_err(|_| NetworkStateError::InvalidWirelessBand(band.to_string()))?,
            )
        } else {
            None
        };
        let bssid = if let Some(bssid) = &settings.bssid {
            Some(
                macaddr::MacAddr6::from_str(bssid)
                    .map_err(|_| NetworkStateError::InvalidBssid(bssid.to_string()))?,
            )
        } else {
            None
        };
        let group_algorithms = settings
            .group_algorithms
            .iter()
            .map(|x| {
                GroupAlgorithm::from_str(x)
                    .map_err(|_| NetworkStateError::InvalidGroupAlgorithm(x.to_string()))
            })
            .collect::<Result<Vec<GroupAlgorithm>, NetworkStateError>>()?;
        let pairwise_algorithms = settings
            .pairwise_algorithms
            .iter()
            .map(|x| {
                PairwiseAlgorithm::from_str(x)
                    .map_err(|_| NetworkStateError::InvalidGroupAlgorithm(x.to_string()))
            })
            .collect::<Result<Vec<PairwiseAlgorithm>, NetworkStateError>>()?;
        let wpa_protocol_versions = settings
            .wpa_protocol_versions
            .iter()
            .map(|x| {
                WPAProtocolVersion::from_str(x)
                    .map_err(|_| NetworkStateError::InvalidGroupAlgorithm(x.to_string()))
            })
            .collect::<Result<Vec<WPAProtocolVersion>, NetworkStateError>>()?;

        Ok(WirelessConfig {
            ssid,
            mode,
            security,
            password: settings.password,
            band,
            channel: settings.channel,
            bssid,
            hidden: settings.hidden,
            group_algorithms,
            pairwise_algorithms,
            wpa_protocol_versions,
            pmf: settings.pmf,
            ..Default::default()
        })
    }
}

impl TryFrom<WirelessConfig> for WirelessSettings {
    type Error = NetworkStateError;

    fn try_from(wireless: WirelessConfig) -> Result<Self, Self::Error> {
        let band = wireless.band.map(|x| x.to_string());
        let bssid = wireless.bssid.map(|x| x.to_string());
        let group_algorithms = wireless
            .group_algorithms
            .iter()
            .map(|x| x.to_string())
            .collect::<Vec<String>>();
        let pairwise_algorithms = wireless
            .pairwise_algorithms
            .iter()
            .map(|x| x.to_string())
            .collect::<Vec<String>>();
        let wpa_protocol_versions = wireless
            .wpa_protocol_versions
            .iter()
            .map(|x| x.to_string())
            .collect::<Vec<String>>();

        Ok(WirelessSettings {
            ssid: wireless.ssid.to_string(),
            mode: wireless.mode.to_string(),
            security: wireless.security.to_string(),
            password: wireless.password,
            band,
            channel: wireless.channel,
            bssid,
            hidden: wireless.hidden,
            group_algorithms,
            pairwise_algorithms,
            wpa_protocol_versions,
            pmf: wireless.pmf,
        })
    }
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Deserialize, Serialize, JsonSchema)]
pub enum WirelessMode {
    Unknown = 0,
    AdHoc = 1,
    #[default]
    Infra = 2,
    AP = 3,
    Mesh = 4,
}

impl TryFrom<&str> for WirelessMode {
    type Error = NetworkStateError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "unknown" => Ok(WirelessMode::Unknown),
            "adhoc" => Ok(WirelessMode::AdHoc),
            "infrastructure" => Ok(WirelessMode::Infra),
            "ap" => Ok(WirelessMode::AP),
            "mesh" => Ok(WirelessMode::Mesh),
            _ => Err(NetworkStateError::InvalidWirelessMode(value.to_string())),
        }
    }
}

impl fmt::Display for WirelessMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            WirelessMode::Unknown => "unknown",
            WirelessMode::AdHoc => "adhoc",
            WirelessMode::Infra => "infrastructure",
            WirelessMode::AP => "ap",
            WirelessMode::Mesh => "mesh",
        };
        write!(f, "{}", name)
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Deserialize, Serialize, JsonSchema)]
pub enum SecurityProtocol {
    #[default]
    WEP, // No encryption or WEP ("none")
    OWE,            // Opportunistic Wireless Encryption ("owe")
    DynamicWEP,     // Dynamic WEP ("ieee8021x")
    WPA2,           // WPA2 + WPA3 personal ("wpa-psk")
    WPA3Personal,   // WPA3 personal only ("sae")
    WPA2Enterprise, // WPA2 + WPA3 Enterprise ("wpa-eap")
    WPA3Only,       // WPA3 only ("wpa-eap-suite-b-192")
}

impl fmt::Display for SecurityProtocol {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match &self {
            SecurityProtocol::WEP => "none",
            SecurityProtocol::OWE => "owe",
            SecurityProtocol::DynamicWEP => "ieee8021x",
            SecurityProtocol::WPA2 => "wpa-psk",
            SecurityProtocol::WPA3Personal => "sae",
            SecurityProtocol::WPA2Enterprise => "wpa-eap",
            SecurityProtocol::WPA3Only => "wpa-eap-suite-b-192",
        };
        write!(f, "{}", value)
    }
}

impl TryFrom<&str> for SecurityProtocol {
    type Error = NetworkStateError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "none" => Ok(SecurityProtocol::WEP),
            "owe" => Ok(SecurityProtocol::OWE),
            "ieee8021x" => Ok(SecurityProtocol::DynamicWEP),
            "wpa-psk" => Ok(SecurityProtocol::WPA2),
            "sae" => Ok(SecurityProtocol::WPA3Personal),
            "wpa-eap" => Ok(SecurityProtocol::WPA2Enterprise),
            "wpa-eap-suite-b-192" => Ok(SecurityProtocol::WPA3Only),
            _ => Err(NetworkStateError::InvalidSecurityProtocol(
                value.to_string(),
            )),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Deserialize, Serialize, JsonSchema)]
pub enum GroupAlgorithm {
    Wep40,
    Wep104,
    Tkip,
    Ccmp,
}

#[derive(Debug, Error)]
#[error("Invalid group algorithm: {0}")]
pub struct InvalidGroupAlgorithm(String);

impl FromStr for GroupAlgorithm {
    type Err = InvalidGroupAlgorithm;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "wep40" => Ok(GroupAlgorithm::Wep40),
            "wep104" => Ok(GroupAlgorithm::Wep104),
            "tkip" => Ok(GroupAlgorithm::Tkip),
            "ccmp" => Ok(GroupAlgorithm::Ccmp),
            _ => Err(InvalidGroupAlgorithm(value.to_string())),
        }
    }
}

impl fmt::Display for GroupAlgorithm {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            GroupAlgorithm::Wep40 => "wep40",
            GroupAlgorithm::Wep104 => "wep104",
            GroupAlgorithm::Tkip => "tkip",
            GroupAlgorithm::Ccmp => "ccmp",
        };
        write!(f, "{}", name)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Deserialize, Serialize, JsonSchema)]
pub enum PairwiseAlgorithm {
    Tkip,
    Ccmp,
}

#[derive(Debug, Error)]
#[error("Invalid pairwise algorithm: {0}")]
pub struct InvalidPairwiseAlgorithm(String);

impl FromStr for PairwiseAlgorithm {
    type Err = InvalidPairwiseAlgorithm;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "tkip" => Ok(PairwiseAlgorithm::Tkip),
            "ccmp" => Ok(PairwiseAlgorithm::Ccmp),
            _ => Err(InvalidPairwiseAlgorithm(value.to_string())),
        }
    }
}

impl fmt::Display for PairwiseAlgorithm {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            PairwiseAlgorithm::Tkip => "tkip",
            PairwiseAlgorithm::Ccmp => "ccmp",
        };
        write!(f, "{}", name)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Deserialize, Serialize, JsonSchema)]
pub enum WPAProtocolVersion {
    Wpa,
    Rsn,
}

#[derive(Debug, Error)]
#[error("Invalid WPA protocol version: {0}")]
pub struct InvalidWPAProtocolVersion(String);

impl FromStr for WPAProtocolVersion {
    type Err = InvalidWPAProtocolVersion;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "wpa" => Ok(WPAProtocolVersion::Wpa),
            "rsn" => Ok(WPAProtocolVersion::Rsn),
            _ => Err(InvalidWPAProtocolVersion(value.to_string())),
        }
    }
}

impl fmt::Display for WPAProtocolVersion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            WPAProtocolVersion::Wpa => "wpa",
            WPAProtocolVersion::Rsn => "rsn",
        };
        write!(f, "{}", name)
    }
}

#[derive(Debug, Default, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub struct WEPSecurity {
    pub auth_alg: WEPAuthAlg,
    pub wep_key_type: WEPKeyType,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub keys: Vec<String>,
    pub wep_key_index: u32,
}

#[derive(Debug, Default, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub enum WEPKeyType {
    #[default]
    Unknown = 0,
    Key = 1,
    Passphrase = 2,
}

impl TryFrom<u32> for WEPKeyType {
    type Error = NetworkStateError;

    fn try_from(value: u32) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(WEPKeyType::Unknown),
            1 => Ok(WEPKeyType::Key),
            2 => Ok(WEPKeyType::Passphrase),
            _ => Err(NetworkStateError::InvalidWEPKeyType(value)),
        }
    }
}

#[derive(Debug, Default, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub enum WEPAuthAlg {
    #[default]
    Unset,
    Open,
    Shared,
    Leap,
}

impl TryFrom<&str> for WEPAuthAlg {
    type Error = NetworkStateError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "open" => Ok(WEPAuthAlg::Open),
            "shared" => Ok(WEPAuthAlg::Shared),
            "leap" => Ok(WEPAuthAlg::Leap),
            "" => Ok(WEPAuthAlg::Unset),
            _ => Err(NetworkStateError::InvalidWEPAuthAlg(value.to_string())),
        }
    }
}

impl fmt::Display for WEPAuthAlg {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            WEPAuthAlg::Open => "open",
            WEPAuthAlg::Shared => "shared",
            WEPAuthAlg::Leap => "shared",
            WEPAuthAlg::Unset => "",
        };
        write!(f, "{}", name)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Deserialize, Serialize, JsonSchema)]
pub enum WirelessBand {
    A,  // 5GHz
    BG, // 2.4GHz
}

impl fmt::Display for WirelessBand {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match &self {
            WirelessBand::A => "a",
            WirelessBand::BG => "bg",
        };
        write!(f, "{}", value)
    }
}

impl TryFrom<&str> for WirelessBand {
    type Error = NetworkStateError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "a" => Ok(WirelessBand::A),
            "bg" => Ok(WirelessBand::BG),
            _ => Err(NetworkStateError::InvalidWirelessBand(value.to_string())),
        }
    }
}

#[derive(Debug, Default, Clone, PartialEq, Deserialize, Serialize, JsonSchema)]
pub struct BondOptions(pub HashMap<String, String>);

impl TryFrom<&str> for BondOptions {
    type Error = NetworkStateError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        let mut options = HashMap::new();

        for opt in value.split_whitespace() {
            let (key, value) = opt
                .trim()
                .split_once('=')
                .ok_or(NetworkStateError::InvalidBondOptions)?;
            options.insert(key.to_string(), value.to_string());
        }

        Ok(BondOptions(options))
    }
}

impl fmt::Display for BondOptions {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let opts = &self
            .0
            .iter()
            .map(|(key, value)| format!("{key}={value}"))
            .collect::<Vec<_>>();

        write!(f, "{}", opts.join(" "))
    }
}

#[derive(Debug, Default, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub struct BondConfig {
    pub mode: BondMode,
    pub options: BondOptions,
}

#[derive(Clone, Debug, Default)]
pub struct ConnectionCollection(pub Vec<Connection>);

impl ConnectionCollection {
    /// Name used to refer to a connection from a `ports` list or from a `controller` field.
    ///
    /// It is the interface name when the connection is bound to one, and the connection ID
    /// otherwise (e.g., when the connection is bound by MAC address or by `match` settings).
    pub fn reference_name(conn: &Connection) -> &str {
        conn.interface.as_deref().unwrap_or(&conn.id)
    }

    /// Returns the names of the ports of the given controller.
    ///
    /// Connections that are about to be removed are left out, as listing them would bring
    /// them back on the next write.
    ///
    /// * `uuid`: controller UUID.
    pub fn ports_for(&self, uuid: Uuid) -> Vec<String> {
        self.iter()
            .filter(|c| c.controller == Some(uuid) && !c.is_removed())
            .map(|c| Self::reference_name(c).to_string())
            .collect()
    }

    /// Returns the name of the controller of the given connection, if any.
    ///
    /// * `conn`: connection to find the controller of.
    fn controller_name(&self, conn: &Connection) -> Option<String> {
        if conn.is_removed() {
            return None;
        }

        let uuid = conn.controller?;
        let Some(controller) = self.iter().find(|c| c.uuid == uuid) else {
            tracing::warn!(
                "Connection {} refers to the unknown controller {}",
                conn.id,
                uuid
            );
            return None;
        };

        Some(Self::reference_name(controller).to_string())
    }

    /// Converts a connection to its HTTP API representation.
    ///
    /// Unlike [`NetworkConnection::try_from`], it fills in the relationships that can only be
    /// resolved with the rest of the collection at hand: the controller's list of ports and
    /// the port's reference to its controller.
    ///
    /// * `conn`: connection to convert.
    fn to_api(&self, conn: &Connection) -> Result<NetworkConnection, NetworkStateError> {
        let mut api_conn = NetworkConnection::try_from(conn.clone())?;

        if let Some(ref mut bond) = api_conn.bond {
            bond.ports = self.ports_for(conn.uuid);
        }
        if let Some(ref mut bridge) = api_conn.bridge {
            bridge.ports = self.ports_for(conn.uuid);
        }
        api_conn.controller = self.controller_name(conn);

        Ok(api_conn)
    }

    fn iter(&self) -> impl Iterator<Item = &Connection> {
        self.0.iter()
    }
}

impl TryFrom<ConnectionCollection> for NetworkConnectionsCollection {
    type Error = NetworkStateError;

    fn try_from(collection: ConnectionCollection) -> Result<Self, Self::Error> {
        let network_connections = collection
            .iter()
            .map(|c| collection.to_api(c))
            .collect::<Result<Vec<_>, _>>()?;

        Ok(NetworkConnectionsCollection(network_connections))
    }
}

impl TryFrom<ConnectionCollection> for NetworkConnectionsWithStateCollection {
    type Error = NetworkStateError;

    fn try_from(collection: ConnectionCollection) -> Result<Self, Self::Error> {
        let network_connections = collection
            .iter()
            .map(|c| {
                Ok(NetworkConnectionWithState {
                    connection: collection.to_api(c)?,
                    state: c.state,
                })
            })
            .collect::<Result<Vec<_>, NetworkStateError>>()?;

        Ok(NetworkConnectionsWithStateCollection(network_connections))
    }
}

impl TryFrom<NetworkConnectionsCollection> for ConnectionCollection {
    type Error = NetworkStateError;

    /// Builds the collection without any previous knowledge about the system.
    ///
    /// Use [`NetworkState::connection_collection_from`] to take the existing connections into
    /// account, which is what any code that updates the network state should do.
    fn try_from(collection: NetworkConnectionsCollection) -> Result<Self, Self::Error> {
        PortResolver::new(&[]).resolve(&collection)
    }
}

impl TryFrom<GeneralState> for StateSettings {
    type Error = NetworkStateError;

    fn try_from(state: GeneralState) -> Result<Self, Self::Error> {
        Ok(StateSettings {
            connectivity: Some(state.connectivity),
            copy_network: Some(state.copy_network),
            wireless_enabled: Some(state.wireless_enabled),
            networking_enabled: Some(state.networking_enabled),
        })
    }
}

impl TryFrom<NetworkState> for Config {
    type Error = NetworkStateError;

    fn try_from(state: NetworkState) -> Result<Self, Self::Error> {
        let connections: NetworkConnectionsCollection =
            ConnectionCollection(state.connections).try_into()?;

        Ok(Config {
            connections: Some(connections),
            state: Some(state.general_state.try_into()?),
        })
    }
}

impl TryFrom<NetworkState> for SystemInfo {
    type Error = NetworkStateError;

    fn try_from(state: NetworkState) -> Result<Self, Self::Error> {
        let connections: NetworkConnectionsWithStateCollection =
            ConnectionCollection(state.connections).try_into()?;

        Ok(SystemInfo {
            access_points: state.access_points,
            connections,
            devices: state.devices,
            state: state.general_state.try_into()?,
        })
    }
}

impl TryFrom<NetworkState> for Proposal {
    type Error = NetworkStateError;

    fn try_from(state: NetworkState) -> Result<Self, Self::Error> {
        let connections: NetworkConnectionsCollection =
            ConnectionCollection(state.connections).try_into()?;

        Ok(Proposal {
            connections,
            state: state.general_state.try_into()?,
        })
    }
}

impl TryFrom<ConnectionConfig> for BondConfig {
    type Error = NetworkStateError;

    fn try_from(value: ConnectionConfig) -> Result<Self, Self::Error> {
        match value {
            ConnectionConfig::Bond(config) => Ok(config),
            _ => Err(NetworkStateError::UnexpectedConfiguration),
        }
    }
}

impl TryFrom<BondSettings> for BondConfig {
    type Error = NetworkStateError;

    fn try_from(settings: BondSettings) -> Result<Self, Self::Error> {
        let mode = BondMode::try_from(settings.mode.as_str())
            .map_err(|_| NetworkStateError::InvalidBondMode(settings.mode))?;
        let mut options = BondOptions::default();
        if let Some(setting_options) = settings.options {
            options = BondOptions::try_from(setting_options.as_str())?;
        }

        Ok(BondConfig { mode, options })
    }
}

impl TryFrom<BondConfig> for BondSettings {
    type Error = NetworkStateError;

    fn try_from(bond: BondConfig) -> Result<Self, Self::Error> {
        Ok(BondSettings {
            mode: bond.mode.to_string(),
            options: Some(bond.options.to_string()),
            ..Default::default()
        })
    }
}

#[skip_serializing_none]
#[derive(Debug, Default, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub struct BridgeConfig {
    pub stp: Option<bool>,
    pub priority: Option<u32>,
    pub forward_delay: Option<u32>,
    pub hello_time: Option<u32>,
    pub max_age: Option<u32>,
    pub ageing_time: Option<u32>,
}

impl TryFrom<ConnectionConfig> for BridgeConfig {
    type Error = NetworkStateError;

    fn try_from(value: ConnectionConfig) -> Result<Self, Self::Error> {
        match value {
            ConnectionConfig::Bridge(config) => Ok(config),
            _ => Err(NetworkStateError::UnexpectedConfiguration),
        }
    }
}

impl TryFrom<BridgeSettings> for BridgeConfig {
    type Error = NetworkStateError;

    fn try_from(settings: BridgeSettings) -> Result<Self, Self::Error> {
        Ok(BridgeConfig {
            stp: settings.stp,
            priority: settings.priority,
            forward_delay: settings.forward_delay,
            hello_time: settings.hello_time,
            max_age: settings.max_age,
            // Not exposed over the HTTP API yet.
            ageing_time: None,
        })
    }
}

impl TryFrom<BridgeConfig> for BridgeSettings {
    type Error = NetworkStateError;

    fn try_from(bridge: BridgeConfig) -> Result<Self, Self::Error> {
        Ok(BridgeSettings {
            stp: bridge.stp,
            priority: bridge.priority,
            forward_delay: bridge.forward_delay,
            hello_time: bridge.hello_time,
            max_age: bridge.max_age,
            // Filled in by ConnectionCollection::to_api, which can see the other connections.
            ports: vec![],
        })
    }
}
#[derive(Debug, Default, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub struct BridgePortConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path_cost: Option<u32>,
}

impl From<PortSettings> for PortConfig {
    fn from(settings: PortSettings) -> Self {
        match settings.bridge {
            Some(bridge) => PortConfig::Bridge(BridgePortConfig {
                priority: bridge.priority,
                path_cost: bridge.path_cost,
            }),
            None => PortConfig::None,
        }
    }
}

impl From<&PortConfig> for PortSettings {
    fn from(config: &PortConfig) -> Self {
        match config {
            PortConfig::Bridge(bridge) => PortSettings {
                bridge: Some(BridgePortSettings {
                    priority: bridge.priority,
                    path_cost: bridge.path_cost,
                }),
            },
            // Open vSwitch ports have no settings to expose yet.
            PortConfig::OvsBridge(_) | PortConfig::None => PortSettings::default(),
        }
    }
}

#[derive(Default, Debug, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub struct InfinibandConfig {
    pub p_key: Option<i32>,
    pub parent: Option<String>,
    pub transport_mode: InfinibandTransportMode,
}

#[derive(Default, Debug, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub enum InfinibandTransportMode {
    #[default]
    Datagram,
    Connected,
}

#[derive(Debug, Error)]
#[error("Invalid infiniband transport-mode: {0}")]
pub struct InvalidInfinibandTransportMode(String);

impl FromStr for InfinibandTransportMode {
    type Err = InvalidInfinibandTransportMode;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "datagram" => Ok(Self::Datagram),
            "connected" => Ok(Self::Connected),
            _ => Err(InvalidInfinibandTransportMode(s.to_string())),
        }
    }
}

impl fmt::Display for InfinibandTransportMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            InfinibandTransportMode::Datagram => "datagram",
            InfinibandTransportMode::Connected => "connected",
        };
        write!(f, "{}", name)
    }
}

#[derive(Default, Debug, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub enum TunMode {
    #[default]
    Tun = 1,
    Tap = 2,
}

#[derive(Default, Debug, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub struct TunConfig {
    pub mode: TunMode,
    pub group: Option<String>,
    pub owner: Option<String>,
}

/// Represents a network change.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum NetworkChange {
    ConnectionAdded(Box<Connection>),
    ConnectionRemoved(Uuid),
    /// A new device has been added.
    DeviceAdded(Device),
    /// A device has been removed.
    DeviceRemoved(String),
    /// The device has been updated. The String corresponds to the
    /// original device name, which is especially useful if the
    /// device gets renamed.
    DeviceUpdated(String, Device),
    /// A connection state has changed.
    ConnectionStateChanged {
        uuid: Uuid,
        state: ConnectionState,
    },
    /// A new access point has been added.
    AccessPointAdded(AccessPoint),
    /// An access point has been removed.
    AccessPointRemoved(String),
}

#[derive(Default, Debug, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub struct IEEE8021XConfig {
    pub eap: Vec<EAPMethod>,
    pub phase2_auth: Option<Phase2AuthMethod>,
    pub identity: Option<String>,
    pub password: Option<String>,
    pub ca_cert: Option<String>,
    pub ca_cert_password: Option<String>,
    pub client_cert: Option<String>,
    pub client_cert_password: Option<String>,
    pub private_key: Option<String>,
    pub private_key_password: Option<String>,
    pub anonymous_identity: Option<String>,
    pub peap_version: Option<String>,
    pub peap_label: bool,
}

impl TryFrom<IEEE8021XSettings> for IEEE8021XConfig {
    type Error = NetworkStateError;

    fn try_from(value: IEEE8021XSettings) -> Result<Self, Self::Error> {
        let eap = value
            .eap
            .iter()
            .map(|x| {
                EAPMethod::from_str(x)
                    .map_err(|_| NetworkStateError::InvalidEAPMethod(x.to_string()))
            })
            .collect::<Result<Vec<EAPMethod>, NetworkStateError>>()?;
        let phase2_auth =
            if let Some(phase2_auth) = &value.phase2_auth {
                Some(Phase2AuthMethod::from_str(phase2_auth).map_err(|_| {
                    NetworkStateError::InvalidPhase2AuthMethod(phase2_auth.to_string())
                })?)
            } else {
                None
            };

        Ok(IEEE8021XConfig {
            eap,
            phase2_auth,
            identity: value.identity,
            password: value.password,
            ca_cert: value.ca_cert,
            ca_cert_password: value.ca_cert_password,
            client_cert: value.client_cert,
            client_cert_password: value.client_cert_password,
            private_key: value.private_key,
            private_key_password: value.private_key_password,
            anonymous_identity: value.anonymous_identity,
            peap_version: value.peap_version,
            peap_label: value.peap_label,
        })
    }
}

impl TryFrom<IEEE8021XConfig> for IEEE8021XSettings {
    type Error = NetworkStateError;

    fn try_from(value: IEEE8021XConfig) -> Result<Self, Self::Error> {
        let eap = value
            .eap
            .iter()
            .map(|x| x.to_string())
            .collect::<Vec<String>>();
        let phase2_auth = value.phase2_auth.map(|phase2_auth| phase2_auth.to_string());

        Ok(IEEE8021XSettings {
            eap,
            phase2_auth,
            identity: value.identity,
            password: value.password,
            ca_cert: value.ca_cert,
            ca_cert_password: value.ca_cert_password,
            client_cert: value.client_cert,
            client_cert_password: value.client_cert_password,
            private_key: value.private_key,
            private_key_password: value.private_key_password,
            anonymous_identity: value.anonymous_identity,
            peap_version: value.peap_version,
            peap_label: value.peap_label,
        })
    }
}

#[derive(Debug, Error)]
#[error("Invalid eap method: {0}")]
pub struct InvalidEAPMethod(String);

#[derive(Debug, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub enum EAPMethod {
    LEAP,
    MD5,
    TLS,
    PEAP,
    TTLS,
    PWD,
    FAST,
}

impl FromStr for EAPMethod {
    type Err = InvalidEAPMethod;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "leap" => Ok(Self::LEAP),
            "md5" => Ok(Self::MD5),
            "tls" => Ok(Self::TLS),
            "peap" => Ok(Self::PEAP),
            "ttls" => Ok(Self::TTLS),
            "pwd" => Ok(Self::PWD),
            "fast" => Ok(Self::FAST),
            _ => Err(InvalidEAPMethod(s.to_string())),
        }
    }
}

impl fmt::Display for EAPMethod {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match &self {
            Self::LEAP => "leap",
            Self::MD5 => "md5",
            Self::TLS => "tls",
            Self::PEAP => "peap",
            Self::TTLS => "ttls",
            Self::PWD => "pwd",
            Self::FAST => "fast",
        };
        write!(f, "{}", value)
    }
}

#[derive(Debug, Error)]
#[error("Invalid phase2-auth method: {0}")]
pub struct InvalidPhase2AuthMethod(String);

#[derive(Debug, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub enum Phase2AuthMethod {
    PAP,
    CHAP,
    MSCHAP,
    MSCHAPV2,
    GTC,
    OTP,
    MD5,
    TLS,
}

impl FromStr for Phase2AuthMethod {
    type Err = InvalidPhase2AuthMethod;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "pap" => Ok(Self::PAP),
            "chap" => Ok(Self::CHAP),
            "mschap" => Ok(Self::MSCHAP),
            "mschapv2" => Ok(Self::MSCHAPV2),
            "gtc" => Ok(Self::GTC),
            "otp" => Ok(Self::OTP),
            "md5" => Ok(Self::MD5),
            "tls" => Ok(Self::TLS),
            _ => Err(InvalidPhase2AuthMethod(s.to_string())),
        }
    }
}

impl fmt::Display for Phase2AuthMethod {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match self {
            Self::PAP => "pap",
            Self::CHAP => "chap",
            Self::MSCHAP => "mschap",
            Self::MSCHAPV2 => "mschapv2",
            Self::GTC => "gtc",
            Self::OTP => "otp",
            Self::MD5 => "md5",
            Self::TLS => "tls",
        };
        write!(f, "{}", value)
    }
}

#[derive(Debug, Default, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub struct OvsBridgeConfig {
    pub mcast_snooping_enable: Option<bool>,
    pub rstp_enable: Option<bool>,
    pub stp_enable: Option<bool>,
}

#[derive(Debug, Default, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub struct OvsPortConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag: Option<u16>,
}

#[derive(Debug, Error)]
#[error("Invalid OvsInterfaceType: {0}")]
pub struct InvalidOvsInterfaceType(String);

impl FromStr for OvsInterfaceType {
    type Err = InvalidOvsInterfaceType;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "" => Ok(Self::Empty),
            "internal" => Ok(Self::Internal),
            "system" => Ok(Self::System),
            "patch" => Ok(Self::Patch),
            "dpdk" => Ok(Self::Dpdk),
            _ => Err(InvalidOvsInterfaceType(s.to_string())),
        }
    }
}

impl From<InvalidOvsInterfaceType> for zbus::fdo::Error {
    fn from(value: InvalidOvsInterfaceType) -> Self {
        zbus::fdo::Error::Failed(value.to_string())
    }
}

impl fmt::Display for OvsInterfaceType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match self {
            Self::Empty => "",
            Self::Internal => "internal",
            Self::System => "system",
            Self::Patch => "patch",
            Self::Dpdk => "dpdk",
        };
        write!(f, "{}", value)
    }
}
#[derive(Default, Debug, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub enum OvsInterfaceType {
    #[default]
    Empty,
    Internal,
    System,
    Patch,
    Dpdk,
}

#[derive(Debug, Default, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub struct OvsInterfaceConfig {
    pub interface_type: OvsInterfaceType,
}

#[derive(Debug, Default, PartialEq, Clone, Deserialize, Serialize, JsonSchema)]
pub struct OvsBridgePortConfig {}
