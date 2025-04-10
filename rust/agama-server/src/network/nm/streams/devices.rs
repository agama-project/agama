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

use agama_lib::error::ServiceError;
use futures_util::ready;
use pin_project::pin_project;
use std::{
    collections::{hash_map::Entry, HashMap},
    pin::Pin,
    task::{Context, Poll},
};
use tokio_stream::{Stream, StreamMap};
use zbus::{
    fdo::{InterfacesAdded, InterfacesRemoved, PropertiesChanged},
    message::Type as essageType,
    names::InterfaceName,
    zvariant::OwnedObjectPath,
    MatchRule, Message, MessageStream,
};

use crate::network::nm::proxies::DeviceProxy;

use super::common::{build_added_and_removed_stream, build_properties_changed_stream};

/// Stream of device-related events.
///
/// This stream listens for many NetworkManager events that are related to network devices (state,
/// IP configuration, etc.) and converts them into variants of the [DeviceChange] enum.
///
/// It is implemented as a struct because it needs to keep the ObjectManagerProxy alive.
#[pin_project]
pub struct DeviceChangedStream {
    connection: zbus::Connection,
    #[pin]
    inner: StreamMap<&'static str, MessageStream>,
}

impl DeviceChangedStream {
    /// Builds a new stream using the given D-Bus connection.
    ///
    /// * `connection`: D-Bus connection.
    pub async fn new(connection: &zbus::Connection) -> Result<Self, ServiceError> {
        let connection = connection.clone();
        let mut inner = StreamMap::new();
        inner.insert(
            "object_manager",
            build_added_and_removed_stream(&connection).await?,
        );
        inner.insert(
            "properties",
            build_properties_changed_stream(&connection).await?,
        );
        Ok(Self { connection, inner })
    }

    fn handle_added(message: InterfacesAdded) -> Option<DeviceChange> {
        let args = message.args().ok()?;
        let interfaces: Vec<String> = args
            .interfaces_and_properties()
            .keys()
            .map(|i| i.to_string())
            .collect();

        if interfaces.contains(&"org.freedesktop.NetworkManager.Device".to_string()) {
            let path = OwnedObjectPath::from(args.object_path().clone());
            return Some(DeviceChange::DeviceAdded(path));
        }

        None
    }

    fn handle_removed(message: InterfacesRemoved) -> Option<DeviceChange> {
        let args = message.args().ok()?;

        let interface = InterfaceName::from_str_unchecked("org.freedesktop.NetworkManager.Device");
        if args.interfaces.contains(&interface) {
            let path = OwnedObjectPath::from(args.object_path().clone());
            return Some(DeviceChange::DeviceRemoved(path));
        }

        None
    }

    fn handle_changed(message: PropertiesChanged) -> Option<DeviceChange> {
        const IP_CONFIG_PROPS: &[&str] = &["AddressData", "Gateway", "NameserverData", "RouteData"];
        const DEVICE_PROPS: &[&str] = &[
            "DeviceType",
            "HwAddress",
            "Interface",
            "State",
            "StateReason",
        ];

        let args = message.args().ok()?;
        let inner = message.message();
        let path = OwnedObjectPath::from(inner.header().path()?.to_owned());

        match args.interface_name.as_str() {
            "org.freedesktop.NetworkManager.IP4Config" => {
                if Self::include_properties(IP_CONFIG_PROPS, &args.changed_properties) {
                    return Some(DeviceChange::IP4ConfigChanged(path));
                }
            }
            "org.freedesktop.NetworkManager.IP6Config" => {
                if Self::include_properties(IP_CONFIG_PROPS, &args.changed_properties) {
                    return Some(DeviceChange::IP6ConfigChanged(path));
                }
            }
            "org.freedesktop.NetworkManager.Device" => {
                if Self::include_properties(DEVICE_PROPS, &args.changed_properties) {
                    return Some(DeviceChange::DeviceUpdated(path));
                }
            }
            _ => {}
        };
        None
    }

    fn include_properties(
        wanted: &[&str],
        changed: &HashMap<&'_ str, zbus::zvariant::Value<'_>>,
    ) -> bool {
        let properties: Vec<_> = changed.keys().collect();
        wanted.iter().any(|i| properties.contains(&i))
    }

    fn handle_message(message: Result<Message, zbus::Error>) -> Option<DeviceChange> {
        let Ok(message) = message else {
            return None;
        };

        if let Some(added) = InterfacesAdded::from_message(message.clone()) {
            return Self::handle_added(added);
        }

        if let Some(removed) = InterfacesRemoved::from_message(message.clone()) {
            return Self::handle_removed(removed);
        }

        if let Some(changed) = PropertiesChanged::from_message(message.clone()) {
            return Self::handle_changed(changed);
        }

        None
    }
}

impl Stream for DeviceChangedStream {
    type Item = DeviceChange;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let mut pinned = self.project();
        Poll::Ready(loop {
            let item = ready!(pinned.inner.as_mut().poll_next(cx));
            let next_value = match item {
                Some((_, message)) => Self::handle_message(message),
                _ => None,
            };
            if next_value.is_some() {
                break next_value;
            }
        })
    }
}

#[derive(Debug, Clone)]
pub enum DeviceChange {
    DeviceAdded(OwnedObjectPath),
    DeviceUpdated(OwnedObjectPath),
    DeviceRemoved(OwnedObjectPath),
    IP4ConfigChanged(OwnedObjectPath),
    IP6ConfigChanged(OwnedObjectPath),
}

/// Ancillary class to track the devices and their related D-Bus objects.
pub struct ProxiesRegistry<'a> {
    connection: zbus::Connection,
    // the String is the device name like eth0
    devices: HashMap<OwnedObjectPath, (String, DeviceProxy<'a>)>,
}

impl<'a> ProxiesRegistry<'a> {
    pub fn new(connection: &zbus::Connection) -> Self {
        Self {
            connection: connection.clone(),
            devices: HashMap::new(),
        }
    }

    /// Finds or adds a device to the registry.
    ///
    /// * `path`: D-Bus object path.
    pub async fn find_or_add_device(
        &mut self,
        path: &OwnedObjectPath,
    ) -> Result<&(String, DeviceProxy<'a>), ServiceError> {
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

    /// Removes a device from the registry.
    ///
    /// * `path`: D-Bus object path.
    pub fn remove_device(&mut self, path: &OwnedObjectPath) -> Option<(String, DeviceProxy)> {
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
