//! Network D-Bus interfaces.
//!
//! This module contains the set of D-Bus interfaces that are exposed by [D-Bus network
//! service](crate::NetworkService).
use super::ObjectsRegistry;
use crate::{
    error::NetworkStateError,
    model::{Connection as NetworkConnection, Ipv4Config, NetworkState, WirelessConfig},
    nm::NetworkManagerClient,
};
use async_std::task;
use std::{
    net::{AddrParseError, Ipv4Addr},
    sync::{Arc, Mutex},
};
use zbus::{dbus_interface, zvariant::ObjectPath};

/// Implements functions that are common to D-Bus interfaces around connections
trait WithConnection: zbus::Interface {
    /// Returns the mutex around the network state
    fn state(&self) -> &Mutex<NetworkState>;

    /// Returns the name of the connection associated to the D-Bus interface
    fn conn_name(&self) -> &str;

    /// Runs the given function passing the associated connection.
    ///
    /// This code makes sure that the function runs before the MutexGuard (the result of calling
    /// `lock`) is dropped.
    ///
    /// * `func`: function to run.
    fn with_connection<T, F>(&self, func: F) -> zbus::fdo::Result<T>
    where
        F: FnOnce(&NetworkConnection) -> Result<T, NetworkStateError>,
    {
        let state = self.state();
        let mut state = state.lock().unwrap();
        let conn = state.get_connection_mut(&self.conn_name()).ok_or(
            NetworkStateError::UnknownConnection(self.conn_name().to_string()),
        )?;
        Ok(func(conn)?)
    }

    /// Runs the given function on a connection and updates the state.
    ///
    /// The function receives a clone of the connection. If it runs successfully, it replaces the
    /// original connection.
    ///
    /// This code makes sure that the function runs before the MutexGuard (the result of calling
    /// `lock`) is dropped.
    ///
    /// * `func`: function to run which receives a clone of the connection.
    fn with_connection_mut<F>(&self, func: F) -> zbus::fdo::Result<()>
    where
        F: FnOnce(&mut NetworkConnection) -> Result<(), NetworkStateError>,
    {
        let state = self.state();
        let mut state = state.lock().unwrap();
        let conn =
            state
                .get_connection(&self.conn_name())
                .ok_or(NetworkStateError::UnknownConnection(
                    self.conn_name().to_string(),
                ))?;
        let mut new_conn = conn.clone();
        func(&mut new_conn)?;
        state.update_connection(new_conn)?;
        Ok(())
    }
}

/// D-Bus interface for the network devices collection
///
/// It offers an API to query the devices collection.
pub struct Devices {
    objects: Arc<Mutex<ObjectsRegistry>>,
}

