use crate::network::NetworkState;
use agama_lib::error::ServiceError;
use async_trait::async_trait;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum NetworkAdapterError {
    #[error("Could not read the network configuration: {0}")]
    Read(ServiceError),
    #[error("Could not update the network configuration: {0}")]
    Write(ServiceError),
    #[error("Checkpoint handling error: {0}")]
    Checkpoint(ServiceError), // only relevant for adapters that implement a checkpoint mechanism
}

/// A trait for the ability to read/write from/to a network service
#[async_trait]
pub trait Adapter {
    async fn read(&self) -> Result<NetworkState, NetworkAdapterError>;
    async fn write(&self, network: &NetworkState) -> Result<(), NetworkAdapterError>;
}

impl From<NetworkAdapterError> for zbus::fdo::Error {
    fn from(value: NetworkAdapterError) -> zbus::fdo::Error {
        zbus::fdo::Error::Failed(value.to_string())
    }
}
