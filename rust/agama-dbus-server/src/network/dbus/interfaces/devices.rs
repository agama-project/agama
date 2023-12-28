use crate::network::{model::Device as NetworkDevice, Action};
use std::sync::Arc;
use tokio::sync::{mpsc::UnboundedSender, oneshot, Mutex};
use zbus::{dbus_interface, zvariant::OwnedObjectPath};

/// D-Bus interface for the network devices collection
///
/// It offers an API to query the devices collection.
pub struct Devices {
    actions: Arc<Mutex<UnboundedSender<Action>>>,
}

impl Devices {
    /// Creates a Devices interface object.
    ///
    /// * `objects`: Objects paths registry.
    pub fn new(actions: UnboundedSender<Action>) -> Self {
        Self {
            actions: Arc::new(Mutex::new(actions)),
        }
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Network.Devices")]
impl Devices {
    /// Returns the D-Bus paths of the network devices.
    pub async fn get_devices(&self) -> zbus::fdo::Result<Vec<OwnedObjectPath>> {
        let actions = self.actions.lock().await;
        let (tx, rx) = oneshot::channel();
        actions.send(Action::GetDevicesPaths(tx)).unwrap();
        let result = rx.await.unwrap();
        Ok(result)
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
