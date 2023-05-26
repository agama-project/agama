//! NetworkManager error types
use crate::error::NetworkStateError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum NmError {
    #[error("Unsupported IP method: '{0}'")]
    UnsupportedIpMethod(String),
    #[error("Unsupported device type: '{0}'")]
    UnsupportedDeviceType(u32),
}

impl From<NmError> for NetworkStateError {
    fn from(value: NmError) -> NetworkStateError {
        NetworkStateError::AdapterError(value.to_string())
    }
}
