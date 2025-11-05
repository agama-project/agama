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

//! NetworkManager client.
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::path::Path;

use super::builder::DeviceFromProxyBuilder;
use super::dbus::{
    cleanup_dbus_connection, connection_from_dbus, connection_to_dbus, controller_from_dbus,
    merge_dbus_connections,
};
use super::error::NmError;
use super::model::{NmConnectionState, NmDeviceType};
use super::proxies::{
    AccessPointProxy, ActiveConnectionProxy, ConnectionProxy, DeviceProxy, NetworkManagerProxy,
    SettingsProxy, WirelessProxy,
};
use crate::model::{Connection, ConnectionConfig, SecurityProtocol, NOT_COPY_NETWORK_PATH};
use crate::types::{
    AccessPoint, AddFlags, ConnectionFlags, Device, DeviceType, GeneralState, UpdateFlags, SSID,
};
use agama_utils::dbus::get_optional_property;
use semver::Version;
use uuid::Uuid;
use zbus;
use zbus::zvariant::{ObjectPath, OwnedObjectPath};

/// Simplified NetworkManager D-Bus client.
///
/// Implements a minimal API to be used internally. At this point, it allows to query the list of
/// network devices and connections, converting them to its own data types.
pub struct NetworkManagerClient<'a> {
    connection: zbus::Connection,
    nm_proxy: NetworkManagerProxy<'a>,
}

