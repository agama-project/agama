pub mod error;
pub mod install_settings;
pub mod manager;
pub mod profile;
pub mod settings;
pub mod software;
pub mod storage;
pub mod users;
// TODO: maybe expose only clients when we have it?
pub mod dbus;
pub mod progress;
pub mod proxies;
mod store;
pub use store::Store;

use crate::error::ServiceError;
use anyhow::Context;

const ADDRESS: &str = "unix:path=/run/agama/bus";

pub async fn connection() -> Result<zbus::Connection, ServiceError> {
    connection_to(ADDRESS).await
}

pub async fn connection_to(address: &str) -> Result<zbus::Connection, ServiceError> {
    let connection = zbus::ConnectionBuilder::address(address)?
        .build()
        .await
        .context(format!("Connecting to Agama bus at {ADDRESS}"))?;
    Ok(connection)
}
