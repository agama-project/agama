pub mod error;
pub mod install_settings;
pub mod manager;
pub mod profile;
pub mod settings;
pub mod software;
pub mod storage;
pub mod users;
// TODO: maybe expose only clients when we have it?
pub mod progress;
pub mod proxies;
mod store;
pub use store::Store;

use crate::error::ServiceError;
use anyhow::Context;

pub async fn connection() -> Result<zbus::Connection, ServiceError> {
    let path = "/run/agama/bus";
    let address = format!("unix:path={path}");
    let conn = zbus::ConnectionBuilder::address(address.as_str())?
        .build()
        .await
        .with_context(|| format!("Connecting to D-Bus address {}", address))?;
    Ok(conn)
}
