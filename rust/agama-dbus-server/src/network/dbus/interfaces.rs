//! Network D-Bus interfaces.
//!
//! This module contains the set of D-Bus interfaces that are exposed by [D-Bus network
//! service](crate::NetworkService).

use super::ObjectsRegistry;
use crate::network::{
    action::Action,
    error::NetworkStateError,
    model::{
        BondConfig, Connection as NetworkConnection, ConnectionConfig, Device as NetworkDevice,
        MacAddress, SecurityProtocol, WirelessConfig, WirelessMode,
    },
};

use agama_lib::network::types::SSID;
use std::{str::FromStr, sync::Arc};
use tokio::sync::{mpsc::UnboundedSender, oneshot};
use tokio::sync::{MappedMutexGuard, Mutex, MutexGuard};
use uuid::Uuid;
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
        self.get_connection().await.id.to_string()
    }

    /// Connection UUID.
    ///
    /// Unique identifier of the network connection. It may or not be the same that the used by the
    /// backend.
    #[dbus_interface(property)]
    pub async fn uuid(&self) -> String {
        self.get_connection().await.uuid.to_string()
    }

    #[dbus_interface(property)]
    pub async fn controller(&self) -> String {
        let connection = self.get_connection().await;
        match connection.controller {
            Some(uuid) => uuid.to_string(),
            None => "".to_string(),
        }
    }

    #[dbus_interface(property)]
    pub async fn interface(&self) -> String {
        let connection = self.get_connection().await;
        connection.interface.as_deref().unwrap_or("").to_string()
    }

    #[dbus_interface(property)]
    pub async fn set_interface(&mut self, name: &str) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection().await;
        connection.interface = Some(name.to_string());
        self.update_connection(connection).await
    }

    /// Custom mac-address
    #[dbus_interface(property)]
    pub async fn mac_address(&self) -> String {
        self.get_connection().await.mac_address.to_string()
    }

    #[dbus_interface(property)]
    pub async fn set_mac_address(&mut self, mac_address: &str) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection().await;
        connection.mac_address = MacAddress::from_str(mac_address)?;
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

/// D-Bus interface for Bond settings.
pub struct Bond {
    actions: Arc<Mutex<UnboundedSender<Action>>>,
    uuid: Uuid,
}

impl Bond {
    /// Creates a Bond interface object.
    ///
    /// * `actions`: sending-half of a channel to send actions.
    /// * `uuid`: connection UUID.
    pub fn new(actions: UnboundedSender<Action>, uuid: Uuid) -> Self {
        Self {
            actions: Arc::new(Mutex::new(actions)),
            uuid,
        }
    }

    /// Gets the connection.
    async fn get_connection(&self) -> Result<NetworkConnection, NetworkStateError> {
        let actions = self.actions.lock().await;
        let (tx, rx) = oneshot::channel();
        actions.send(Action::GetConnection(self.uuid, tx)).unwrap();
        rx.await
            .unwrap()
            .ok_or(NetworkStateError::UnknownConnection(self.uuid.to_string()))
    }

    /// Gets the bonding configuration.
    pub async fn get_config(&self) -> Result<BondConfig, NetworkStateError> {
        let connection = self.get_connection().await?;
        match connection.config {
            ConnectionConfig::Bond(bond) => Ok(bond),
            _ => panic!("Not a bond connection. This is most probably a bug."),
        }
    }

    /// Updates the bond configuration.
    ///
    /// * `func`: function to update the configuration.
    pub async fn update_config<F>(&self, func: F) -> Result<(), NetworkStateError>
    where
        F: FnOnce(&mut BondConfig),
    {
        let mut connection = self.get_connection().await?;
        match &mut connection.config {
            ConnectionConfig::Bond(bond) => func(bond),
            _ => panic!("Not a bond connection. This is most probably a bug."),
        }
        let actions = self.actions.lock().await;
        actions
            .send(Action::UpdateConnection(connection.clone()))
            .unwrap();
        Ok(())
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Network.Connection.Bond")]
impl Bond {
    /// Bonding mode.
    #[dbus_interface(property)]
    pub async fn mode(&self) -> zbus::fdo::Result<String> {
        let config = self.get_config().await?;
        Ok(config.mode.to_string())
    }

    #[dbus_interface(property)]
    pub async fn set_mode(&mut self, mode: &str) -> zbus::fdo::Result<()> {
        let mode = mode.try_into()?;
        self.update_config(|c| c.mode = mode).await?;
        Ok(())
    }

    /// List of bonding options.
    #[dbus_interface(property)]
    pub async fn options(&self) -> zbus::fdo::Result<String> {
        let config = self.get_config().await?;
        Ok(config.options.to_string())
    }

    #[dbus_interface(property)]
    pub async fn set_options(&mut self, opts: &str) -> zbus::fdo::Result<()> {
        let opts = opts.try_into()?;
        self.update_config(|c| c.options = opts).await?;
        Ok(())
    }

    /// List of bond ports.
    ///
    /// For the port names, it uses the interface name (preferred) or, as a fallback,
    /// the connection ID of the port.
    #[dbus_interface(property)]
    pub async fn ports(&self) -> zbus::fdo::Result<Vec<String>> {
        let actions = self.actions.lock().await;
        let (tx, rx) = oneshot::channel();
        actions.send(Action::GetController(self.uuid, tx)).unwrap();

        let (_, ports) = rx.await.unwrap()?;
        Ok(ports)
    }

    #[dbus_interface(property)]
    pub async fn set_ports(&mut self, ports: Vec<String>) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock().await;
        let (tx, rx) = oneshot::channel();
        actions
            .send(Action::SetPorts(self.uuid, ports, tx))
            .unwrap();
        let result = rx.await.unwrap();
        Ok(result?)
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Network.Connection.Match")]
impl Match {
    /// List of driver names to match.
    #[dbus_interface(property)]
    pub async fn driver(&self) -> Vec<String> {
        let connection = self.get_connection().await;
        connection.match_config.driver.clone()
    }

    #[dbus_interface(property)]
    pub async fn set_driver(&mut self, driver: Vec<String>) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection().await;
        connection.match_config.driver = driver;
        self.update_connection(connection).await
    }

    /// List of paths to match agains the ID_PATH udev property of devices.
    #[dbus_interface(property)]
    pub async fn path(&self) -> Vec<String> {
        let connection = self.get_connection().await;
        connection.match_config.path.clone()
    }

    #[dbus_interface(property)]
    pub async fn set_path(&mut self, path: Vec<String>) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection().await;
        connection.match_config.path = path;
        self.update_connection(connection).await
    }
    /// List of interface names to match.
    #[dbus_interface(property)]
    pub async fn interface(&self) -> Vec<String> {
        let connection = self.get_connection().await;
        connection.match_config.interface.clone()
    }

    #[dbus_interface(property)]
    pub async fn set_interface(&mut self, interface: Vec<String>) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection().await;
        connection.match_config.interface = interface;
        self.update_connection(connection).await
    }

