//! Error types.
use std::net::AddrParseError;
use thiserror::Error;
use uuid::Uuid;

/// Errors that are related to the network configuration.
#[derive(Error, Debug)]
pub enum NetworkStateError {
    #[error("Invalid connection name: '{0}'")]
    UnknownConnection(Uuid),
    #[error("Invalid connection UUID: '{0}'")]
    InvalidUuid(String),
    #[error("Invalid IP address")]
    InvalidIpv4Addr(#[from] AddrParseError),
    #[error("Invalid IP method: '{0}'")]
    InvalidIpMethod(u8),
    #[error("Invalid wireless mode: '{0}'")]
    InvalidWirelessMode(u8),
    #[error("Connection '{0}' already exists")]
    ConnectionExists(Uuid),
    #[error("Invalid device type: '{0}'")]
    InvalidDeviceType(u8),
    #[error("Invalid security wireless protocol: '{0}'")]
    InvalidSecurityProtocol(String),
}

impl From<NetworkStateError> for zbus::fdo::Error {
    fn from(value: NetworkStateError) -> zbus::fdo::Error {
        zbus::fdo::Error::Failed(format!("Network error: {}", value.to_string()))
    }
}
