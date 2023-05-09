//! Error types.
use thiserror::Error;

/// Errors that are related to the network configuration.
#[derive(Error, Debug)]
pub enum NetworkStateError {
    #[error("Invalid device name: '{0}'")]
    UnknownDevice(String),
    #[error("Invalid connection name: '{0}'")]
    UnknownConnection(String),
    #[error("Invalid connection type: '{0}'")]
    InvalidConnectionType(String),
}

impl From<NetworkStateError> for zbus::fdo::Error {
    fn from(value: NetworkStateError) -> zbus::fdo::Error {
        zbus::fdo::Error::Failed(format!("Network error: {}", value.to_string()))
    }
}