    /// List of kernel options to match.
    #[dbus_interface(property)]
    pub async fn kernel(&self) -> Vec<String> {
        let connection = self.get_connection().await;
        connection.match_config.kernel.clone()
    }

    #[dbus_interface(property)]
    pub async fn set_kernel(&mut self, kernel: Vec<String>) -> zbus::fdo::Result<()> {
        let mut connection = self.get_connection().await;
        connection.match_config.kernel = kernel;
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
    async fn get_wireless(&self) -> MappedMutexGuard<WirelessConfig> {
        MutexGuard::map(self.connection.lock().await, |c| match &mut c.config {
            ConnectionConfig::Wireless(config) => config,
            _ => panic!("Not a wireless connection. This is most probably a bug."),
        })
    }

    /// Updates the wireless configuration.
    ///
    /// * `func`: function to update the configuration.
    pub async fn update_config<F>(&self, func: F) -> Result<(), NetworkStateError>
    where
        F: FnOnce(&mut WirelessConfig),
    {
        let mut connection = self.connection.lock().await;
        match &mut connection.config {
            ConnectionConfig::Wireless(wireless) => func(wireless),
            _ => panic!("Not a wireless connection. This is most probably a bug."),
        }
        let actions = self.actions.lock().await;
        actions
            .send(Action::UpdateConnection(connection.clone()))
            .unwrap();
        Ok(())
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Network.Connection.Wireless")]
impl Wireless {
    /// Network SSID.
    #[dbus_interface(property, name = "SSID")]
    pub async fn ssid(&self) -> Vec<u8> {
        let wireless = self.get_wireless().await;
        wireless.ssid.clone().into()
    }

    #[dbus_interface(property, name = "SSID")]
    pub async fn set_ssid(&mut self, ssid: Vec<u8>) -> zbus::fdo::Result<()> {
        self.update_config(|c| c.ssid = SSID(ssid)).await?;
        Ok(())
    }

    /// Wireless connection mode.
    ///
    /// Possible values: "unknown", "adhoc", "infrastructure", "ap" or "mesh".
    ///
    /// See [crate::network::model::WirelessMode].
    #[dbus_interface(property)]
    pub async fn mode(&self) -> String {
        let wireless = self.get_wireless().await;
        wireless.mode.to_string()
    }

    #[dbus_interface(property)]
    pub async fn set_mode(&mut self, mode: &str) -> zbus::fdo::Result<()> {
        let mode: WirelessMode = mode.try_into()?;
        self.update_config(|c| c.mode = mode).await?;
        Ok(())
    }

    /// Password to connect to the wireless network.
    #[dbus_interface(property)]
    pub async fn password(&self) -> String {
        let wireless = self.get_wireless().await;
        wireless.password.clone().unwrap_or("".to_string())
    }

    #[dbus_interface(property)]
    pub async fn set_password(&mut self, password: String) -> zbus::fdo::Result<()> {
        self.update_config(|c| {
            c.password = if password.is_empty() {
                None
            } else {
                Some(password)
            };
        })
        .await?;
        Ok(())
    }

    /// Wireless security protocol.
    ///
    /// Possible values: "none", "owe", "ieee8021x", "wpa-psk", "sae", "wpa-eap",
    /// "wpa-eap-suite-b192".
    ///
    /// See [crate::network::model::SecurityProtocol].
    #[dbus_interface(property)]
    pub async fn security(&self) -> String {
        let wireless = self.get_wireless().await;
        wireless.security.to_string()
    }

    #[dbus_interface(property)]
    pub async fn set_security(&mut self, security: &str) -> zbus::fdo::Result<()> {
        let security: SecurityProtocol = security
            .try_into()
            .map_err(|_| NetworkStateError::InvalidSecurityProtocol(security.to_string()))?;
        self.update_config(|c| c.security = security).await?;
        Ok(())
    }
}
