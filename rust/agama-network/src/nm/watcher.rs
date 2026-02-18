// Copyright (c) [2024-2025] SUSE LLC
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

//! Implements the mechanism to listen for NetworkManager changes.
//!
//! Monitors NetworkManager's D-Bus service and emit [actions](crate::network::Action] to update
//! the NetworkSystem state when devices or active connections change.

use crate::model::Connection;
use std::collections::{hash_map::Entry, HashMap};

use crate::types::Device;
use crate::{adapter::Watcher, nm::proxies::DeviceProxy, Action, NetworkAdapterError};
use anyhow::anyhow;
use async_trait::async_trait;
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use tokio_stream::StreamExt;
use zbus::zvariant::OwnedObjectPath;

use super::{
    builder::{ConnectionFromProxyBuilder, DeviceFromProxyBuilder},
    dbus::connection_from_dbus,
    error::NmError,
    model::NmConnectionState,
    proxies::{ActiveConnectionProxy, ConnectionProxy, NetworkManagerProxy},
    streams::{
        ActiveConnectionChangedStream, ConnectionSettingsChangedStream, DeviceChangedStream,
        NmChange,
    },
};

/// Implements a [crate::network::adapter::Watcher] for NetworkManager.
///
/// This process is composed of the following pieces:
///
/// * A stream of potentially useful D-Bus signals (see [DeviceChangedStream]).
/// * A dispatcher that receives the signals from the stream and turns them into
///   [network system actions](crate::network::Action).
///
/// To avoid deadlocks, the stream runs on a separate Tokio task and it communicates
/// with the dispatcher through a multi-producer single-consumer (mpsc) channel.
///
/// At this point, it detects the following changes:
///
/// * A device is added, changed or removed.
/// * The status of a device changes.
/// * The IPv4 or IPv6 configuration changes.
pub struct NetworkManagerWatcher {
    connection: zbus::Connection,
}

impl NetworkManagerWatcher {
    /// Builds a new watcher over a D-Bus connection.
    pub fn new(connection: &zbus::Connection) -> Self {
        Self {
            connection: connection.clone(),
        }
    }
}

#[async_trait]
impl Watcher for NetworkManagerWatcher {
    async fn run(
        self: Box<Self>,
        actions: UnboundedSender<Action>,
    ) -> Result<(), NetworkAdapterError> {
        let (tx, rx) = unbounded_channel();

        // Process the DeviceChangedStream in a separate task.
        let connection = self.connection.clone();
        let tx_clone = tx.clone();
        tokio::spawn(async move {
            let mut stream = DeviceChangedStream::new(&connection).await.unwrap();

            while let Some(change) = stream.next().await {
                if let Err(e) = tx_clone.send(change) {
                    tracing::error!("Could not dispatch a network change: {e}");
                }
            }
        });

        // Process the ActiveConnectionChangedStream in a separate task.
        let connection = self.connection.clone();
        let tx_clone = tx.clone();
        tokio::spawn(async move {
            let mut stream = ActiveConnectionChangedStream::new(&connection)
                .await
                .unwrap();

            while let Some(change) = stream.next().await {
                if let Err(e) = tx_clone.send(change) {
                    tracing::error!("Could not dispatch a network change: {e}");
                }
            }
        });

        // Process the ConnectionSettingsChangedStream in a separate task.
        let connection = self.connection.clone();
        tokio::spawn(async move {
            let mut stream = ConnectionSettingsChangedStream::new(&connection)
                .await
                .unwrap();

            while let Some(change) = stream.next().await {
                if let Err(e) = tx.send(change) {
                    tracing::error!("Could not dispatch a network change: {e}");
                }
            }
        });

        // Turn the changes into actions in a separate task.
        let connection = self.connection.clone();
        let mut dispatcher = ActionDispatcher::new(connection, rx, actions);
        dispatcher
            .run()
            .await
            .map_err(|e| NetworkAdapterError::Watcher(anyhow!(e)))
    }
}

/// Receives the updates and turns them into [network actions](crate::network::Action).
///
/// See [ActionDispatcher::run] for further details.
struct ActionDispatcher<'a> {
    connection: zbus::Connection,
    proxies: ProxiesRegistry<'a>,
    updates_rx: UnboundedReceiver<NmChange>,
    actions_tx: UnboundedSender<Action>,
}

