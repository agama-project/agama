//! NetworkManager client.
use std::collections::HashMap;

use super::dbus::{
    cleanup_dbus_connection, connection_from_dbus, connection_to_dbus, controller_from_dbus,
    merge_dbus_connections,
};
use super::model::NmDeviceType;
use super::proxies::{
    AccessPointProxy, ConnectionProxy, DeviceProxy, NetworkManagerProxy, SettingsProxy,
    WirelessProxy,
};
use crate::network::model::{AccessPoint, Connection, Device, GeneralState};
use agama_lib::error::ServiceError;
use agama_lib::network::types::{DeviceType, SSID};
use log;
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
    /// Creates a NetworkManagerClient connecting to the system bus.
    pub async fn from_system() -> Result<NetworkManagerClient<'a>, ServiceError> {
        let connection = zbus::Connection::system().await?;
        Self::new(connection).await
    }

    /// Creates a NetworkManagerClient using the given D-Bus connection.
    ///
    /// * `connection`: D-Bus connection.
    pub async fn new(
        connection: zbus::Connection,
    ) -> Result<NetworkManagerClient<'a>, ServiceError> {
        Ok(Self {
            nm_proxy: NetworkManagerProxy::new(&connection).await?,
            connection,
        })
    }
    /// Returns the general state
    pub async fn general_state(&self) -> Result<GeneralState, ServiceError> {
        let wireless_enabled = self.nm_proxy.wireless_enabled().await?;
        let networking_enabled = self.nm_proxy.networking_enabled().await?;
        // TODO:: Allow to set global DNS configuration
        // let global_dns_configuration = self.nm_proxy.global_dns_configuration().await?;
        // Fixme: save as NMConnectivityState enum
        let connectivity = self.nm_proxy.connectivity().await? == 4;

        Ok(GeneralState {
            wireless_enabled,
            networking_enabled,
            connectivity,
        })
    }

    /// Updates the general state
    pub async fn update_general_state(&self, state: &GeneralState) -> Result<(), ServiceError> {
        let wireless_enabled = self.nm_proxy.wireless_enabled().await?;

        if wireless_enabled != state.wireless_enabled {
            self.nm_proxy
                .set_wireless_enabled(state.wireless_enabled)
                .await?;
        };

        Ok(())
    }

    /// Returns the list of access points.
    pub async fn request_scan(&self) -> Result<(), ServiceError> {
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
    pub async fn access_points(&self) -> Result<Vec<AccessPoint>, ServiceError> {
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

                    let ssid = SSID(wproxy.ssid().await?);
                    let hw_address = wproxy.hw_address().await?;
                    let strength = wproxy.strength().await?;
                    let flags = wproxy.flags().await?;
                    let rsn_flags = wproxy.rsn_flags().await?;
                    let wpa_flags = wproxy.wpa_flags().await?;

                    points.push(AccessPoint {
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
    pub async fn devices(&self) -> Result<Vec<Device>, ServiceError> {
        let mut devs = vec![];
        for path in &self.nm_proxy.get_devices().await? {
            let proxy = DeviceProxy::builder(&self.connection)
                .path(path.as_str())?
                .build()
                .await?;

            let device_name = proxy.interface().await?;
            let device_type = NmDeviceType(proxy.device_type().await?);
            if let Ok(device_type) = device_type.try_into() {
                devs.push(Device {
                    name: device_name,
                    type_: device_type,
                });
            } else {
                // TODO: use a logger
                log::warn!(
                    "Ignoring network device '{}' (unsupported type '{}')",
                    &device_name,
                    &device_type
                );
            }
        }

        Ok(devs)
    }

    /// Returns the list of network connections.
    pub async fn connections(&self) -> Result<Vec<Connection>, ServiceError> {
        let mut controlled_by: HashMap<Uuid, String> = HashMap::new();
        let mut uuids_map: HashMap<String, Uuid> = HashMap::new();

        let proxy = SettingsProxy::new(&self.connection).await?;
        let paths = proxy.list_connections().await?;
        let mut connections: Vec<Connection> = Vec::with_capacity(paths.len());
        for path in paths {
            let proxy = ConnectionProxy::builder(&self.connection)
                .path(path.as_str())?
                .build()
                .await?;
            let settings = proxy.get_settings().await?;

            if let Some(connection) = connection_from_dbus(settings.clone()) {
                if let Some(controller) = controller_from_dbus(&settings) {
                    controlled_by.insert(connection.uuid, controller.to_string());
                }
                if let Some(iname) = &connection.interface {
                    uuids_map.insert(iname.to_string(), connection.uuid);
                }

                connections.push(connection);
            }
        }

        for conn in connections.iter_mut() {
            let Some(interface_name) = controlled_by.get(&conn.uuid) else {
                continue;
            };

            if let Some(uuid) = uuids_map.get(interface_name) {
                conn.controller = Some(*uuid);
            } else {
                log::warn!(
                    "Could not found a connection for the interface '{}' (required by connection '{}')",
                    interface_name,
                    conn.id
                );
            }
        }

        Ok(connections)
    }

    /// Adds or updates a connection if it already exists.
    ///
    /// * `conn`: connection to add or update.
    pub async fn add_or_update_connection(
        &self,
        conn: &Connection,
        controller: Option<&Connection>,
    ) -> Result<(), ServiceError> {
        let mut new_conn = connection_to_dbus(conn, controller);

        let path = if let Ok(proxy) = self.get_connection_proxy(conn.uuid).await {
            let original = proxy.get_settings().await?;
            let merged = merge_dbus_connections(&original, &new_conn);
            proxy.update(merged).await?;
            OwnedObjectPath::from(proxy.path().to_owned())
        } else {
            let proxy = SettingsProxy::new(&self.connection).await?;
            cleanup_dbus_connection(&mut new_conn);
            proxy.add_connection(new_conn).await?
        };

        if conn.is_up() {
            self.activate_connection(path).await?;
        } else {
            //FIXME: This is wrong, deactivate receive an active connection path and this is a
            //settings path
            // self.deactivate_connection(path).await?;
        }
        Ok(())
    }

    /// Removes a network connection.
    pub async fn remove_connection(&self, uuid: Uuid) -> Result<(), ServiceError> {
        let proxy = self.get_connection_proxy(uuid).await?;
        proxy.delete().await?;
        Ok(())
    }

    /// Creates a checkpoint.
    pub async fn create_checkpoint(&self) -> Result<OwnedObjectPath, ServiceError> {
        let path = self.nm_proxy.checkpoint_create(&[], 0, 0).await?;
        Ok(path)
    }

    /// Destroys a checkpoint.
    ///
    /// * `checkpoint`: checkpoint's D-Bus path.
    pub async fn destroy_checkpoint(
        &self,
        checkpoint: &ObjectPath<'_>,
    ) -> Result<(), ServiceError> {
        self.nm_proxy.checkpoint_destroy(checkpoint).await?;
        Ok(())
    }

    /// Rolls the configuration back to the given checkpoint.
    ///
    /// * `checkpoint`: checkpoint's D-Bus path.
    pub async fn rollback_checkpoint(
        &self,
        checkpoint: &ObjectPath<'_>,
    ) -> Result<(), ServiceError> {
        self.nm_proxy.checkpoint_rollback(checkpoint).await?;
        Ok(())
    }

    /// Activates a NetworkManager connection.
    ///
    /// * `path`: D-Bus patch of the connection.
    async fn activate_connection(&self, path: OwnedObjectPath) -> Result<(), ServiceError> {
        let proxy = NetworkManagerProxy::new(&self.connection).await?;
        let root = ObjectPath::try_from("/").unwrap();
        proxy
            .activate_connection(&path.as_ref(), &root, &root)
            .await?;
        Ok(())
    }

    /// Deactivates a NetworkManager connection.
    ///
    /// * `path`: D-Bus patch of the connection.
    async fn deactivate_connection(&self, path: OwnedObjectPath) -> Result<(), ServiceError> {
        let proxy = NetworkManagerProxy::new(&self.connection).await?;
        match proxy.deactivate_connection(&path.as_ref()).await {
            Err(e) => {
                // Ignore ConnectionNotActive error since this just means the state is already correct
                if e.to_string().contains("ConnectionNotActive") {
                    Ok(())
                } else {
                    Err(ServiceError::DBus(e))
                }
            }
            _ => Ok(()),
        }
    }

    async fn get_connection_proxy(&self, uuid: Uuid) -> Result<ConnectionProxy, ServiceError> {
        let proxy = SettingsProxy::new(&self.connection).await?;
        let uuid_s = uuid.to_string();
        let path = proxy.get_connection_by_uuid(uuid_s.as_str()).await?;
        let proxy = ConnectionProxy::builder(&self.connection)
            .path(path)?
            .build()
            .await?;
        Ok(proxy)
    }
}
