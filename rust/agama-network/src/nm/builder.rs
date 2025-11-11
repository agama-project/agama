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

//! Conversion mechanism between proxies and model structs.

use crate::{
    nm::{
        model::NmDeviceType,
        proxies::{DeviceProxy, IP4ConfigProxy, IP6ConfigProxy},
    },
    types::{Device, DeviceState, DeviceType, IpConfig, IpRoute, MacAddress},
};
use cidr::IpInet;
use std::{collections::HashMap, net::IpAddr, str::FromStr};

use super::{error::NmError, model::NmDeviceState};

/// Builder to create a [Device] from its corresponding NetworkManager D-Bus representation.
pub struct DeviceFromProxyBuilder<'a> {
    connection: zbus::Connection,
    proxy: &'a DeviceProxy<'a>,
}

impl<'a> DeviceFromProxyBuilder<'a> {
    pub fn new(connection: &zbus::Connection, proxy: &'a DeviceProxy<'a>) -> Self {
        Self {
            connection: connection.clone(),
            proxy,
        }
    }

    /// Creates a [Device] starting on the [DeviceProxy].
    pub async fn build(&self) -> Result<Device, NmError> {
        let device_type = NmDeviceType(self.proxy.device_type().await?);
        let type_: DeviceType = device_type.try_into()?;

        let mut device = Device {
            name: self.proxy.interface().await?,
            state: self.device_state_from_proxy().await?,
            type_,
            ..Default::default()
        };

        if device.state == DeviceState::Connected {
            device.ip_config = self.build_ip_config().await?;
        }

        device.mac_address = self.mac_address_from_dbus(self.proxy.hw_address().await?.as_str());
        if let Ok((connection, _)) = self.proxy.get_applied_connection(0).await {
            device.connection = self.connection_id(connection);
        }

        Ok(device)
    }

    async fn build_ip_config(&self) -> Result<Option<IpConfig>, NmError> {
        let ip4_path = self.proxy.ip4_config().await?;
        let ip6_path = self.proxy.ip6_config().await?;

        let ip4_proxy = IP4ConfigProxy::builder(&self.connection)
            .path(ip4_path.as_str())?
            .build()
            .await;

        let Ok(ip4_proxy) = ip4_proxy else {
            return Ok(None);
        };

        let ip6_proxy = IP6ConfigProxy::builder(&self.connection)
            .path(ip6_path.as_str())?
            .build()
            .await;

        let Ok(ip6_proxy) = ip6_proxy else {
            return Ok(None);
        };

        let result = self
            .build_ip_config_from_proxies(ip4_proxy, ip6_proxy)
            .await
            .ok();
        Ok(result)
    }

    async fn build_ip_config_from_proxies(
        &self,
        ip4_proxy: IP4ConfigProxy<'_>,
        ip6_proxy: IP6ConfigProxy<'_>,
    ) -> Result<IpConfig, NmError> {
        let address_data = ip4_proxy.address_data().await?;
        let nameserver_data = ip4_proxy.nameserver_data().await?;
        let mut addresses: Vec<IpInet> = vec![];
        let mut nameservers: Vec<IpAddr> = vec![];

        for addr in address_data {
            if let Some(address) = self.address_with_prefix_from_dbus(addr) {
                addresses.push(address)
            }
        }

        let address_data = ip6_proxy.address_data().await?;
        for addr in address_data {
            if let Some(address) = self.address_with_prefix_from_dbus(addr) {
                addresses.push(address)
            }
        }

        for nameserver in nameserver_data {
            if let Some(address) = self.nameserver_from_dbus(nameserver) {
                nameservers.push(address)
            }
        }
        // FIXME: Convert from Vec<u8> to [u8; 16] and take into account big vs little endian order,
        // in IP6Config there is no nameserver-data.
        //
        // let nameserver_data = ip6_proxy.nameservers().await?;

        let route_data = ip4_proxy.route_data().await?;
        let mut routes4: Vec<IpRoute> = vec![];
        if !route_data.is_empty() {
            for route in route_data {
                if let Some(route) = self.route_from_dbus(route) {
                    routes4.push(route)
                }
            }
        }

        let mut routes6: Vec<IpRoute> = vec![];
        let route_data = ip6_proxy.route_data().await?;
        if !route_data.is_empty() {
            for route in route_data {
                if let Some(route) = self.route_from_dbus(route) {
                    routes6.push(route)
                }
            }
        }

        let mut ip_config = IpConfig {
            addresses,
            nameservers,
            routes4,
            routes6,
            ..Default::default()
        };

        let ip4_gateway = ip4_proxy.gateway().await?;
        let ip6_gateway = ip6_proxy.gateway().await?;

        if !ip4_gateway.is_empty() {
            ip_config.gateway4 = Some(ip4_gateway.parse().unwrap());
        };
        if !ip6_gateway.is_empty() {
            ip_config.gateway6 = Some(ip6_gateway.parse().unwrap());
        };

        Ok(ip_config)
    }

