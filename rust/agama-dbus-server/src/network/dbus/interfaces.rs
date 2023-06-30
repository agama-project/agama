//! Network D-Bus interfaces.
//!
//! This module contains the set of D-Bus interfaces that are exposed by [D-Bus network
//! service](crate::NetworkService).
use super::ObjectsRegistry;
use crate::network::{
    action::Action,
    error::NetworkStateError,
    model::{Connection as NetworkConnection, Device as NetworkDevice, WirelessConnection},
};

use agama_lib::network::types::SSID;
use parking_lot::{MappedMutexGuard, Mutex, MutexGuard};
use std::{
    net::{AddrParseError, Ipv4Addr},
    sync::{mpsc::Sender, Arc},
};
use uuid::Uuid;
use zbus::{dbus_interface, zvariant::ObjectPath};

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
        let objects = self.objects.lock();
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
    device: NetworkDevice,
}

impl Device {
    /// Creates an interface object.
    ///
    /// * `device`: network device.
    pub fn new(device: NetworkDevice) -> Self {
        Self { device }
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Device")]
impl Device {
    #[dbus_interface(property)]
    pub fn name(&self) -> &str {
        &self.device.name
    }

    #[dbus_interface(property, name = "Type")]
    pub fn device_type(&self) -> u8 {
        self.device.type_ as u8
    }
}

/// D-Bus interface for the set of connections.
///
/// It offers an API to query the connections collection.
pub struct Connections {
    actions: Arc<Mutex<Sender<Action>>>,
    objects: Arc<Mutex<ObjectsRegistry>>,
}

impl Connections {
    /// Creates a Connections interface object.
    ///
    /// * `objects`: Objects paths registry.
    pub fn new(objects: Arc<Mutex<ObjectsRegistry>>, actions: Sender<Action>) -> Self {
        Self {
            objects,
            actions: Arc::new(Mutex::new(actions)),
        }
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Connections")]
impl Connections {
    /// Returns the D-Bus paths of the network connections.
    pub fn get_connections(&self) -> Vec<ObjectPath> {
        let objects = self.objects.lock();
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
        let actions = self.actions.lock();
        actions
            .send(Action::AddConnection(name, ty.try_into()?))
            .unwrap();
        Ok(())
    }

    /// Removes a network connection.
    ///
    /// * `uuid`: connection UUID..
    pub async fn remove_connection(&mut self, uuid: &str) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock();
        let uuid =
            Uuid::parse_str(uuid).map_err(|_| NetworkStateError::InvalidUuid(uuid.to_string()))?;
        actions.send(Action::RemoveConnection(uuid)).unwrap();
        Ok(())
    }

    /// Applies the network configuration.
    ///
    /// It includes adding, updating and removing connections as needed.
    pub async fn apply(&self) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock();
        actions.send(Action::Apply).unwrap();
        Ok(())
    }
}

/// D-Bus interface for a network connection
///
/// It offers an API to query a connection.
pub struct Connection {
    connection: Arc<Mutex<NetworkConnection>>,
}

impl Connection {
    /// Creates a Connection interface object.
    ///
    /// * `connection`: connection to expose over D-Bus.
    pub fn new(connection: Arc<Mutex<NetworkConnection>>) -> Self {
        Self { connection }
    }

    /// Returns the underlying connection.
    fn get_connection(&self) -> MutexGuard<NetworkConnection> {
        self.connection.lock()
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Connection")]
impl Connection {
    #[dbus_interface(property)]
    pub fn id(&self) -> String {
        self.get_connection().id().to_string()
    }

    #[dbus_interface(property, name = "UUID")]
    pub fn uuid(&self) -> String {
        self.get_connection().uuid().to_string()
    }
}

/// D-Bus interface for IPv4 settings
pub struct Ipv4 {
    actions: Arc<Mutex<Sender<Action>>>,
    connection: Arc<Mutex<NetworkConnection>>,
}

impl Ipv4 {
    /// Creates an IPv4 interface object.
    ///
    /// * `actions`: sending-half of a channel to send actions.
    /// * `connection`: connection to expose over D-Bus.
    pub fn new(actions: Sender<Action>, connection: Arc<Mutex<NetworkConnection>>) -> Self {
        Self {
            actions: Arc::new(Mutex::new(actions)),
            connection,
        }
    }

    /// Returns the underlying connection.
    fn get_connection(&self) -> MutexGuard<NetworkConnection> {
        self.connection.lock()
    }

    /// Updates the connection data in the NetworkSystem.
    ///
    /// * `connection`: Updated connection.
    fn update_connection(
        &self,
        connection: MutexGuard<NetworkConnection>,
    ) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock();
        actions
            .send(Action::UpdateConnection(connection.clone()))
            .unwrap();
        Ok(())
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Connection.IPv4")]
impl Ipv4 {
    #[dbus_interface(property)]
    pub fn addresses(&self) -> Vec<(String, u32)> {
        let connection = self.get_connection();
        connection
            .ipv4()
            .addresses
            .iter()
            .map(|(addr, prefix)| (addr.to_string(), *prefix))
            .collect()
    }

    #[dbus_interface(property)]
    pub fn set_addresses(&mut self, addresses: Vec<(String, u32)>) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection();
        addresses
            .iter()
            .map(|(addr, prefix)| addr.parse::<Ipv4Addr>().map(|a| (a, *prefix)))
            .collect::<Result<Vec<(Ipv4Addr, u32)>, AddrParseError>>()
            .and_then(|parsed| Ok(connection.ipv4_mut().addresses = parsed))
            .map_err(|err| NetworkStateError::from(err))?;
        self.update_connection(connection)
    }

    #[dbus_interface(property)]
    pub fn method(&self) -> u8 {
        let connection = self.get_connection();
        connection.ipv4().method as u8
    }

    #[dbus_interface(property)]
    pub fn set_method(&mut self, method: u8) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection();
        connection.ipv4_mut().method = method.try_into()?;
        self.update_connection(connection)
    }

    #[dbus_interface(property)]
    pub fn nameservers(&self) -> Vec<String> {
        let connection = self.get_connection();
        connection
            .ipv4()
            .nameservers
            .iter()
            .map(|a| a.to_string())
            .collect()
    }

    #[dbus_interface(property)]
    pub fn set_nameservers(&mut self, addresses: Vec<String>) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection();
        let ipv4 = connection.ipv4_mut();
        addresses
            .iter()
            .map(|addr| addr.parse::<Ipv4Addr>())
            .collect::<Result<Vec<Ipv4Addr>, AddrParseError>>()
            .and_then(|parsed| Ok(ipv4.nameservers = parsed))
            .map_err(|err| NetworkStateError::from(err))?;
        self.update_connection(connection)
    }

    #[dbus_interface(property)]
    pub fn gateway(&self) -> String {
        let connection = self.get_connection();
        match connection.ipv4().gateway {
            Some(addr) => addr.to_string(),
            None => "".to_string(),
        }
    }

    #[dbus_interface(property)]
    pub fn set_gateway(&mut self, gateway: String) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection();
        let ipv4 = connection.ipv4_mut();
        if gateway.is_empty() {
            ipv4.gateway = None;
        } else {
            let parsed: Ipv4Addr = gateway
                .parse()
                .map_err(|err| NetworkStateError::from(err))?;
            ipv4.gateway = Some(parsed);
        }
        self.update_connection(connection)
    }
}
/// D-Bus interface for wireless settings
pub struct Wireless {
    actions: Arc<Mutex<Sender<Action>>>,
    connection: Arc<Mutex<NetworkConnection>>,
}

impl Wireless {
    /// Creates a Wireless interface object.
    ///
    /// * `actions`: sending-half of a channel to send actions.
    /// * `connection`: connection to expose over D-Bus.
    pub fn new(actions: Sender<Action>, connection: Arc<Mutex<NetworkConnection>>) -> Self {
        Self {
            actions: Arc::new(Mutex::new(actions)),
            connection,
        }
    }

