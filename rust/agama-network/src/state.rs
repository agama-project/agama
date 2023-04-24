use nmstate;
use std::error::Error;
use thiserror;

#[derive(thiserror::Error, Debug)]
pub enum NetworkStateError {
    #[error("Unknown network interface {0}")]
    UnknownInterface(String),
    #[error("Missing IPv4 data")]
    MissingIpv4Settings,
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
        net_state.set_kernel_only(true);
        net_state.retrieve()?;
        Ok(Self(net_state))
    }

    /// Returns a vector containing the interfaces
    pub fn interfaces(&self) -> Vec<&nmstate::Interface> {
        self.0.interfaces.to_vec()
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