impl<'a> NetworkManagerClient<'a> {
    /// Creates a NetworkManagerClient using the given D-Bus connection.
    ///
    /// * `connection`: D-Bus connection.
    pub async fn new(connection: zbus::Connection) -> Result<NetworkManagerClient<'a>, NmError> {
        Ok(Self {
            nm_proxy: NetworkManagerProxy::new(&connection).await?,
            connection,
        })
    }
    /// Returns the general state
    pub async fn general_state(&self) -> Result<GeneralState, NmError> {
        let proxy = SettingsProxy::new(&self.connection).await?;
        let hostname = proxy.hostname().await?;
        let wireless_enabled = self.nm_proxy.wireless_enabled().await?;
        let networking_enabled = self.nm_proxy.networking_enabled().await?;
        // TODO:: Allow to set global DNS configuration
        // let global_dns_configuration = self.nm_proxy.global_dns_configuration().await?;
        // Fixme: save as NMConnectivityState enum
        let connectivity = self.nm_proxy.connectivity().await? == 4;
        let copy_network = !Path::new(NOT_COPY_NETWORK_PATH).exists();

        Ok(GeneralState {
            hostname,
            wireless_enabled,
            networking_enabled,
            connectivity,
            copy_network,
        })
    }

    /// Updates the general state
    pub async fn update_general_state(&self, state: &GeneralState) -> Result<(), NmError> {
        let wireless_enabled = self.nm_proxy.wireless_enabled().await?;
        let not_copy_path = Path::new(NOT_COPY_NETWORK_PATH);
        let copy_network = !not_copy_path.exists();

        if wireless_enabled != state.wireless_enabled {
            self.nm_proxy
                .set_wireless_enabled(state.wireless_enabled)
                .await?;
        };

        if copy_network != state.copy_network {
            if state.copy_network {
                if let Err(error) = fs::remove_file(not_copy_path) {
                    tracing::error!("Cannot remove {} file {:?}", NOT_COPY_NETWORK_PATH, error);
                }
            } else {
                if let Err(error) = OpenOptions::new()
                    .create(true)
                    .write(true)
                    .open(not_copy_path)
                {
                    tracing::error!("Cannot write {} file {:?}", NOT_COPY_NETWORK_PATH, error);
                }
            };
        };

        Ok(())
    }

    /// Returns the list of access points.
    pub async fn request_scan(&self) -> Result<(), NmError> {
        for path in &self.nm_proxy.get_devices().await? {
            let proxy = DeviceProxy::builder(&self.connection)
                .path(path.as_str())?
                .build()
                .await?;

            let device_type = NmDeviceType(proxy.device_type().await?).try_into();
            if let Ok(DeviceType::Wireless) = device_type {
                let wproxy = WirelessProxy::builder(&self.connection)
                    .path(path.as_str())?
                    .build()
                    .await?;
                wproxy.request_scan(HashMap::new()).await?;
            }
        }

        Ok(())
    }

    /// Returns the list of access points.
    pub async fn access_points(&self) -> Result<Vec<AccessPoint>, NmError> {
        let mut points = vec![];
        for path in &self.nm_proxy.get_devices().await? {
            let proxy = DeviceProxy::builder(&self.connection)
                .path(path.as_str())?
                .build()
                .await?;

            let device_type = NmDeviceType(proxy.device_type().await?).try_into();
            if let Ok(DeviceType::Wireless) = device_type {
                let wproxy = WirelessProxy::builder(&self.connection)
                    .path(path.as_str())?
                    .build()
                    .await?;

                for ap_path in wproxy.access_points().await? {
                    let wproxy = AccessPointProxy::builder(&self.connection)
                        .path(ap_path.as_str())?
                        .build()
                        .await?;

                    let device = proxy.interface().await?;
                    let ssid = SSID(wproxy.ssid().await?);
                    let hw_address = wproxy.hw_address().await?;
                    let strength = wproxy.strength().await?;
                    let flags = wproxy.flags().await?;
                    let rsn_flags = wproxy.rsn_flags().await?;
                    let wpa_flags = wproxy.wpa_flags().await?;

                    points.push(AccessPoint {
                        device,
                        ssid,
                        hw_address,
                        strength,
                        flags,
                        rsn_flags,
                        wpa_flags,
                    })
                }
            }
        }

        Ok(points)
    }

    /// Returns the list of network devices.
    pub async fn devices(&self) -> Result<Vec<Device>, NmError> {
        let mut devs = vec![];
        for path in &self.nm_proxy.get_all_devices().await? {
            let proxy = DeviceProxy::builder(&self.connection)
                .path(path.as_str())?
                .build()
                .await?;

            if let Ok(device) = DeviceFromProxyBuilder::new(&self.connection, &proxy)
                .build()
                .await
            {
                devs.push(device);
            } else {
                tracing::warn!("Ignoring network device on path {}", &path);
            }
        }

        Ok(devs)
    }

    /// Returns the list of network connections.
    pub async fn connections(&self) -> Result<Vec<Connection>, NmError> {
        let mut controlled_by: HashMap<Uuid, String> = HashMap::new();
        let mut uuids_map: HashMap<String, Uuid> = HashMap::new();

        let proxy = SettingsProxy::new(&self.connection).await?;
        let paths = proxy.list_connections().await?;
        let mut connections: Vec<Connection> = Vec::with_capacity(paths.len());
        let states = self.connection_states().await?;
        for path in paths {
            let proxy = ConnectionProxy::builder(&self.connection)
                .path(path.as_str())?
                .build()
                .await?;
            let flags = proxy.flags().await?;
            // https://networkmanager.dev/docs/api/latest/nm-dbus-types.html#NMSettingsConnectionFlags
            if flags & ConnectionFlags::External as u32 != 0 {
                tracing::warn!("Skipped connection because of flags: {}", flags);
                continue;
            }

            let settings = proxy.get_settings().await?;
            let controller = controller_from_dbus(&settings)?;

            match connection_from_dbus(settings) {
                Ok(mut connection) => {
                    let state = states
                        .get(&connection.id)
                        .map(|s| NmConnectionState(s.clone()));
                    if let Some(state) = state {
                        connection.state = state.try_into().unwrap_or_default();
                    }

                    Self::add_secrets(&mut connection.config, &proxy).await?;
                    connection.flags = flags;
                    connection.persistent = flags == 0;

                    if let Some(controller) = controller {
                        controlled_by.insert(connection.uuid, controller);
                    }
                    if let Some(iname) = &connection.interface {
                        uuids_map.insert(iname.to_string(), connection.uuid);
                    }
                    if self.settings_active_connection(path).await?.is_none() {
                        connection.set_down()
                    }
                    connections.push(connection);
                }
                Err(e) => {
                    tracing::warn!("Could not process connection {}: {}", &path, e);
                }
            }
        }

        for conn in connections.iter_mut() {
            if let Some(controller) = controlled_by.get(&conn.uuid) {
                if let Some(iface) = uuids_map.get(controller) {
                    conn.controller = Some(iface.to_owned());
                }
            };
        }

        Ok(connections)
    }

    pub async fn connection_states(&self) -> Result<HashMap<String, u32>, NmError> {
        let mut states = HashMap::new();

        for active_path in &self.nm_proxy.active_connections().await? {
            let proxy = ActiveConnectionProxy::builder(&self.connection)
                .path(active_path.as_str())?
                .build()
                .await?;
            states.insert(proxy.id().await?, proxy.state().await?);
        }

        Ok(states)
    }

    /// Adds or updates a connection if it already exists.
    ///
    /// * `conn`: connection to add or update.
    pub async fn add_or_update_connection(
        &self,
        conn: &Connection,
        controller: Option<&Connection>,
    ) -> Result<(), NmError> {
        let mut new_conn = connection_to_dbus(
            conn,
            controller,
            Version::parse(&self.nm_proxy.version().await?)
                .map_err(NmError::FailedNmVersionParse)?,
        );

        let devices = self.devices().await?;

        let path = if let Ok(proxy) = self.get_connection_proxy(conn.uuid).await {
            let original = proxy.get_settings().await?;
            let merged = merge_dbus_connections(&original, &new_conn)?;
            let persist = if conn.persistent {
                UpdateFlags::ToDisk
            } else {
                UpdateFlags::InMemoryOnly
            };

            proxy
                .update2(merged, persist as u32, Default::default())
                .await?;
            OwnedObjectPath::from(proxy.inner().path().to_owned())
        } else {
            let proxy = SettingsProxy::new(&self.connection).await?;
            // https://networkmanager.dev/docs/api/latest/nm-dbus-types.html#NMSettingsConnectionFlags
            // 0x1 persist to disk, 0x2 memory only
            let persist = if conn.persistent {
                AddFlags::ToDisk
            } else {
                AddFlags::InMemory
            };
            cleanup_dbus_connection(&mut new_conn);
            let (path, _) = proxy
                .add_connection2(new_conn, persist as u32, Default::default())
                .await?;
            path
        };

        // FIXME: Do not like that an activation/deactivation could not apply the changes because of
        // a roolback when calling this method with an error.
        if conn.is_up() {
            if let Some(interface) = &conn.interface {
                for device in devices {
                    if interface != &device.name {
                        continue;
                    }

                    if let Some(device_conn) = device.connection {
                        if device_conn != conn.id {
                            tracing::info!(
                                "Disconnecting {} because the connection is {}",
                                &device_conn,
                                &conn.id,
                            );
                            self.disconnect_device(device.name).await?;
                        }
                    }
                }
            }

            // FIXME: If it is a wireless and wireless is disabled it will fail, and if it is a
            // device which is not available it will also fail.

            tracing::info!("Activating connection {}", &conn.id);
            self.activate_connection(path).await?;
        } else {
            if conn.is_down() || conn.is_removed() {
                tracing::info!("Deactivating connection {}", &conn.id);
                self.deactivate_connection(path).await?;
            }
        }
        Ok(())
    }

    /// Disconnect the device with the given name.
    pub async fn disconnect_device(&self, device: String) -> Result<(), NmError> {
        let proxy = self.get_device_proxy(device.clone()).await?;
        if let Err(e) = proxy.disconnect().await {
            tracing::error!("Error disconnecting {}: {:?}", device, e);
        }

        Ok(())
    }

    /// Removes a network connection.
    pub async fn remove_connection(&self, uuid: Uuid) -> Result<(), NmError> {
        let proxy = self.get_connection_proxy(uuid).await?;
        proxy.delete().await?;
        Ok(())
    }

    /// Creates a checkpoint.
    pub async fn create_checkpoint(&self) -> Result<OwnedObjectPath, NmError> {
        let path = self.nm_proxy.checkpoint_create(&[], 0, 0).await?;
        Ok(path)
    }

    /// Destroys a checkpoint.
    ///
    /// * `checkpoint`: checkpoint's D-Bus path.
    pub async fn destroy_checkpoint(&self, checkpoint: &ObjectPath<'_>) -> Result<(), NmError> {
        self.nm_proxy.checkpoint_destroy(checkpoint).await?;
        Ok(())
    }

    /// Rolls the configuration back to the given checkpoint.
    ///
    /// * `checkpoint`: checkpoint's D-Bus path.
    pub async fn rollback_checkpoint(&self, checkpoint: &ObjectPath<'_>) -> Result<(), NmError> {
        self.nm_proxy.checkpoint_rollback(checkpoint).await?;
        Ok(())
    }

    /// Activates a NetworkManager connection.
    ///
    /// * `path`: D-Bus patch of the connection.
    async fn activate_connection(&self, path: OwnedObjectPath) -> Result<(), NmError> {
        let proxy = NetworkManagerProxy::new(&self.connection).await?;
        let root = ObjectPath::try_from("/").unwrap();
        if let Err(e) = proxy
            .activate_connection(&path.as_ref(), &root, &root)
            .await
        {
            tracing::error!("Could not activate connection {}: {:?}", path, e);
        }

        Ok(())
    }

    /// Deactivates a NetworkManager connection.
    ///
    /// * `path`: D-Bus patch of the connection.
    async fn deactivate_connection(&self, path: OwnedObjectPath) -> Result<(), NmError> {
        let proxy = NetworkManagerProxy::new(&self.connection).await?;

        if let Some(active_connection) = self.settings_active_connection(path.clone()).await? {
            if let Err(e) = proxy
                .deactivate_connection(&active_connection.as_ref())
                .await
            {
                // Ignore ConnectionNotActive error since this just means the state is already correct
                if !e.to_string().contains("ConnectionNotActive") {
                    return Err(NmError::DBus(e));
                }
            }
        }
        Ok(())
    }

    async fn get_connection_proxy(&self, uuid: Uuid) -> Result<ConnectionProxy<'_>, NmError> {
        let proxy = SettingsProxy::new(&self.connection).await?;
        let uuid_s = uuid.to_string();
        let path = proxy.get_connection_by_uuid(uuid_s.as_str()).await?;
        let proxy = ConnectionProxy::builder(&self.connection)
            .path(path)?
            .build()
            .await?;
        Ok(proxy)
    }

    // Returns the DeviceProxy for the given device name
    //
    /// * `name`: Device name.
    async fn get_device_proxy(&self, name: String) -> Result<DeviceProxy<'_>, NmError> {
        let mut device_path: Option<OwnedObjectPath> = None;
        for path in &self.nm_proxy.get_all_devices().await? {
            let proxy = DeviceProxy::builder(&self.connection)
                .path(path.as_str())?
                .build()
                .await?;

            if let Ok(device) = DeviceFromProxyBuilder::new(&self.connection, &proxy)
                .build()
                .await
            {
                if device.name == name {
                    device_path = Some(path.to_owned());
                    break;
                }
            }
        }

        if let Some(path) = device_path {
            Ok(DeviceProxy::builder(&self.connection)
                .path(path)?
                .build()
                .await?)
        } else {
            Err(NmError::InvalidDeviceName(name))
        }
    }

    /// Retrieves the `org.freedesktop.NetworkManager.ActiveConnection` object
    /// path corresponding to a given `org.freedesktop.NetworkManager.Settings` object path.
    ///
    /// # Arguments
    ///
    /// * `path`: D-Bus settings path of the connection
    ///
    /// # Returns
    ///
    /// * `Ok(Some(OwnedObjectPath))` - If the `ActiveConnection` was found.
    /// * `Ok(None)` - If the `ActiveConnection` wasn't found.
    /// * `Err(NmError)` - On an unexpected error.
    async fn settings_active_connection(
        &self,
        path: OwnedObjectPath,
    ) -> Result<Option<OwnedObjectPath>, NmError> {
        for active_path in &self.nm_proxy.active_connections().await? {
            let proxy = ActiveConnectionProxy::builder(&self.connection)
                .path(active_path.as_str())?
                .build()
                .await?;

            match proxy.connection().await {
                /* Don't error out, if the ActiveConnection was deactivated and removed,
                 * after the above call of `nm_proxy.active_connections()` */
                Err(e) => {
                    if !e.to_string().contains("Object does not exist") {
                        return Err(NmError::DBus(e));
                    }
                }
                Ok(connection) => {
                    if path == connection {
                        return Ok(Some(active_path.to_owned()));
                    }
                }
            };
        }

        Ok(None)
    }

    /// Ancillary function to add secrets to a connection.
    ///
    /// TODO: add support for more security protocols.
    pub async fn add_secrets(
        config: &mut ConnectionConfig,
        proxy: &ConnectionProxy<'_>,
    ) -> Result<(), NmError> {
        let ConnectionConfig::Wireless(ref mut wireless) = config else {
            return Ok(());
        };

        if wireless.security == SecurityProtocol::WPA2 {
            match proxy.get_secrets("802-11-wireless-security").await {
                Ok(secrets) => {
                    if let Some(secret) = secrets.get("802-11-wireless-security") {
                        wireless.password = get_optional_property(&secret, "psk")?;
                    }
                }
                Err(error) => {
                    tracing::error!("Could not read connection secrets: {:?}", error);
                }
            }
        }
        Ok(())
    }
}
