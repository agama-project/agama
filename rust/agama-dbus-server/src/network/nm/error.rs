//! NetworkManager error types
use crate::network::error::NetworkStateError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum NmError {
    #[error("Unsupported IP method: '{0}'")]
    UnsupportedIpMethod(String),
    #[error("Unsupported device type: '{0}'")]
    UnsupportedDeviceType(u32),
    #[error("Unsupported security protocol: '{0}'")]
    UnsupportedSecurityProtocol(String),
    #[error("Unsupported wireless mode: '{0}'")]
    UnsupporedWirelessMode(String),
}

impl From<NmError> for NetworkStateError {
    fn from(value: NmError) -> NetworkStateError {
        NetworkStateError::AdapterError(value.to_string())
    }
}
