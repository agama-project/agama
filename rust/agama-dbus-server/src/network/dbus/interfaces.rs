//! Network D-Bus interfaces.
//!
//! This module contains the set of D-Bus interfaces that are exposed by [D-Bus network
//! service](crate::NetworkService).

use super::ObjectsRegistry;
use crate::network::{
    action::Action,
    error::NetworkStateError,
    model::{
        BondConnection, Connection as NetworkConnection, Device as NetworkDevice,
        WirelessConnection,
    },
};

use agama_lib::network::types::SSID;
use std::sync::Arc;
use tokio::sync::mpsc::UnboundedSender;
use tokio::sync::{MappedMutexGuard, Mutex, MutexGuard};
use zbus::{
    dbus_interface,
    zvariant::{ObjectPath, OwnedObjectPath},
    SignalContext,
};

mod ip_config;
pub use ip_config::Ip;

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

#[dbus_interface(name = "org.opensuse.Agama1.Network.Devices")]
impl Devices {
    /// Returns the D-Bus paths of the network devices.
    pub async fn get_devices(&self) -> Vec<ObjectPath> {
        let objects = self.objects.lock().await;
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

#[dbus_interface(name = "org.opensuse.Agama1.Network.Device")]
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
    /// See [agama_lib::network::types::DeviceType].
    #[dbus_interface(property, name = "Type")]
    pub fn device_type(&self) -> u8 {
        self.device.type_ as u8
    }
}

/// D-Bus interface for the set of connections.
///
/// It offers an API to query the connections collection.
pub struct Connections {
    actions: Arc<Mutex<UnboundedSender<Action>>>,
    objects: Arc<Mutex<ObjectsRegistry>>,
}

impl Connections {
    /// Creates a Connections interface object.
    ///
    /// * `objects`: Objects paths registry.
    pub fn new(objects: Arc<Mutex<ObjectsRegistry>>, actions: UnboundedSender<Action>) -> Self {
        Self {
            objects,
            actions: Arc::new(Mutex::new(actions)),
        }
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Network.Connections")]
impl Connections {
    /// Returns the D-Bus paths of the network connections.
    pub async fn get_connections(&self) -> Vec<ObjectPath> {
        let objects = self.objects.lock().await;
        objects
            .connections_paths()
            .iter()
            .filter_map(|c| ObjectPath::try_from(c.clone()).ok())
            .collect()
    }

    /// Adds a new network connection.
    ///
    /// * `id`: connection name.
    /// * `ty`: connection type (see [agama_lib::network::types::DeviceType]).
    pub async fn add_connection(&mut self, id: String, ty: u8) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock().await;
        actions
            .send(Action::AddConnection(id.clone(), ty.try_into()?))
            .unwrap();
        Ok(())
    }

    /// Returns the D-Bus path of the network connection.
    ///
    /// * `id`: connection ID.
    pub async fn get_connection(&self, id: &str) -> zbus::fdo::Result<OwnedObjectPath> {
        let objects = self.objects.lock().await;
        match objects.connection_path(id) {
            Some(path) => Ok(path.into()),
            None => Err(NetworkStateError::UnknownConnection(id.to_string()).into()),
        }
    }

    /// Removes a network connection.
    ///
    /// * `uuid`: connection UUID..
    pub async fn remove_connection(&mut self, id: &str) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock().await;
        actions
            .send(Action::RemoveConnection(id.to_string()))
            .unwrap();
        Ok(())
    }

    /// Applies the network configuration.
    ///
    /// It includes adding, updating and removing connections as needed.
    pub async fn apply(&self) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock().await;
        actions.send(Action::Apply).unwrap();
        Ok(())
    }

    /// Notifies than a new interface has been added.
    #[dbus_interface(signal)]
    pub async fn connection_added(
        ctxt: &SignalContext<'_>,
        id: &str,
        path: &ObjectPath<'_>,
    ) -> zbus::Result<()>;
}

/// D-Bus interface for a network connection
///
/// It offers an API to query a connection.
pub struct Connection {
    actions: Arc<Mutex<UnboundedSender<Action>>>,
    connection: Arc<Mutex<NetworkConnection>>,
}

impl Connection {
    /// Creates a Connection interface object.
    ///
    /// * `actions`: sending-half of a channel to send actions.
    /// * `connection`: connection to expose over D-Bus.
    pub fn new(
        actions: UnboundedSender<Action>,
        connection: Arc<Mutex<NetworkConnection>>,
    ) -> Self {
        Self {
            actions: Arc::new(Mutex::new(actions)),
            connection,
        }
    }

    /// Returns the underlying connection.
    async fn get_connection(&self) -> MutexGuard<NetworkConnection> {
        self.connection.lock().await
    }

    /// Updates the connection data in the NetworkSystem.
    ///
    /// * `connection`: Updated connection.
    async fn update_connection<'a>(
        &self,
        connection: MutexGuard<'a, NetworkConnection>,
    ) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock().await;
        actions
            .send(Action::UpdateConnection(connection.clone()))
            .unwrap();
        Ok(())
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Network.Connection")]
impl Connection {
    /// Connection ID.
    ///
    /// Unique identifier of the network connection. It may or not be the same that the used by the
    /// backend. For instance, when using NetworkManager (which is the only supported backend by
    /// now), it uses the original ID but appending a number in case the ID is duplicated.
    #[dbus_interface(property)]
    pub async fn id(&self) -> String {
        self.get_connection().await.id().to_string()
    }

