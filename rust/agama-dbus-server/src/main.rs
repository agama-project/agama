pub mod error;
pub mod locale;

use agama_network::NetworkService;
use std::future::pending;

const ADDRESS: &str = "unix:path=/run/agama/bus";

#[async_std::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // When adding more services here, the order might be important.
    let _con = crate::locale::LocaleService::start(ADDRESS).await?;
    NetworkService::start(ADDRESS).await?;

    // Do other things or go to wait forever
    pending::<()>().await;

    Ok(())
}