    pub fn address_with_prefix_from_dbus(
        &self,
        address_data: HashMap<String, zbus::zvariant::OwnedValue>,
    ) -> Option<IpInet> {
        let addr_str: &str = address_data.get("address")?.downcast_ref().ok()?;
        let prefix: &u32 = address_data.get("prefix")?.downcast_ref().ok()?;
        let prefix = *prefix as u8;
        let address = IpInet::new(addr_str.parse().unwrap(), prefix).ok()?;
        Some(address)
    }

    pub fn nameserver_from_dbus(
        &self,
        nameserver_data: HashMap<String, zbus::zvariant::OwnedValue>,
    ) -> Option<IpAddr> {
        let addr_str: &str = nameserver_data.get("address")?.downcast_ref().ok()?;
        Some(addr_str.parse().unwrap())
    }

    pub fn route_from_dbus(
        &self,
        route_data: HashMap<String, zbus::zvariant::OwnedValue>,
    ) -> Option<IpRoute> {
        let dest_str: &str = route_data.get("dest")?.downcast_ref().ok()?;
        let prefix: u8 = route_data.get("prefix")?.downcast_ref::<u32>().ok()? as u8;
        let destination = IpInet::new(dest_str.parse().unwrap(), prefix).ok()?;
        let mut new_route = IpRoute {
            destination,
            next_hop: None,
            metric: None,
        };

        if let Some(next_hop) = route_data.get("next-hop") {
            let next_hop_str: &str = next_hop.downcast_ref().ok()?;
            new_route.next_hop = Some(IpAddr::from_str(next_hop_str).unwrap());
        }
        if let Some(metric) = route_data.get("metric") {
            let metric: u32 = metric.downcast_ref().ok()?;
            new_route.metric = Some(metric);
        }

        Some(new_route)
    }

    fn mac_address_from_dbus(&self, mac: &str) -> MacAddress {
        match MacAddress::from_str(mac) {
            Ok(mac) => mac,
            Err(_) => {
                tracing::warn!("Unable to parse mac {}", &mac);
                MacAddress::Unset
            }
        }
    }

    pub fn connection_id(
        &self,
        connection_data: HashMap<String, HashMap<String, zbus::zvariant::OwnedValue>>,
    ) -> Option<String> {
        let connection = connection_data.get("connection")?;
        let id: &str = connection.get("id")?.downcast_ref().ok()?;

        Some(id.to_string())
    }

    /// Map the combination of state + reason to the Agama set of states.
    ///
    /// See https://www.networkmanager.dev/docs/api/latest/nm-dbus-types.html#NMDeviceState
    /// and https://www.networkmanager.dev/docs/api/latest/nm-dbus-types.html#NMDeviceStateReason
    /// for further information.
    async fn device_state_from_proxy(&self) -> Result<DeviceState, NmError> {
        const USER_REQUESTED: u32 = 39;

        let (state, reason) = self.proxy.state_reason().await?;
        let state: NmDeviceState = (state as u8).try_into()?;

        let device_state = match state {
            NmDeviceState::Unknown => DeviceState::Unknown,
            NmDeviceState::Unmanaged => DeviceState::Unmanaged,
            NmDeviceState::Unavailable => DeviceState::Unavailable,
            NmDeviceState::Prepare
            | NmDeviceState::IpConfig
            | NmDeviceState::NeedAuth
            | NmDeviceState::Config
            | NmDeviceState::Secondaries
            | NmDeviceState::IpCheck => DeviceState::Connecting,
            NmDeviceState::Activated => DeviceState::Connected,
            NmDeviceState::Deactivating => DeviceState::Disconnecting,
            NmDeviceState::Disconnected => {
                // If the connection failed, NetworkManager sets the state to "disconnected".
                // Let's consider it a problem unless it was requested by the user.
                if reason == USER_REQUESTED {
                    DeviceState::Disconnected
                } else {
                    DeviceState::Failed
                }
            }
            NmDeviceState::Failed => DeviceState::Failed,
        };

        Ok(device_state)
    }
}
