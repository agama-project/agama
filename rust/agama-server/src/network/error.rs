//! Error types.
use thiserror::Error;

/// Errors that are related to the network configuration.
#[derive(Error, Debug)]
pub enum NetworkStateError {
    #[error("Unknown connection '{0}'")]
    UnknownConnection(String),
    #[error("Cannot update connection '{0}'")]
    CannotUpdateConnection(String),
    #[error("Unknown device '{0}'")]
    UnknownDevice(String),
    #[error("Invalid connection UUID: '{0}'")]
    InvalidUuid(String),
    #[error("Invalid IP address: '{0}'")]
    InvalidIpAddr(String),
    #[error("Invalid IP method: '{0}'")]
    InvalidIpMethod(u8),
    #[error("Invalid wireless mode: '{0}'")]
    InvalidWirelessMode(String),
    #[error("Connection '{0}' already exists")]
    ConnectionExists(String),
    #[error("Invalid security wireless protocol: '{0}'")]
    InvalidSecurityProtocol(String),
    #[error("Adapter error: '{0}'")]
    AdapterError(String),
    #[error("Invalid bond mode '{0}'")]
    InvalidBondMode(String),
    #[error("Invalid bond options")]
    InvalidBondOptions,
    #[error("Not a controller connection: '{0}'")]
    NotControllerConnection(String),
    #[error("Unexpected configuration")]
    UnexpectedConfiguration,
    #[error("Invalid WEP authentication algorithm: '{0}'")]
    InvalidWEPAuthAlg(String),
    #[error("Invalid WEP key type: '{0}'")]
    InvalidWEPKeyType(u32),
}

impl From<NetworkStateError> for zbus::fdo::Error {
    fn from(value: NetworkStateError) -> zbus::fdo::Error {
        zbus::fdo::Error::Failed(format!("Network error: {value}"))
    }
}