    #[dbus_interface(property)]
    pub async fn interface(&self) -> String {
        self.get_connection().await.interface().to_string()
    }

    #[dbus_interface(property)]
    pub async fn set_interface(&mut self, name: &str) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection().await;
        connection.set_interface(name);
        self.update_connection(connection).await
    }
}

/// D-Bus interface for Match settings
pub struct Match {
    actions: Arc<Mutex<UnboundedSender<Action>>>,
    connection: Arc<Mutex<NetworkConnection>>,
}

impl Match {
    /// Creates a Match Settings interface object.
    ///
    /// * `actions`: sending-half of a channel to send actions.
    /// * `connection`: connection to expose over D-Bus.
    pub fn new(
        actions: UnboundedSender<Action>,
        connection: Arc<Mutex<NetworkConnection>>,
    ) -> Self {
        Self {
            actions: Arc::new(Mutex::new(actions)),
            connection,
        }
    }

    /// Returns the underlying connection.
    async fn get_connection(&self) -> MutexGuard<NetworkConnection> {
        self.connection.lock().await
    }

    /// Updates the connection data in the NetworkSystem.
    ///
    /// * `connection`: Updated connection.
    async fn update_connection<'a>(
        &self,
        connection: MutexGuard<'a, NetworkConnection>,
    ) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock().await;
        actions
            .send(Action::UpdateConnection(connection.clone()))
            .unwrap();
        Ok(())
    }
}

/// D-Bus interface for Bond settings
pub struct Bond {
    actions: Arc<Mutex<UnboundedSender<Action>>>,
    connection: Arc<Mutex<NetworkConnection>>,
}

impl Bond {
    /// Creates a Match Settings interface object.
    ///
    /// * `actions`: sending-half of a channel to send actions.
    /// * `connection`: connection to expose over D-Bus.
    pub fn new(
        actions: UnboundedSender<Action>,
        connection: Arc<Mutex<NetworkConnection>>,
    ) -> Self {
        Self {
            actions: Arc::new(Mutex::new(actions)),
            connection,
        }
    }

    /// Gets the bond connection.
    ///
    /// Beware that it crashes when it is not a bond connection.
    async fn get_bond(&self) -> MappedMutexGuard<BondConnection> {
        MutexGuard::map(self.connection.lock().await, |c| match c {
            NetworkConnection::Bond(config) => config,
            _ => panic!("Not a bond connection. This is most probably a bug."),
        })
    }

    /// Updates the connection data in the NetworkSystem.
    ///
    /// * `connection`: Updated connection.
    async fn update_connection<'a>(
        &self,
        connection: MappedMutexGuard<'a, BondConnection>,
    ) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock().await;
        let connection = NetworkConnection::Bond(connection.clone());
        actions.send(Action::UpdateConnection(connection)).unwrap();
        Ok(())
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Network.Connection.Bond")]
impl Bond {
    /// Bonding mode
    #[dbus_interface(property)]
    pub async fn mode(&self) -> String {
        let connection = self.get_bond().await;
        connection.bond.mode.to_string()
    }

    #[dbus_interface(property)]
    pub async fn set_mode(&mut self, mode: &str) -> zbus::fdo::Result<()> {
        let mut connection = self.get_bond().await;
        connection.set_mode(mode.try_into()?);
        self.update_connection(connection).await
    }

    /// List of bond ports.
    #[dbus_interface(property)]
    pub async fn options(&self) -> String {
        let connection = self.get_bond().await;
        connection.bond.options.to_string()
    }

    #[dbus_interface(property)]
    pub async fn set_options(&mut self, opts: &str) -> zbus::fdo::Result<()> {
        let mut connection = self.get_bond().await;
        connection.set_options(opts.try_into()?);
        self.update_connection(connection).await
    }

    /// List of bond ports.
    #[dbus_interface(property)]
    pub async fn ports(&self) -> Vec<String> {
        let connection = self.get_bond().await;
        connection.bond.ports.clone()
    }

    #[dbus_interface(property)]
    pub async fn set_ports(&mut self, ports: Vec<String>) -> zbus::fdo::Result<()> {
        let mut connection = self.get_bond().await;
        connection.set_ports(ports);
        self.update_connection(connection).await
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Network.Connection.Match")]
impl Match {
    /// List of driver names to match.
    #[dbus_interface(property)]
    pub async fn driver(&self) -> Vec<String> {
        let connection = self.get_connection().await;
        connection.match_config().driver.clone()
    }

    #[dbus_interface(property)]
    pub async fn set_driver(&mut self, driver: Vec<String>) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection().await;
        let config = connection.match_config_mut();
        config.driver = driver;
        self.update_connection(connection).await
    }

    /// List of paths to match agains the ID_PATH udev property of devices.
    #[dbus_interface(property)]
    pub async fn path(&self) -> Vec<String> {
        let connection = self.get_connection().await;
        connection.match_config().path.clone()
    }

    #[dbus_interface(property)]
    pub async fn set_path(&mut self, path: Vec<String>) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection().await;
        let config = connection.match_config_mut();
        config.path = path;
        self.update_connection(connection).await
    }
    /// List of interface names to match.
    #[dbus_interface(property)]
    pub async fn interface(&self) -> Vec<String> {
        let connection = self.get_connection().await;
        connection.match_config().interface.clone()
    }

