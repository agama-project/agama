pub mod error;
pub mod locale;
pub mod questions;

use agama_network::NetworkService;
use std::future::pending;
use systemd_journal_logger::JournalLog;
use log::LevelFilter;

const ADDRESS: &str = "unix:path=/run/agama/bus";

#[async_std::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    JournalLog::default().install().unwrap();
    log::set_max_level(LevelFilter::Info);
    // When adding more services here, the order might be important.
    crate::questions::start_service(ADDRESS).await?;
    log::info!("Started questions interface");
    let _conn = crate::locale::start_service(ADDRESS).await?;
    log::info!("Started locale interface");
    NetworkService::start(ADDRESS).await?;
    log::info!("Started network interface");

    // Do other things or go to wait forever
    pending::<()>().await;

    Ok(())
}
