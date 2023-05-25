pub mod error;
pub mod locale;

use agama_network::NetworkService;
use std::future::pending;

const ADDRESS: &str = "unix:path=/run/agama/bus";

#[async_std::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    NetworkService::start_service(ADDRESS).await?;
    let _con = crate::locale::Locale::start_service(ADDRESS).await?;

    // Do other things or go to wait forever
    pending::<()>().await;

    Ok(())
}
