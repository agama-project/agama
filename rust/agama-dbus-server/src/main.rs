pub mod error;
pub mod locale;
pub mod questions;

use agama_network::NetworkService;
use log::LevelFilter;
use std::future::pending;

const ADDRESS: &str = "unix:path=/run/agama/bus";

#[async_std::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // be smart with logging and log directly to journal if connected to it
    if systemd_journal_logger::connected_to_journal() {
        // unwrap here is intentional as we are sure no other logger is active yet
        systemd_journal_logger::JournalLog::default()
            .install()
            .unwrap();
        log::set_max_level(LevelFilter::Info); // log only info for journal logger
    } else {
        simplelog::TermLogger::init(
            LevelFilter::Info, // lets use info, trace provides too much output from libraries
            simplelog::Config::default(),
            simplelog::TerminalMode::Stderr, // only stderr output for easier filtering
            simplelog::ColorChoice::Auto,
        )
        .unwrap(); // unwrap here as we are sure no other logger active
    }
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
