//! NetworkManager client.
use super::dbus::{connection_from_dbus, connection_to_dbus};
use super::model::NmDeviceType;
use super::proxies::{ConnectionProxy, DeviceProxy, NetworkManagerProxy, SettingsProxy};
use crate::model::{Connection, Device};
use agama_lib::error::ServiceError;
use uuid::Uuid;
use zbus;

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

            devs.push(Device {
                name: proxy.interface().await?,
                ty: NmDeviceType(proxy.device_type().await?).into(),
            });
        }

        Ok(devs)
    }

    /// Returns the list of network connections.
    pub async fn connections(&self) -> Result<Vec<Connection>, ServiceError> {
        let proxy = SettingsProxy::new(&self.connection).await?;
        let paths = proxy.list_connections().await?;
        let mut connections: Vec<Connection> = vec![];
        for path in paths {
            let proxy = ConnectionProxy::builder(&self.connection)
                .path(path.as_str())?
                .build()
                .await?;
            let settings = proxy.get_settings().await?;
            if let Some(connection) = connection_from_dbus(settings) {
                connections.push(connection.into());
            }
        }
        Ok(connections)
    }

    /// Adds or updates a connection if it already exists.
    ///
    /// * `conn`: connection to add.
    pub async fn add_or_update_connection(&self, conn: &Connection) -> Result<(), ServiceError> {
        let proxy = SettingsProxy::new(&self.connection).await?;
        let uuid_s = conn.uuid().to_string();
        let conn_dbus = connection_to_dbus(conn);
        if let Ok(path) = proxy.get_connection_by_uuid(uuid_s.as_str()).await {
            let proxy = ConnectionProxy::builder(&self.connection)
                .path(path.as_str())?
                .build()
                .await?;
            proxy.update(conn_dbus).await?;
        } else {
            proxy.add_connection(conn_dbus).await?;
        }
        Ok(())
    }

    /// Removes a network connection.
    pub async fn remove_connection(&self, uuid: Uuid) -> Result<(), ServiceError> {
        let proxy = self.get_connection_proxy(uuid).await?;
        proxy.delete().await?;
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
