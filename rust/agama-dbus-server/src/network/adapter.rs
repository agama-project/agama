use crate::network::NetworkState;
use async_trait::async_trait;
use std::error::Error;

/// A trait for the ability to read/write from/to a network service
#[async_trait]
pub trait Adapter {
    async fn read(&self) -> Result<NetworkState, Box<dyn Error>>;
    async fn write(&self, network: &NetworkState) -> Result<(), Box<dyn Error>>;
}
