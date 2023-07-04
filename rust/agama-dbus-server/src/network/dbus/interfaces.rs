//! Network D-Bus interfaces.
//!
//! This module contains the set of D-Bus interfaces that are exposed by [D-Bus network
//! service](crate::NetworkService).
use super::ObjectsRegistry;
use crate::network::{
    action::Action,
    error::NetworkStateError,
    model::{
        Connection as NetworkConnection, Device as NetworkDevice, IpAddress, WirelessConnection,
    },
};
use log;

use agama_lib::network::types::SSID;
use parking_lot::{MappedMutexGuard, Mutex, MutexGuard};
use std::{
    net::{AddrParseError, Ipv4Addr},
    sync::{mpsc::Sender, Arc},
};
use zbus::{
    dbus_interface,
    zvariant::{ObjectPath, OwnedObjectPath},
};

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
    /// Device name.
    ///
    /// Kernel device name, e.g., eth0, enp1s0, etc.
    #[dbus_interface(property)]
    pub fn name(&self) -> &str {
        &self.device.name
    }

    /// Device type.
    ///
    /// Possible values: 0 = loopback, 1 = ethernet, 2 = wireless.
    ///
    /// See [crate::model::DeviceType].
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
    /// * `id`: connection name.
    /// * `ty`: connection type (see [crate::model::DeviceType]).
    pub async fn add_connection(&mut self, id: String, ty: u8) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock();
        actions
            .send(Action::AddConnection(id, ty.try_into()?))
            .unwrap();
        Ok(())
    }

    /// Returns the D-Bus path of the network connection.
    ///
    /// * `id`: connection ID.
    pub async fn get_connection(&self, id: &str) -> zbus::fdo::Result<OwnedObjectPath> {
        let objects = self.objects.lock();
        match objects.connection_path(&id) {
            Some(path) => Ok(path.into()),
            None => Err(NetworkStateError::UnknownConnection(id.to_string()).into()),
        }
    }

    /// Removes a network connection.
    ///
    /// * `uuid`: connection UUID..
    pub async fn remove_connection(&mut self, id: &str) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock();
        actions
            .send(Action::RemoveConnection(id.to_string()))
            .unwrap();
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
    /// Connection ID.
    ///
    /// Unique identifier of the network connection. It may or not be the same that the used by the
    /// backend. For instance, when using NetworkManager (which is the only supported backend by
    /// now), it uses the original ID but appending a number in case the ID is duplicated.
    #[dbus_interface(property)]
    pub fn id(&self) -> String {
        self.get_connection().id().to_string()
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
    /// List of IP addresses.
    ///
    /// When the method is 'auto', these addresses are used as additional addresses.
    #[dbus_interface(property)]
    pub fn addresses(&self) -> Vec<String> {
        let connection = self.get_connection();
        connection
            .ipv4()
            .addresses
            .iter()
            .map(|ip| ip.to_string())
            .collect()
    }

    #[dbus_interface(property)]
    pub fn set_addresses(&mut self, addresses: Vec<String>) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection();
        let parsed: Vec<IpAddress> = addresses
            .into_iter()
            .filter_map(|ip| match ip.parse::<IpAddress>() {
                Ok(address) => Some(address),
                Err(error) => {
                    log::error!("Ignoring the invalid IPv4 address: {} ({})", ip, error);
                    None
                }
            })
            .collect();
        connection.ipv4_mut().addresses = parsed;
        self.update_connection(connection)
    }

    /// IP configuration method.
    ///
    /// Possible values: "disabled", "auto", "manual" or "link-local".
    ///
    /// See [crate::model::IpMethod].
    #[dbus_interface(property)]
    pub fn method(&self) -> String {
        let connection = self.get_connection();
        connection.ipv4().method.to_string()
    }

    #[dbus_interface(property)]
    pub fn set_method(&mut self, method: &str) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection();
        connection.ipv4_mut().method = method.parse()?;
        self.update_connection(connection)
    }

    /// Name server addresses.
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

    /// Network gateway.
    ///
    /// An empty string removes the current value. It is not possible to set a gateway if the
    /// addresses property is empty.
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
    /// Network SSID.
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

    /// Wireless connection mode.
    ///
    /// Possible values: "unknown", "adhoc", "infrastructure", "ap" or "mesh".
    ///
    /// See [crate::model::WirelessMode].
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

    /// Password to connect to the wireless network.
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

    /// Wireless security protocol.
    ///
    /// Possible values: "none", "owe", "ieee8021x", "wpa-psk", "sae", "wpa-eap",
    /// "wpa-eap-suite-b192".
    ///
    /// See [crate::model::WirelessMode].
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
