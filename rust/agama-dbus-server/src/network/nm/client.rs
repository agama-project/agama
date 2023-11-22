//! NetworkManager client.
use std::collections::HashMap;

use super::dbus::{
    connection_from_dbus, connection_to_dbus, controller_from_dbus, merge_dbus_connections,
};
use super::model::NmDeviceType;
use super::proxies::{ConnectionProxy, DeviceProxy, NetworkManagerProxy, SettingsProxy};
use crate::network::model::{Connection, Device};
use agama_lib::error::ServiceError;
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
        let proxy = SettingsProxy::new(&self.connection).await?;
        let paths = proxy.list_connections().await?;
        let mut connections: Vec<Connection> = Vec::with_capacity(paths.len());
        let mut controllers: HashMap<String, Vec<Connection>> = HashMap::new();
        for path in paths {
            let proxy = ConnectionProxy::builder(&self.connection)
                .path(path.as_str())?
                .build()
                .await?;
            let settings = proxy.get_settings().await?;
            // TODO: log an error if a connection is not found

            if let Some(connection) = connection_from_dbus(settings.clone()) {
                if let Some(controller) = controller_from_dbus(settings) {
                    controllers
                        .entry(controller)
                        .or_insert_with(Vec::new)
                        .push(connection)
                } else {
                    connections.push(connection);
                }
            }
        }
        for (controller, conns) in controllers {
            dbg!(controller.to_string());
            for conn in conns {
                dbg!(conn.id().to_string());
            }
        }

        Ok(connections)
    }

    /// Adds or updates a connection if it already exists.
    ///
    /// * `conn`: connection to add or update.
    pub async fn add_or_update_connection(&self, conn: &Connection) -> Result<(), ServiceError> {
        let new_conn = connection_to_dbus(conn);

        let path = if let Ok(proxy) = self.get_connection_proxy(conn.uuid()).await {
            let original = proxy.get_settings().await?;
            let merged = merge_dbus_connections(&original, &new_conn);
            proxy.update(merged).await?;
            OwnedObjectPath::from(proxy.path().to_owned())
        } else {
            let proxy = SettingsProxy::new(&self.connection).await?;
            proxy.add_connection(new_conn).await?
        };

        if let Connection::Bond(bond) = conn {
            let _ = bond.bond.ports.iter().map(|port| {
                self.add_or_update_port_connection(
                    port,
                    bond.base.interface.to_string(),
                    "bond".to_string(),
                )
            });
        }

        self.activate_connection(path).await?;
        Ok(())
    }

    pub async fn add_or_update_port_connection(
        &self,
        conn: &Connection,
        controller: String,
        port_type: String,
    ) -> Result<(), ServiceError> {
        let mut dbus_conn = connection_to_dbus(conn);
        if let Some(new_conn) = dbus_conn.get_mut("connection") {
            new_conn.insert("slave-type", port_type.to_string().into());
            new_conn.insert("master", controller.to_string().into());
        }

        let path = if let Ok(proxy) = self.get_connection_proxy(conn.uuid()).await {
            let original = proxy.get_settings().await?;
            let merged = merge_dbus_connections(&original, &dbus_conn);
            proxy.update(merged).await?;
            OwnedObjectPath::from(proxy.path().to_owned())
        } else {
            let proxy = SettingsProxy::new(&self.connection).await?;
            proxy.add_connection(dbus_conn).await?
        };

        if let Connection::Bond(bond) = conn {
            let _ = bond.bond.ports.iter().map(|port| {
                self.add_or_update_port_connection(
                    port,
                    bond.base.interface.to_string(),
                    "bond".to_string(),
                )
            });
        }
        self.activate_connection(path).await?;
        Ok(())
    }

    /// Removes a network connection.
    pub async fn remove_connection(&self, uuid: Uuid) -> Result<(), ServiceError> {
        let proxy = self.get_connection_proxy(uuid).await?;
        proxy.delete().await?;
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
