pub mod error;
pub mod locale;
pub mod questions;
pub mod network;

use network::NetworkService;
use std::future::pending;

const ADDRESS: &str = "unix:path=/run/agama/bus";

#[async_std::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // When adding more services here, the order might be important.
    crate::questions::start_service(ADDRESS).await?;
    let _conn = crate::locale::start_service(ADDRESS).await?;
    NetworkService::start(ADDRESS).await?;

    // Do other things or go to wait forever
    pending::<()>().await;

    Ok(())
}
