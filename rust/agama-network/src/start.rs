
pub use crate::error::Error;
use crate::{
    adapter::{Adapter, NetworkAdapterError},
    model::{NetworkState, StateConfig},
    NetworkManagerAdapter, NetworkSystem, NetworkSystemClient,
};
use async_trait::async_trait;

pub async fn start() -> Result<NetworkSystemClient, Error> {
    let system = NetworkSystem::<NetworkManagerAdapter>::for_network_manager().await;

    Ok(system.start().await?)
}

#[derive(Clone, Default)]
pub struct MockAdapter;

#[async_trait]
impl Adapter for MockAdapter {
    async fn read(&self, _config: StateConfig) -> Result<NetworkState, NetworkAdapterError> {
        Ok(NetworkState::default())
    }

    async fn write(&self, _network: &NetworkState) -> Result<(), NetworkAdapterError> {
        Ok(())
    }
}

pub async fn start_mock() -> Result<NetworkSystemClient, Error> {
    let system = NetworkSystem::<MockAdapter>::new(MockAdapter::default());
    Ok(system.start().await?)
}
