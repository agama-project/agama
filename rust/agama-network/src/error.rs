//! Error types.
use std::net::AddrParseError;

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
    #[error("Invalid IP address")]
    InvalidIpv4Addr(#[from] AddrParseError),
    #[error("Invalid IP method: '{0}'")]
    InvalidIpMethod(u8),
    #[error("Invalid wireless mode: '{0}'")]
    InvalidWirelessMode(u8),
    #[error("Connection '{0}' already exists")]
    ConnectionExists(String),
}

impl From<NetworkStateError> for zbus::fdo::Error {
    fn from(value: NetworkStateError) -> zbus::fdo::Error {
        zbus::fdo::Error::Failed(format!("Network error: {}", value.to_string()))
    }
}
