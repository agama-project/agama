//! D-Bus interfaces to expose networking settings
use crate::state::{NetworkState, NetworkStateError};
use nmstate;
use std::net::{IpAddr, Ipv4Addr};
use std::sync::{Arc, Mutex};
use zbus::dbus_interface;

/// Device D-Bus interface
///
/// It offers an API to query basic networking devices information (e.g., name, whether it is
/// virtual, etc.).
pub struct Device {
    network: Arc<Mutex<NetworkState>>,
    device_name: String,
}

impl Device {
    pub fn new(network: Arc<Mutex<NetworkState>>, device_name: &str) -> Self {
        Self {
            network,
            device_name: device_name.to_string(),
        }
    }

    pub fn with_device<T, F>(&self, f: F) -> Result<T, NetworkStateError>
    where
        F: FnOnce(&nmstate::Interface) -> T,
    {
        let state = self.network.lock().unwrap();
        let device =
            state
                .get_iface(&self.device_name)
                .ok_or(NetworkStateError::UnknownInterface(
                    self.device_name.to_string(),
                ))?;
        Ok(f(&device))
    }
}

#[dbus_interface(name = "org.opensuse.Agama.Network1.Device")]
impl Device {
    #[dbus_interface(property)]
    pub fn name(&self) -> &str {
        &self.device_name
    }

    #[dbus_interface(property)]
    pub fn is_virtual(&self) -> zbus::fdo::Result<bool> {
        Ok(self.with_device(|dev| dev.is_virtual())?)
    }

    #[dbus_interface(property)]
    pub fn is_up(&self) -> zbus::fdo::Result<bool> {
        Ok(self.with_device(|dev| dev.is_up())?)
    }

    #[dbus_interface(property)]
    pub fn device_type(&self) -> zbus::fdo::Result<String> {
        Ok(self.with_device(|dev| dev.iface_type().to_string())?)
    }
}

/// D-Bus interface for IPv4 settings
pub struct Ipv4 {
    network: Arc<Mutex<NetworkState>>,
    device_name: String,
}

impl Ipv4 {
    pub fn new(network: Arc<Mutex<NetworkState>>, device_name: &str) -> Self {
        Self {
            network,
            device_name: device_name.to_string(),
        }
    }

    pub fn with_ipv4<T, F>(&self, f: F) -> Result<T, NetworkStateError>
    where
        F: Fn(&nmstate::InterfaceIpv4) -> T,
    {
        let state = self.network.lock().unwrap();
        let device =
            state
                .get_iface(&self.device_name)
                .ok_or(NetworkStateError::UnknownInterface(
                    self.device_name.to_string(),
                ))?;

        let ipv4 = &device
            .base_iface()
            .ipv4
            .as_ref()
            .ok_or(NetworkStateError::MissingIpv4Settings)?;
        Ok(f(&ipv4))
    }

    pub fn update_ipv4<F>(&self, set: F) -> Result<(), NetworkStateError>
    where
        F: FnOnce(&mut nmstate::InterfaceIpv4),
    {
        let mut state = self.network.lock().unwrap();
        let device =
            state
                .get_iface(&self.device_name)
                .ok_or(NetworkStateError::UnknownInterface(
                    self.device_name.to_string(),
                ))?;

        let mut cloned_device = device.clone();
        let base_iface = cloned_device.base_iface_mut();
        let ipv4 = base_iface.ipv4.get_or_insert(Default::default());
        set(ipv4);
        state.update_device(cloned_device)?;
        Ok(())
    }
}

type DBusIpv4Addr = (u8, u8, u8, u8, u8);

#[dbus_interface(name = "org.opensuse.Agama.Network1.IPv4")]
impl Ipv4 {
    #[dbus_interface(property)]
    pub async fn enabled(&self) -> zbus::fdo::Result<bool> {
        Ok(self.with_ipv4(|i| i.enabled)?)
    }

    #[dbus_interface(property)]
    pub async fn set_enabled(&mut self, value: bool) -> zbus::fdo::Result<()> {
        Ok(self.update_ipv4(|i| i.enabled = value)?)
    }

    #[dbus_interface(property)]
    pub async fn dhcp(&self) -> zbus::fdo::Result<bool> {
        Ok(self.with_ipv4(|i| i.dhcp.unwrap_or(false))?)
    }

    #[dbus_interface(property)]
    pub async fn set_dhcp(&mut self, value: bool) -> zbus::fdo::Result<()> {
        Ok(self.update_ipv4(|i| i.dhcp = Some(value))?)
    }

    #[dbus_interface(property)]
    pub async fn auto_dns(&self) -> zbus::fdo::Result<bool> {
        Ok(self.with_ipv4(|i| i.auto_dns.unwrap_or(false))?)
    }

    #[dbus_interface(property)]
    pub async fn set_auto_dns(&mut self, value: bool) -> zbus::fdo::Result<()> {
        Ok(self.update_ipv4(|i| i.auto_dns = Some(value))?)
    }

    #[dbus_interface(property)]
    pub async fn addresses(&self) -> zbus::fdo::Result<Vec<(u8, u8, u8, u8, u8)>> {
        let result = self.with_ipv4(|i| match &i.addresses {
            Some(addresses) => addresses
                .iter()
                .filter_map(|a| match a.ip {
                    IpAddr::V4(addr) => {
                        let octets = addr.octets();
                        Some((octets[0], octets[1], octets[2], octets[3], a.prefix_length))
                    }
                    _ => None,
                })
                .collect(),
            None => vec![],
        })?;
        Ok(result)
    }

    pub async fn add_address(&mut self, addr: DBusIpv4Addr) -> zbus::fdo::Result<()> {
        let mut new_address = nmstate::InterfaceIpAddr::default();
        new_address.ip = IpAddr::V4(Ipv4Addr::from([addr.0, addr.1, addr.2, addr.3]));
        new_address.prefix_length = addr.4;
        self.update_ipv4(|i| {
            let addresses = i.addresses.get_or_insert(vec![]);
            addresses.push(new_address);
        })?;
        Ok(())
    }

    pub async fn remove_address(&mut self, index: u32) -> zbus::fdo::Result<()> {
        Ok(self.update_ipv4(|i| {
            if let Some(addresses) = i.addresses.as_mut() {
                addresses.remove(index as usize);
            }
        })?)
    }

    #[dbus_interface(property)]
    pub async fn set_addresses(&mut self, addrs: Vec<DBusIpv4Addr>) -> zbus::fdo::Result<()> {
        let new_addresses: Vec<nmstate::InterfaceIpAddr> = addrs
            .iter()
            .map(|a| {
                let mut new_address = nmstate::InterfaceIpAddr::default();
                new_address.ip = IpAddr::V4(Ipv4Addr::from([a.0, a.1, a.2, a.3]));
                new_address.prefix_length = a.4;
                new_address
            })
            .collect();
        self.update_ipv4(|i| i.addresses = Some(new_addresses))?;
        Ok(())
    }
}