    #[dbus_interface(property)]
    pub async fn set_interface(&mut self, interface: Vec<String>) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection().await;
        let config = connection.match_config_mut();
        config.interface = interface;
        self.update_connection(connection).await
    }

    /// List of kernel options to match.
    #[dbus_interface(property)]
    pub async fn kernel(&self) -> Vec<String> {
        let connection = self.get_connection().await;
        connection.match_config().kernel.clone()
    }

    #[dbus_interface(property)]
    pub async fn set_kernel(&mut self, kernel: Vec<String>) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection().await;
        let config = connection.match_config_mut();
        config.kernel = kernel;
        self.update_connection(connection).await
    }
}

/// D-Bus interface for wireless settings
pub struct Wireless {
    actions: Arc<Mutex<UnboundedSender<Action>>>,
    connection: Arc<Mutex<NetworkConnection>>,
}

impl Wireless {
    /// Creates a Wireless interface object.
    ///
    /// * `actions`: sending-half of a channel to send actions.
    /// * `connection`: connection to expose over D-Bus.
    pub fn new(
        actions: UnboundedSender<Action>,
        connection: Arc<Mutex<NetworkConnection>>,
    ) -> Self {
        Self {
            actions: Arc::new(Mutex::new(actions)),
            connection,
        }
    }

    /// Gets the wireless connection.
    ///
    /// Beware that it crashes when it is not a wireless connection.
    async fn get_wireless(&self) -> MappedMutexGuard<WirelessConnection> {
        MutexGuard::map(self.connection.lock().await, |c| match c {
            NetworkConnection::Wireless(config) => config,
            _ => panic!("Not a wireless network. This is most probably a bug."),
        })
    }

    /// Updates the connection data in the NetworkSystem.
    ///
    /// * `connection`: Updated connection.
    async fn update_connection<'a>(
        &self,
        connection: MappedMutexGuard<'a, WirelessConnection>,
    ) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock().await;
        let connection = NetworkConnection::Wireless(connection.clone());
        actions.send(Action::UpdateConnection(connection)).unwrap();
        Ok(())
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Network.Connection.Wireless")]
impl Wireless {
    /// Network SSID.
    #[dbus_interface(property, name = "SSID")]
    pub async fn ssid(&self) -> Vec<u8> {
        let connection = self.get_wireless().await;
        connection.wireless.ssid.clone().into()
    }

    #[dbus_interface(property, name = "SSID")]
    pub async fn set_ssid(&mut self, ssid: Vec<u8>) -> zbus::fdo::Result<()> {
        let mut connection = self.get_wireless().await;
        connection.wireless.ssid = SSID(ssid);
        self.update_connection(connection).await
    }

    /// Wireless connection mode.
    ///
    /// Possible values: "unknown", "adhoc", "infrastructure", "ap" or "mesh".
    ///
    /// See [crate::network::model::WirelessMode].
    #[dbus_interface(property)]
    pub async fn mode(&self) -> String {
        let connection = self.get_wireless().await;
        connection.wireless.mode.to_string()
    }

    #[dbus_interface(property)]
    pub async fn set_mode(&mut self, mode: &str) -> zbus::fdo::Result<()> {
        let mut connection = self.get_wireless().await;
        connection.wireless.mode = mode.try_into()?;
        self.update_connection(connection).await
    }

    /// Password to connect to the wireless network.
    #[dbus_interface(property)]
    pub async fn password(&self) -> String {
        let connection = self.get_wireless().await;
        connection
            .wireless
            .password
            .clone()
            .unwrap_or("".to_string())
    }

    #[dbus_interface(property)]
    pub async fn set_password(&mut self, password: String) -> zbus::fdo::Result<()> {
        let mut connection = self.get_wireless().await;
        connection.wireless.password = if password.is_empty() {
            None
        } else {
            Some(password)
        };
        self.update_connection(connection).await
    }

    /// Wireless security protocol.
    ///
    /// Possible values: "none", "owe", "ieee8021x", "wpa-psk", "sae", "wpa-eap",
    /// "wpa-eap-suite-b192".
    ///
    /// See [crate::network::model::SecurityProtocol].
    #[dbus_interface(property)]
    pub async fn security(&self) -> String {
        let connection = self.get_wireless().await;
        connection.wireless.security.to_string()
    }

    #[dbus_interface(property)]
    pub async fn set_security(&mut self, security: &str) -> zbus::fdo::Result<()> {
        let mut connection = self.get_wireless().await;
        connection.wireless.security = security
            .try_into()
            .map_err(|_| NetworkStateError::InvalidSecurityProtocol(security.to_string()))?;
        self.update_connection(connection).await
    }
}
