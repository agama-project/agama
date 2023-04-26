//! Network data model
//!
//! This module contains the network's data model. It is based on
//! [nmstate](https://crates.io/crates/nmstate), adding some features that Agama need.
use nmstate;
use std::error::Error;
use thiserror;

#[derive(thiserror::Error, Debug)]
pub enum NetworkStateError {
    #[error("Unknown network interface {0}")]
    UnknownInterface(String),
    #[error("Missing IPv4 data")]
    MissingIpv4Settings,
    #[error("Invalid IP address {0}")]
    InvalidIpAddr(String),
}

impl From<NetworkStateError> for zbus::fdo::Error {
    fn from(value: NetworkStateError) -> zbus::fdo::Error {
        zbus::fdo::Error::Failed(format!("Network error: {}", value.to_string()))
    }
}

/// Network configuration, including interfaces, DNS settings, etc.
///
/// It is a wrapper around [nmstate::NetworkState] that adds support for missing stuff in nmstate.
/// It also allows extending the API to fit Agama's use case better.
#[derive(Debug)]
pub struct NetworkState(nmstate::NetworkState);

impl NetworkState {
    /// Retrieves the network state from the underlying system
    pub fn from_system() -> Result<Self, Box<dyn Error>> {
        let mut net_state = nmstate::NetworkState::new();
        net_state.retrieve()?;
        Ok(Self(net_state))
    }

    /// Returns a vector containing known interfaces
    pub fn interfaces(&self) -> &nmstate::Interfaces {
        &self.0.interfaces
    }

    /// Returns the DNS configuration
    pub fn dns(&self) -> &nmstate::DnsState {
        &self.0.dns
    }

    /// Returns the DNS configuration as mutable
    pub fn dns_mut(&mut self) -> &mut nmstate::DnsState {
        &mut self.0.dns
    }

    /// Updates a network device
    ///
    /// If a device with the same name exist, it merge boths devices into one. Otherwise, it adds
    /// the given device.
    ///
    /// * `device`: new device to replace the old one.
    pub fn update_device(&mut self, device: nmstate::Interface) -> Result<(), NetworkStateError> {
        let mut devices = nmstate::Interfaces::new();
        devices.push(device.clone());
        self.0.interfaces.update(&devices);
        Ok(())
    }

    /// Returns a network interface git the given name
    ///
    /// * `name` - Interface name
    pub fn get_iface(&self, name: &str) -> Option<&nmstate::Interface> {
        self.0
            .interfaces
            .get_iface(&name, nmstate::InterfaceType::Unknown)
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_interfaces() {
        let inner_state: nmstate::NetworkState = serde_json::from_str(
            r#"{
              "interfaces": [
                { "name": "eth0", "type": "ethernet" }
              ]
            }"#,
        )
        .unwrap();
        let state = super::NetworkState(inner_state);
        let interfaces = state.interfaces().to_vec();
        assert_eq!(interfaces.len(), 1);
        let eth0 = interfaces.get(0).unwrap();
        assert_eq!(eth0.base_iface().name, "eth0");
        assert_eq!(
            eth0.base_iface().iface_type,
            nmstate::InterfaceType::Ethernet
        );
    }

    #[test]
    fn test_get_iface() {
        let inner_state: nmstate::NetworkState = serde_json::from_str(
            r#"{
              "interfaces": [
                { "name": "eth0", "type": "ethernet" }
              ]
            }"#,
        )
        .unwrap();
        let state = super::NetworkState(inner_state);
        let iface = state.get_iface("eth0").unwrap();
        assert_eq!(iface.base_iface().name, "eth0");
        assert!(state.get_iface("eth1").is_none());
    }
}
