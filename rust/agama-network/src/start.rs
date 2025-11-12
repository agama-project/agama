pub use crate::error::Error;
use crate::{NetworkManagerAdapter, NetworkSystem, NetworkSystemClient};

pub async fn start() -> Result<NetworkSystemClient, Error> {
    let system = NetworkSystem::<NetworkManagerAdapter>::for_network_manager().await;

    Ok(system.start().await?)
}