    /// Gets the wireless connection.
    ///
    /// Beware that it crashes when it is not a wireless connection.
    fn get_wireless(&self) -> MappedMutexGuard<WirelessConnection> {
        MutexGuard::map(self.connection.lock(), |c| match c {
            NetworkConnection::Wireless(config) => config,
            _ => panic!("Not a wireless network. This is most probably a bug."),
        })
    }

    /// Updates the connection data in the NetworkSystem.
    ///
    /// * `connection`: Updated connection.
    fn update_connection(
        &self,
        connection: MappedMutexGuard<WirelessConnection>,
    ) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock();
        let connection = NetworkConnection::Wireless(connection.clone());
        actions.send(Action::UpdateConnection(connection)).unwrap();
        Ok(())
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Connection.Wireless")]
impl Wireless {
    #[dbus_interface(property, name = "SSID")]
    pub fn ssid(&self) -> Vec<u8> {
        let connection = self.get_wireless();
        connection.wireless.ssid.clone().into()
    }

    #[dbus_interface(property, name = "SSID")]
    pub fn set_ssid(&mut self, ssid: Vec<u8>) -> zbus::fdo::Result<()> {
        let mut connection = self.get_wireless();
        connection.wireless.ssid = SSID(ssid);
        self.update_connection(connection)
    }

    #[dbus_interface(property)]
    pub fn mode(&self) -> String {
        let connection = self.get_wireless();
        connection.wireless.mode.to_string()
    }

    #[dbus_interface(property)]
    pub fn set_mode(&mut self, mode: &str) -> zbus::fdo::Result<()> {
        let mut connection = self.get_wireless();
        connection.wireless.mode = mode.try_into()?;
        self.update_connection(connection)
    }

    #[dbus_interface(property)]
    pub fn password(&self) -> String {
        let connection = self.get_wireless();
        connection
            .wireless
            .password
            .clone()
            .unwrap_or("".to_string())
    }

    #[dbus_interface(property)]
    pub fn set_password(&mut self, password: String) -> zbus::fdo::Result<()> {
        let mut connection = self.get_wireless();
        connection.wireless.password = if password.is_empty() {
            None
        } else {
            Some(password)
        };
        self.update_connection(connection)
    }

    #[dbus_interface(property)]
    pub fn security(&self) -> String {
        let connection = self.get_wireless();
        connection.wireless.security.to_string()
    }

    #[dbus_interface(property)]
    pub fn set_security(&mut self, security: &str) -> zbus::fdo::Result<()> {
        let mut connection = self.get_wireless();
        connection.wireless.security = security
            .try_into()
            .map_err(|_| NetworkStateError::InvalidSecurityProtocol(security.to_string()))?;
        self.update_connection(connection)?;
        Ok(())
    }
}
