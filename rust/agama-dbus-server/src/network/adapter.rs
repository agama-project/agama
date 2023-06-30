use crate::network::NetworkState;
use std::error::Error;

/// A trait for the ability to read/write from/to a network service
pub trait Adapter {
    fn read(&self) -> Result<NetworkState, Box<dyn Error>>;
    fn write(&self, network: &NetworkState) -> Result<(), Box<dyn Error>>;
}
