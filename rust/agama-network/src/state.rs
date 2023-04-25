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

/// Network state
///
/// It is a wrapper around `nmstate::NetworkState` that, in the future, will add support for
/// stuff that is missing in nmstate. Additionally, it allows us to extend the API.
#[derive(Debug)]
pub struct NetworkState(nmstate::NetworkState);

impl NetworkState {
    /// Retrieves the network state from the underlying system
    pub fn from_system() -> Result<Self, Box<dyn Error>> {
        let mut net_state = nmstate::NetworkState::new();
        net_state.retrieve()?;
        Ok(Self(net_state))
    }

    /// Returns a vector containing the interfaces
    pub fn interfaces(&self) -> &nmstate::Interfaces {
        &self.0.interfaces
    }

    /// Returns the DnsState
    pub fn dns(&self) -> &nmstate::DnsState {
        &self.0.dns
    }

    /// Returns the DnsState
    pub fn dns_mut(&mut self) -> &mut nmstate::DnsState {
        &mut self.0.dns
    }

    /// Update an interface
    pub fn update_device(&mut self, device: nmstate::Interface) -> Result<(), NetworkStateError> {
        let mut devices = nmstate::Interfaces::new();
        devices.push(device.clone());
        self.0.interfaces.update(&devices);
        Ok(())
    }

    /// Get network interface
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
}
