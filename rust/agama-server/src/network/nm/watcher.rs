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

use crate::network::{
    adapter::Watcher, model::Device, nm::proxies::DeviceProxy, Action, NetworkAdapterError,
};
use agama_lib::error::ServiceError;
use async_trait::async_trait;
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use tokio_stream::StreamExt;
use zbus::zvariant::OwnedObjectPath;

use super::{
    builder::DeviceFromProxyBuilder,
    proxies::NetworkManagerProxy,
    streams::{DeviceChange, DeviceChangedStream, ProxiesRegistry},
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
        tokio::spawn(async move {
            let mut stream = DeviceChangedStream::new(&connection).await.unwrap();

            while let Some(change) = stream.next().await {
                if let Err(e) = tx.send(change) {
                    tracing::error!("Could not dispatch a network change: {e}");
                }
            }
        });

        // Turn the changes into actions in a separate task.
        let connection = self.connection.clone();
        let mut dispatcher = ActionDispatcher::new(connection, rx, actions);
        dispatcher.run().await.map_err(NetworkAdapterError::Watcher)
    }
}

/// Receives the updates and turns them into [network actions](crate::network::Action).
///
/// See [ActionDispatcher::run] for further details.
struct ActionDispatcher<'a> {
    connection: zbus::Connection,
    proxies: ProxiesRegistry<'a>,
    updates_rx: UnboundedReceiver<DeviceChange>,
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
        updates_rx: UnboundedReceiver<DeviceChange>,
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
    pub async fn run(&mut self) -> Result<(), ServiceError> {
        self.read_devices().await?;
        while let Some(update) = self.updates_rx.recv().await {
            let result = match update {
                DeviceChange::DeviceAdded(path) => self.handle_device_added(path).await,
                DeviceChange::DeviceUpdated(path) => self.handle_device_updated(path).await,
                DeviceChange::DeviceRemoved(path) => self.handle_device_removed(path).await,
                DeviceChange::IP4ConfigChanged(path) => self.handle_ip4_config_changed(path).await,
                DeviceChange::IP6ConfigChanged(path) => self.handle_ip6_config_changed(path).await,
            };

            if let Err(error) = result {
                tracing::warn!("Could not process a network update: {error}]")
            }
        }
        Ok(())
    }

    /// Reads the devices.
    async fn read_devices(&mut self) -> Result<(), ServiceError> {
        let nm_proxy = NetworkManagerProxy::new(&self.connection).await?;
        for path in nm_proxy.get_devices().await? {
            self.proxies.find_or_add_device(&path).await?;
        }
        Ok(())
    }

    /// Handles the case where a new device appears.
    ///
    /// * `path`: D-Bus object path of the new device.
    async fn handle_device_added(&mut self, path: OwnedObjectPath) -> Result<(), ServiceError> {
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
    async fn handle_device_updated(&mut self, path: OwnedObjectPath) -> Result<(), ServiceError> {
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
    async fn handle_device_removed(&mut self, path: OwnedObjectPath) -> Result<(), ServiceError> {
        if let Some((name, _)) = self.proxies.remove_device(&path) {
            _ = self.actions_tx.send(Action::RemoveDevice(name));
        }
        Ok(())
    }

    /// Handles the case where the IPv4 configuration changes.
    ///
    /// * `path`: D-Bus object path of the changed IP configuration.
    async fn handle_ip4_config_changed(
        &mut self,
        path: OwnedObjectPath,
    ) -> Result<(), ServiceError> {
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
    async fn handle_ip6_config_changed(
        &mut self,
        path: OwnedObjectPath,
    ) -> Result<(), ServiceError> {
        if let Some((name, proxy)) = self.proxies.find_device_for_ip6(&path).await {
            let device = Self::device_from_proxy(&self.connection, proxy.clone()).await?;
            _ = self
                .actions_tx
                .send(Action::UpdateDevice(name.to_string(), Box::new(device)));
        }
        Ok(())
    }

    async fn device_from_proxy(
        connection: &zbus::Connection,
        proxy: DeviceProxy<'_>,
    ) -> Result<Device, ServiceError> {
        let builder = DeviceFromProxyBuilder::new(connection, &proxy);
        builder.build().await
    }
}
