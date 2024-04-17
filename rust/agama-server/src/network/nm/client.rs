//! NetworkManager client.
use std::{collections::HashMap, net::IpAddr, str::FromStr};

use super::dbus::{
    cleanup_dbus_connection, connection_from_dbus, connection_to_dbus, controller_from_dbus,
    merge_dbus_connections,
};
use super::model::NmDeviceType;
use super::proxies::{
    AccessPointProxy, ActiveConnectionProxy, ConnectionProxy, DeviceProxy, IP4ConfigProxy,
    IP6ConfigProxy, NetworkManagerProxy, SettingsProxy, WirelessProxy,
};
use crate::network::model::{
    AccessPoint, Connection, Device, GeneralState, IpConfig, IpRoute, MacAddress,
};
use agama_lib::error::ServiceError;
use agama_lib::network::types::{DeviceType, SSID};
use cidr::IpInet;
use log;
use macaddr::MacAddr6;
use uuid::Uuid;
use zbus;
use zbus::fdo::DBusProxy;
use zbus::zvariant::{self, ObjectPath, OwnedObjectPath};

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
        let proxy = SettingsProxy::new(&self.connection).await?;
        let hostname = proxy.hostname().await?;
        let wireless_enabled = self.nm_proxy.wireless_enabled().await?;
        let networking_enabled = self.nm_proxy.networking_enabled().await?;
        // TODO:: Allow to set global DNS configuration
        // let global_dns_configuration = self.nm_proxy.global_dns_configuration().await?;
        // Fixme: save as NMConnectivityState enum
        let connectivity = self.nm_proxy.connectivity().await? == 4;

        Ok(GeneralState {
            hostname,
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

    pub fn mac_address_from_dbus(&self, mac: &str) -> MacAddress {
        match MacAddress::from_str(mac) {
            Ok(mac) => mac,
            Err(_) => {
                log::warn!("Unable to parse mac {}", &mac);
                MacAddress::Unset
            }
        }
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
            let ip4_path = proxy.ip4_config().await?;
            let ip6_path = proxy.ip6_config().await?;
            let ip4_proxy = IP4ConfigProxy::builder(&self.connection)
                .path(ip4_path.as_str())?
                .build()
                .await?;

            let ip6_proxy = IP6ConfigProxy::builder(&self.connection)
                .path(ip6_path.as_str())?
                .build()
                .await?;

            let state = proxy.state().await?;
            let mac_address = self.mac_address_from_dbus(proxy.hw_address().await?.as_str());
            let ip_config = if state == 100 {
                let config = &self.ip_config_for(ip4_proxy, ip6_proxy).await?;

                Some(config.to_owned())
            } else {
                None
            };

            let connection = match proxy.get_applied_connection(0).await {
                Ok((conn, _)) => self.connection_id(conn),
                Err(_) => None,
            };

            if let Ok(device_type) = device_type.try_into() {
                let device = Device {
                    name: device_name,
                    type_: device_type,
                    mac_address,
                    ip_config,
                    connection,
                };
                devs.push(device);
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

    pub fn connection_id(
        &self,
        connection_data: HashMap<String, HashMap<String, zbus::zvariant::OwnedValue>>,
    ) -> Option<String> {
        let connection = connection_data.get("connection")?;
        let id: &str = connection.get("id")?.downcast_ref()?;

        Some(id.to_string())
    }

    pub fn address_with_prefix_from_dbus(
        &self,
        address_data: HashMap<String, zbus::zvariant::OwnedValue>,
    ) -> Option<IpInet> {
        let addr_str: &str = address_data.get("address")?.downcast_ref()?;
        let prefix: &u32 = address_data.get("prefix")?.downcast_ref()?;
        let prefix = *prefix as u8;
        let address = IpInet::new(addr_str.parse().unwrap(), prefix).ok()?;
        Some(address)
    }

    pub fn nameserver_from_dbus(
        &self,
        nameserver_data: HashMap<String, zbus::zvariant::OwnedValue>,
    ) -> Option<IpAddr> {
        let addr_str: &str = nameserver_data.get("address")?.downcast_ref()?;
        Some(addr_str.parse().unwrap())
    }

    pub fn route_from_dbus(
        &self,
        route_data: HashMap<String, zbus::zvariant::OwnedValue>,
    ) -> Option<IpRoute> {
        let dest_str: &str = route_data.get("dest")?.downcast_ref()?;
        let prefix: u8 = *route_data.get("prefix")?.downcast_ref::<u32>()? as u8;
        let destination = IpInet::new(dest_str.parse().unwrap(), prefix).ok()?;
        let mut new_route = IpRoute {
            destination,
            next_hop: None,
            metric: None,
        };

        if let Some(next_hop) = route_data.get("next-hop") {
            let next_hop_str: &str = next_hop.downcast_ref()?;
            new_route.next_hop = Some(IpAddr::from_str(next_hop_str).unwrap());
        }
        if let Some(metric) = route_data.get("metric") {
            let metric: u32 = *metric.downcast_ref()?;
            new_route.metric = Some(metric);
        }

        Some(new_route)
    }

    pub async fn ip_config_for(
        &self,
        ip4_proxy: IP4ConfigProxy<'_>,
        ip6_proxy: IP6ConfigProxy<'_>,
    ) -> Result<IpConfig, ServiceError> {
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

        let ip4_gateway = ip4_proxy.gateway().await?;
        let ip6_gateway = ip6_proxy.gateway().await?;

        let mut ip_config = IpConfig {
            addresses,
            nameservers,
            ..Default::default()
        };

        if !ip4_gateway.is_empty() {
            ip_config.gateway4 = Some(ip4_gateway.parse().unwrap());
        };
        if !ip6_gateway.is_empty() {
            ip_config.gateway6 = Some(ip6_gateway.parse().unwrap());
        };

        if !routes4.is_empty() {
            ip_config.routes4 = Some(routes4);
        }

        if !routes6.is_empty() {
            ip_config.routes6 = Some(routes6);
        }

        Ok(ip_config)
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

            if let Some(mut connection) = connection_from_dbus(settings.clone()) {
                if let Some(controller) = controller_from_dbus(&settings) {
                    controlled_by.insert(connection.uuid, controller.to_string());
                }
                if let Some(iname) = &connection.interface {
                    uuids_map.insert(iname.to_string(), connection.uuid);
                }

                if self.settings_active_connection(path).await?.is_none() {
                    connection.set_down()
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
            self.deactivate_connection(path).await?;
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

        if let Some(active_connection) = self.settings_active_connection(path.clone()).await? {
            if let Err(e) = proxy
                .deactivate_connection(&active_connection.as_ref())
                .await
            {
                // Ignore ConnectionNotActive error since this just means the state is already correct
                if !e.to_string().contains("ConnectionNotActive") {
                    return Err(ServiceError::DBus(e));
                }
            }
        }
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

    async fn settings_active_connection(
        &self,
        path: OwnedObjectPath,
    ) -> Result<Option<OwnedObjectPath>, ServiceError> {
        for active_path in &self.nm_proxy.active_connections().await? {
            let proxy = ActiveConnectionProxy::builder(&self.connection)
                .path(active_path.as_str())?
                .build()
                .await?;

            let connection = proxy.connection().await?;
            if path == connection {
                return Ok(Some(active_path.to_owned()));
            };
        }

        Ok(None)
    }
}
