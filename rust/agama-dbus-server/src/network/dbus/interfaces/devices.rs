use crate::network::{dbus::ObjectsRegistry, model::Device as NetworkDevice};
use std::sync::Arc;
use tokio::sync::Mutex;
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
