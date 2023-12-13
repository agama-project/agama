//! Error types.
use thiserror::Error;
use uuid::Uuid;

/// Errors that are related to the network configuration.
#[derive(Error, Debug)]
pub enum NetworkStateError {
    #[error("Unknown connection with ID: '{0}'")]
    UnknownConnection(String),
    #[error("Invalid connection UUID: '{0}'")]
    InvalidUuid(String),
    #[error("Invalid IP address: '{0}'")]
    InvalidIpAddr(String),
    #[error("Invalid IP method: '{0}'")]
    InvalidIpMethod(u8),
    #[error("Invalid wireless mode: '{0}'")]
    InvalidWirelessMode(String),
    #[error("Connection '{0}' already exists")]
    UnknownParentKind(String),
    #[error("Connection '{0}' already exists")]
    ConnectionExists(Uuid),
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
    #[error("Missing connection with UUID '{0}'")]
    MissingConnection(Uuid),
}

impl From<NetworkStateError> for zbus::fdo::Error {
    fn from(value: NetworkStateError) -> zbus::fdo::Error {
        zbus::fdo::Error::Failed(format!("Network error: {value}"))
    }
}