impl ActionDispatcher<'_> {
    /// Returns a new dispatcher.
    ///
    /// * `connection`: D-Bus connection to NetworkManager.
    /// * `updates_rx`: Channel to receive the updates.
    /// * `actions_tx`: Channel to dispatch the network actions.
    pub fn new(
        connection: zbus::Connection,
        updates_rx: UnboundedReceiver<NmChange>,
        actions_tx: UnboundedSender<Action>,
    ) -> Self {
        Self {
            proxies: ProxiesRegistry::new(&connection),
            connection,
            updates_rx,
            actions_tx,
        }
    }

    /// Processes the updates.
    ///
    /// It runs until the updates channel is closed.
    pub async fn run(&mut self) -> Result<(), NmError> {
        self.read_devices().await?;
        while let Some(update) = self.updates_rx.recv().await {
            let result = match update {
                NmChange::ConnectionAdded(path) => self.handle_connection_added(path).await,
                NmChange::ConnectionRemoved(path) => self.handle_connection_removed(path).await,
                NmChange::DeviceAdded(path) => self.handle_device_added(path).await,
                NmChange::DeviceUpdated(path) => self.handle_device_updated(path).await,
                NmChange::DeviceRemoved(path) => self.handle_device_removed(path).await,
                NmChange::IP4ConfigChanged(path) => self.handle_ip4_config_changed(path).await,
                NmChange::IP6ConfigChanged(path) => self.handle_ip6_config_changed(path).await,
                NmChange::ActiveConnectionAdded(path) | NmChange::ActiveConnectionUpdated(path) => {
                    self.handle_active_connection_updated(path).await
                }
                NmChange::ActiveConnectionRemoved(path) => {
                    self.handle_active_connection_removed(path).await
                }
            };

            if let Err(error) = result {
                tracing::warn!("Could not process a network update: {error}]")
            }
        }
        Ok(())
    }

    /// Reads the devices.
    async fn read_devices(&mut self) -> Result<(), NmError> {
        let nm_proxy = NetworkManagerProxy::new(&self.connection).await?;
        for path in nm_proxy.get_devices().await? {
            self.proxies.find_or_add_device(&path).await?;
        }
        Ok(())
    }

    /// Handles the case where a new connection appears.
    ///
    /// * `path`: D-Bus object path of the new connection.
    async fn handle_connection_added(&mut self, path: OwnedObjectPath) -> Result<(), NmError> {
        let (_, proxy) = self.proxies.find_or_add_connection(&path).await?;
        tracing::info!("New connection was found");
        dbg!("New connection was found");
        if let Ok(conn) = Self::connection_from_proxy(&self.connection, proxy.clone()).await {
            _ = self.actions_tx.send(Action::NewConnection(Box::new(conn)));
        }
        // TODO: report an error if the device cannot get generated

        Ok(())
    }

    /// Handles the case where a new connection is removed
    ///
    /// * `path`: D-Bus object path of the removed connection.
    async fn handle_connection_removed(&mut self, path: OwnedObjectPath) -> Result<(), NmError> {
        tracing::info!("Connection was removed");
        if let Some((id, _)) = self.proxies.remove_connection(&path) {
            _ = self.actions_tx.send(Action::RemoveConnection(id));
        }
        Ok(())
    }

    /// Handles the case where a new device appears.
    ///
    /// * `path`: D-Bus object path of the new device.
    async fn handle_device_added(&mut self, path: OwnedObjectPath) -> Result<(), NmError> {
        let (_, proxy) = self.proxies.find_or_add_device(&path).await?;
        if let Ok(device) = Self::device_from_proxy(&self.connection, proxy.clone()).await {
            _ = self.actions_tx.send(Action::AddDevice(Box::new(device)));
        }
        // TODO: report an error if the device cannot get generated

        Ok(())
    }

    /// Handles the case where a device is updated.
    ///
    /// * `path`: D-Bus object path of the updated device.
    async fn handle_device_updated(&mut self, path: OwnedObjectPath) -> Result<(), NmError> {
        let (old_name, proxy) = self.proxies.find_or_add_device(&path).await?;
        let device = Self::device_from_proxy(&self.connection, proxy.clone()).await?;
        let new_name = device.name.clone();
        _ = self
            .actions_tx
            .send(Action::UpdateDevice(old_name.to_string(), Box::new(device)));
        self.proxies.update_device_name(&path, &new_name);
        Ok(())
    }

    /// Handles the case where a device is removed.
    ///
    /// * `path`: D-Bus object path of the removed device.
    async fn handle_device_removed(&mut self, path: OwnedObjectPath) -> Result<(), NmError> {
        if let Some((name, _)) = self.proxies.remove_device(&path) {
            _ = self.actions_tx.send(Action::RemoveDevice(name));
        }
        Ok(())
    }

    /// Handles the case where the IPv4 configuration changes.
    ///
    /// * `path`: D-Bus object path of the changed IP configuration.
    async fn handle_ip4_config_changed(&mut self, path: OwnedObjectPath) -> Result<(), NmError> {
        if let Some((name, proxy)) = self.proxies.find_device_for_ip4(&path).await {
            let device = Self::device_from_proxy(&self.connection, proxy.clone()).await?;
            _ = self
                .actions_tx
                .send(Action::UpdateDevice(name.to_string(), Box::new(device)));
        }
        Ok(())
    }

    /// Handles the case where the IPv6 configuration changes.
    ///
    /// * `path`: D-Bus object path of the changed IP configuration.
    async fn handle_ip6_config_changed(&mut self, path: OwnedObjectPath) -> Result<(), NmError> {
        if let Some((name, proxy)) = self.proxies.find_device_for_ip6(&path).await {
            let device = Self::device_from_proxy(&self.connection, proxy.clone()).await?;
            _ = self
                .actions_tx
                .send(Action::UpdateDevice(name.to_string(), Box::new(device)));
        }
        Ok(())
    }

    /// Handles the case where a new active connection appears.
    ///
    /// * `path`: D-Bus object path of the new active connection.
    async fn handle_active_connection_updated(
        &mut self,
        path: OwnedObjectPath,
    ) -> Result<(), NmError> {
        let proxy = self.proxies.find_or_add_active_connection(&path).await?;
        let id = proxy.id().await?;
        let state = proxy.state().await.map(|s| NmConnectionState(s.clone()))?;
        if let Ok(state) = state.try_into() {
            _ = self
                .actions_tx
                .send(Action::ChangeConnectionState(id, state));
        }
        // TODO: report an error if the device cannot get generated

        Ok(())
    }

    /// Handles the case where a device is removed.
    ///
    /// * `path`: D-Bus object path of the removed device.
    async fn handle_active_connection_removed(
        &mut self,
        path: OwnedObjectPath,
    ) -> Result<(), NmError> {
        if let Some(proxy) = self.proxies.remove_active_connection(&path) {
            let id = proxy.id().await?;
            let state = proxy.state().await.map(|s| NmConnectionState(s.clone()))?;
            if let Ok(state) = state.try_into() {
                _ = self
                    .actions_tx
                    .send(Action::ChangeConnectionState(id, state));
            }
        }

        Ok(())
    }

    async fn connection_from_proxy(
        connection: &zbus::Connection,
        proxy: ConnectionProxy<'_>,
    ) -> Result<Connection, NmError> {
        let builder = ConnectionFromProxyBuilder::new(connection, &proxy);
        builder.build().await
    }

    async fn device_from_proxy(
        connection: &zbus::Connection,
        proxy: DeviceProxy<'_>,
    ) -> Result<Device, NmError> {
        let builder = DeviceFromProxyBuilder::new(connection, &proxy);
        builder.build().await
    }
}