impl Devices {
    /// Creates a Devices interface object.
    ///
    /// * `objects`: Objects paths registry.
    pub fn new(objects: Arc<Mutex<ObjectsRegistry>>) -> Self {
        Self { objects }
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Devices")]
impl Devices {
    /// Returns the D-Bus paths of the network devices.
    pub fn get_devices(&self) -> Vec<ObjectPath> {
        let objects = self.objects.lock().unwrap();
        objects
            .devices_paths()
            .iter()
            .filter_map(|c| ObjectPath::try_from(c.clone()).ok())
            .collect()
    }
}

/// D-Bus interface for a network device
///
/// It offers an API to query basic networking devices information (e.g., the name).
pub struct Device {
    network: Arc<Mutex<NetworkState>>,
    device_name: String,
}

impl Device {
    /// Creates an interface object.
    ///
    /// * `network`: network state.
    /// * `device_name`: device name.
    pub fn new(network: Arc<Mutex<NetworkState>>, device_name: &str) -> Self {
        Self {
            network,
            device_name: device_name.to_string(),
        }
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Device")]
impl Device {
    #[dbus_interface(property)]
    pub fn name(&self) -> &str {
        &self.device_name
    }

    #[dbus_interface(property)]
    pub fn device_type(&self) -> zbus::fdo::Result<u8> {
        let state = self.network.lock().unwrap();
        let device =
            state
                .get_device(&self.device_name)
                .ok_or(NetworkStateError::UnknownDevice(
                    self.device_name.to_string(),
                ))?;
        Ok(device.ty as u8)
    }
}

/// D-Bus interface for the set of connections.
///
/// It offers an API to query the connections collection.
pub struct Connections {
    objects: Arc<Mutex<ObjectsRegistry>>,
    network: Arc<Mutex<NetworkState>>,
}

impl Connections {
    /// Creates a Connections interface object.
    ///
    /// * `objects`: Objects paths registry.
    pub fn new(objects: Arc<Mutex<ObjectsRegistry>>, network: Arc<Mutex<NetworkState>>) -> Self {
        Self { objects, network }
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Connections")]
impl Connections {
    /// Returns the D-Bus paths of the network connections.
    pub fn get_connections(&self) -> Vec<ObjectPath> {
        let objects = self.objects.lock().unwrap();
        objects
            .connections_paths()
            .iter()
            .filter_map(|c| ObjectPath::try_from(c.clone()).ok())
            .collect()
    }

    /// Adds a new network connection.
    ///
    /// * `name`: connection name.
    /// * `ty`: connection type (see [crate::model::DeviceType]).
    pub async fn add_connection(&mut self, name: String, ty: u8) -> zbus::fdo::Result<()> {
        let mut state = self.network.lock().unwrap();
        let connection = NetworkConnection::new(name, ty.try_into()?);
        Ok(state.add_connection(connection)?)
    }

    /// Removes a network connection.
    ///
    /// * `name`: connection name.
    pub async fn remove_connection(&mut self, name: String) -> zbus::fdo::Result<()> {
        let mut state = self.network.lock().unwrap();
        Ok(state.remove_connection(&name)?)
    }
}

/// D-Bus interface for a network connection
///
/// It offers an API to query a connection.
pub struct Connection {
    network: Arc<Mutex<NetworkState>>,
    conn_name: String,
}

impl WithConnection for Connection {
    fn state(&self) -> &Mutex<NetworkState> {
        &self.network
    }

    fn conn_name(&self) -> &str {
        &self.conn_name
    }
}

impl Connection {
    /// Creates a Connection interface object.
    ///
    /// * `conn_name`: Connection ID.
    pub fn new(network: Arc<Mutex<NetworkState>>, conn_name: &str) -> Self {
        Self {
            network,
            conn_name: conn_name.to_string(),
        }
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Connection")]
impl Connection {
    #[dbus_interface(property)]
    pub fn id(&self) -> &str {
        &self.conn_name
    }

    #[dbus_interface(property, name = "UUID")]
    pub fn uuid(&self) -> zbus::fdo::Result<String> {
        self.with_connection(|c| Ok(c.uuid().to_string()))
    }

    /// Updates the network connection
    pub async fn update_connection(&self) -> zbus::fdo::Result<()> {
        self.with_connection(|conn| {
            task::block_on(async {
                // workaround for https://users.rust-lang.org/t/manually-drop-mutexguard-still-raise-future-is-not-send-error/70653/1
                if let Ok(client) = NetworkManagerClient::from_system().await {
                    if let Err(e) = client.update_connection(&conn).await {
                        eprintln!("Could not update the connection {}: {}", &self.conn_name, e);
                    }
                }
            });
            Ok(())
        })
    }
}

/// D-Bus interface for IPv4 settings
pub struct Ipv4 {
    network: Arc<Mutex<NetworkState>>,
    conn_name: String,
}

impl Ipv4 {
    /// Creates a Ipv4 interface object.
    ///
    /// * `network`: network state.
    /// * `conn_name`: connection name.
    pub fn new(network: Arc<Mutex<NetworkState>>, conn_name: &str) -> Self {
        Self {
            network,
            conn_name: conn_name.to_string(),
        }
    }

    pub fn with_ipv4<T, F>(&self, func: F) -> zbus::fdo::Result<T>
    where
        F: FnOnce(&Ipv4Config) -> T,
    {
        self.with_connection(|conn| Ok(func(conn.ipv4())))
    }

    pub fn with_ipv4_mut<F>(&self, func: F) -> zbus::fdo::Result<()>
    where
        F: FnOnce(&mut Ipv4Config) -> Result<(), NetworkStateError>,
    {
        Ok(self.with_connection_mut(|conn| func(conn.ipv4_mut()))?)
    }

    pub fn with_connection_mut<F>(&self, func: F) -> zbus::fdo::Result<()>
    where
        F: FnOnce(&mut NetworkConnection) -> Result<(), NetworkStateError>,
    {
        let mut state = self.network.lock().unwrap();
        let conn =
            state
                .get_connection(&self.conn_name)
                .ok_or(NetworkStateError::UnknownConnection(
                    self.conn_name.to_string(),
                ))?;
        let mut new_conn = conn.clone();
        func(&mut new_conn)?;
        state.update_connection(new_conn).unwrap();
        Ok(())
    }
}

impl WithConnection for Ipv4 {
    fn state(&self) -> &Mutex<NetworkState> {
        &self.network
    }

    fn conn_name(&self) -> &str {
        &self.conn_name
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Connection.IPv4")]
impl Ipv4 {
    #[dbus_interface(property)]
    pub fn addresses(&self) -> zbus::fdo::Result<Vec<(String, u32)>> {
        self.with_ipv4(|ipv4| {
            ipv4.addresses
                .iter()
                .map(|(addr, prefix)| (addr.to_string(), *prefix))
                .collect()
        })
    }

    #[dbus_interface(property)]
    pub fn set_addresses(&mut self, addresses: Vec<(String, u32)>) -> zbus::fdo::Result<()> {
        self.with_connection_mut(|conn| {
            addresses
                .iter()
                .map(|(addr, prefix)| addr.parse::<Ipv4Addr>().map(|a| (a, *prefix)))
                .collect::<Result<Vec<(Ipv4Addr, u32)>, AddrParseError>>()
                .and_then(|parsed| Ok(conn.ipv4_mut().addresses = parsed))
                .map_err(|err| NetworkStateError::from(err))
        })
    }

    #[dbus_interface(property)]
    pub fn method(&self) -> zbus::fdo::Result<u8> {
        self.with_ipv4(|ipv4| ipv4.method as u8)
    }

    #[dbus_interface(property)]
    pub fn set_method(&mut self, method: u8) -> zbus::fdo::Result<()> {
        Ok(self.with_ipv4_mut(|ipv4| Ok(ipv4.method = method.try_into()?))?)
    }

    #[dbus_interface(property)]
    pub fn nameservers(&self) -> zbus::fdo::Result<Vec<String>> {
        self.with_ipv4(|ipv4| ipv4.nameservers.iter().map(|a| a.to_string()).collect())
    }

    #[dbus_interface(property)]
    pub fn set_nameservers(&mut self, addresses: Vec<String>) -> zbus::fdo::Result<()> {
        self.with_ipv4_mut(|ipv4| {
            addresses
                .iter()
                .map(|addr| addr.parse::<Ipv4Addr>())
                .collect::<Result<Vec<Ipv4Addr>, AddrParseError>>()
                .and_then(|parsed| Ok(ipv4.nameservers = parsed))
                .map_err(|err| NetworkStateError::from(err))
        })
    }

    #[dbus_interface(property)]
    pub fn gateway(&self) -> zbus::fdo::Result<String> {
        self.with_ipv4(|ipv4| match &ipv4.gateway {
            Some(addr) => addr.to_string(),
            None => "".to_string(),
        })
    }

    #[dbus_interface(property)]
    pub fn set_gateway(&mut self, gateway: String) -> zbus::fdo::Result<()> {
        self.with_ipv4_mut(|ipv4| {
            gateway
                .parse::<Ipv4Addr>()
                .and_then(|parsed| Ok(ipv4.gateway = Some(parsed)))
                .map_err(|err| NetworkStateError::from(err))
        })
    }
}
/// D-Bus interface for wireless settings
pub struct Wireless {
    network: Arc<Mutex<NetworkState>>,
    conn_name: String,
}

impl Wireless {
    /// Creates a Wireless interface object.
    ///
    /// * `network`: network state.
    /// * `conn_name`: connection name.
    pub fn new(network: Arc<Mutex<NetworkState>>, conn_name: &str) -> Self {
        Self {
            network,
            conn_name: conn_name.to_string(),
        }
    }

    pub fn with_wireless<T, F>(&self, func: F) -> zbus::fdo::Result<T>
    where
        F: FnOnce(&WirelessConfig) -> T,
    {
        self.with_connection(|conn| match conn {
            NetworkConnection::Wireless(config) => Ok(func(&config.wireless)),
            _ => Err(NetworkStateError::InvalidConnectionType(self.conn_name().to_string()).into()),
        })
    }

    pub fn with_wireless_mut<F>(&self, func: F) -> zbus::fdo::Result<()>
    where
        F: FnOnce(&mut WirelessConfig) -> Result<(), NetworkStateError>,
    {
        self.with_connection_mut(|conn| match conn {
            NetworkConnection::Wireless(config) => func(&mut config.wireless),
            _ => Err(NetworkStateError::InvalidConnectionType(self.conn_name.to_string()).into()),
        })
    }
}

impl WithConnection for Wireless {
    fn state(&self) -> &Mutex<NetworkState> {
        &self.network
    }

    fn conn_name(&self) -> &str {
        &self.conn_name
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Connection.Wireless")]
impl Wireless {
    #[dbus_interface(property, name = "SSID")]
    pub fn ssid(&self) -> zbus::fdo::Result<Vec<u8>> {
        self.with_wireless(|w| w.ssid.clone())
    }

    #[dbus_interface(property, name = "SSID")]
    pub fn set_ssid(&mut self, ssid: Vec<u8>) -> zbus::fdo::Result<()> {
        Ok(self.with_wireless_mut(|w| Ok(w.ssid = ssid))?)
    }

    #[dbus_interface(property)]
    pub fn mode(&self) -> zbus::fdo::Result<u8> {
        self.with_wireless(|w| w.mode as u8)
    }

    #[dbus_interface(property)]
    pub fn set_mode(&mut self, mode: u8) -> zbus::fdo::Result<()> {
        Ok(self.with_wireless_mut(|w| Ok(w.mode = mode.try_into()?))?)
    }

    #[dbus_interface(property)]
    pub fn password(&self) -> zbus::fdo::Result<String> {
        self.with_wireless(|w| w.password.clone().unwrap_or("".to_string()))
    }

    #[dbus_interface(property)]
    pub fn set_password(&mut self, password: String) -> zbus::fdo::Result<()> {
        self.with_wireless_mut(|w| {
            if password.is_empty() {
                w.password = None;
            } else {
                w.password = Some(password)
            }
            Ok(())
        })?;
        Ok(())
    }

    #[dbus_interface(property)]
    pub fn security(&self) -> zbus::fdo::Result<u8> {
        self.with_wireless(|w| w.security as u8)
    }
}
