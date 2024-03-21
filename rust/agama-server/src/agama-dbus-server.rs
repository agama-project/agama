use agama_server::{
    l10n::{self, helpers},
    network, questions,
};

use agama_lib::connection_to;
use anyhow::Context;
use log::{self, LevelFilter};
use std::future::pending;

const ADDRESS: &str = "unix:path=/run/agama/bus";
const SERVICE_NAME: &str = "org.opensuse.Agama1";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let locale = helpers::init_locale()?;

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

    let connection = connection_to(ADDRESS)
        .await
        .expect("Could not connect to the D-Bus daemon");

    // When adding more services here, the order might be important.
    questions::export_dbus_objects(&connection).await?;
    log::info!("Started questions interface");
    l10n::export_dbus_objects(&connection, &locale).await?;
    log::info!("Started locale interface");
    network::export_dbus_objects(&connection).await?;
    log::info!("Started network interface");

    connection
        .request_name(SERVICE_NAME)
        .await
        .context(format!("Requesting name {SERVICE_NAME}"))?;

    // Do other things or go to wait forever
    pending::<()>().await;

    Ok(())
}