/// Ancillary class to track the devices and their related D-Bus objects.
pub struct ProxiesRegistry<'a> {
    connection: zbus::Connection,
    connections: HashMap<OwnedObjectPath, (String, ConnectionProxy<'a>)>,
    // the String is the device name like eth0
    devices: HashMap<OwnedObjectPath, (String, DeviceProxy<'a>)>,
    active_connections: HashMap<OwnedObjectPath, ActiveConnectionProxy<'a>>,
}

impl<'a> ProxiesRegistry<'a> {
    pub fn new(connection: &zbus::Connection) -> Self {
        Self {
            connection: connection.clone(),
            connections: HashMap::new(),
            devices: HashMap::new(),
            active_connections: HashMap::new(),
        }
    }

    /// Finds or adds a device to the registry.
    ///
    /// * `path`: D-Bus object path.
    pub async fn find_or_add_device(
        &mut self,
        path: &OwnedObjectPath,
    ) -> Result<&(String, DeviceProxy<'a>), NmError> {
        // Cannot use entry(...).or_insert_with(...) because of the async call.
        match self.devices.entry(path.clone()) {
            Entry::Vacant(entry) => {
                let proxy = DeviceProxy::builder(&self.connection.clone())
                    .path(path.clone())?
                    .build()
                    .await?;
                let name = proxy.interface().await?;

                Ok(entry.insert((name, proxy)))
            }
            Entry::Occupied(entry) => Ok(entry.into_mut()),
        }
    }

    /// Finds or adds a connection to the registry.
    ///
    /// * `path`: D-Bus object path.
    pub async fn find_or_add_connection(
        &mut self,
        path: &OwnedObjectPath,
    ) -> Result<&(String, ConnectionProxy<'a>), NmError> {
        // Cannot use entry(...).or_insert_with(...) because of the async call.
        match self.connections.entry(path.clone()) {
            Entry::Vacant(entry) => {
                let proxy = ConnectionProxy::builder(&self.connection.clone())
                    .path(path.clone())?
                    .build()
                    .await?;
                let settings = proxy.get_settings().await?;
                match connection_from_dbus(settings) {
                    Ok(conn) => Ok(entry.insert((conn.id, proxy))),
                    Err(e) => {
                        tracing::warn!("Could not process connection {}: {}", &path, e);
                        Err(e)
                    }
                }
            }
            Entry::Occupied(entry) => Ok(entry.into_mut()),
        }
    }

    /// Finds or adds an active connection to the registry.
    ///
    /// * `path`: D-Bus object path.
    pub async fn find_or_add_active_connection(
        &mut self,
        path: &OwnedObjectPath,
    ) -> Result<&ActiveConnectionProxy<'a>, NmError> {
        // Cannot use entry(...).or_insert_with(...) because of the async call.
        match self.active_connections.entry(path.clone()) {
            Entry::Vacant(entry) => {
                let proxy = ActiveConnectionProxy::builder(&self.connection.clone())
                    .path(path.clone())?
                    .build()
                    .await?;

                Ok(entry.insert(proxy))
            }
            Entry::Occupied(entry) => Ok(entry.into_mut()),
        }
    }

    /// Removes a connection from the registry.
    ///
    /// * `path`: D-Bus object path.
    pub fn remove_connection(
        &mut self,
        path: &OwnedObjectPath,
    ) -> Option<(String, ConnectionProxy<'_>)> {
        self.connections.remove(path)
    }

    /// Removes an active connection from the registry.
    ///
    /// * `path`: D-Bus object path.
    pub fn remove_active_connection(
        &mut self,
        path: &OwnedObjectPath,
    ) -> Option<ActiveConnectionProxy<'_>> {
        self.active_connections.remove(path)
    }

    /// Removes a device from the registry.
    ///
    /// * `path`: D-Bus object path.
    pub fn remove_device(&mut self, path: &OwnedObjectPath) -> Option<(String, DeviceProxy<'_>)> {
        self.devices.remove(path)
    }

    //// Updates a device name.
    ///
    /// * `path`: D-Bus object path.
    /// * `new_name`: New device name.
    pub fn update_device_name(&mut self, path: &OwnedObjectPath, new_name: &str) {
        if let Some(value) = self.devices.get_mut(path) {
            value.0 = new_name.to_string();
        };
    }

    //// For the device corresponding to a given IPv4 configuration.
    ///
    /// * `ip4_config_path`: D-Bus object path of the IPv4 configuration.
    pub async fn find_device_for_ip4(
        &self,
        ip4_config_path: &OwnedObjectPath,
    ) -> Option<&(String, DeviceProxy<'_>)> {
        for device in self.devices.values() {
            if let Ok(path) = device.1.ip4_config().await {
                if path == *ip4_config_path {
                    return Some(device);
                }
            }
        }
        None
    }

    //// For the device corresponding to a given IPv6 configuration.
    ///
    /// * `ip6_config_path`: D-Bus object path of the IPv6 configuration.
    pub async fn find_device_for_ip6(
        &self,
        ip4_config_path: &OwnedObjectPath,
    ) -> Option<&(String, DeviceProxy<'_>)> {
        for device in self.devices.values() {
            if let Ok(path) = device.1.ip4_config().await {
                if path == *ip4_config_path {
                    return Some(device);
                }
            }
        }
        None
    }
}
