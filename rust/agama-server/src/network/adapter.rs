use crate::network::{model::StateConfig, Action, NetworkState};
use agama_lib::error::ServiceError;
use async_trait::async_trait;
use thiserror::Error;
use tokio::sync::mpsc::UnboundedSender;

#[derive(Error, Debug)]
pub enum NetworkAdapterError {
    #[error("Could not read the network configuration: {0}")]
    Read(ServiceError),
    #[error("Could not update the network configuration: {0}")]
    Write(ServiceError),
    #[error("Checkpoint handling error: {0}")]
    Checkpoint(ServiceError), // only relevant for adapters that implement a checkpoint mechanism
    #[error("The network watcher cannot run: {0}")]
    Watcher(ServiceError),
}

/// A trait for the ability to read/write from/to a network service.
#[async_trait]
pub trait Adapter {
    async fn read(&self, config: StateConfig) -> Result<NetworkState, NetworkAdapterError>;
    async fn write(&self, network: &NetworkState) -> Result<(), NetworkAdapterError>;
    /// Returns the watcher, which is responsible for listening for network changes.
    fn watcher(&self) -> Option<Box<dyn Watcher + Send>> {
        None
    }
}

impl From<NetworkAdapterError> for zbus::fdo::Error {
    fn from(value: NetworkAdapterError) -> zbus::fdo::Error {
        zbus::fdo::Error::Failed(value.to_string())
    }
}

#[async_trait]
/// A trait for the ability to listen for network changes.
pub trait Watcher {
    /// Listens for network changes and emit actions to update the state.
    ///
    /// * `actions`: channel to emit the actions.
    async fn run(
        self: Box<Self>,
        actions: UnboundedSender<Action>,
    ) -> Result<(), NetworkAdapterError>;
}
