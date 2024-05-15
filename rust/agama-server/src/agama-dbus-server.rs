use agama_server::{
    l10n::{self, helpers},
    logs::start_logging,
    questions,
};

use agama_lib::connection_to;
use anyhow::Context;
use std::future::pending;

const ADDRESS: &str = "unix:path=/run/agama/bus";
const SERVICE_NAME: &str = "org.opensuse.Agama1";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let locale = helpers::init_locale()?;
    start_logging().context("Could not initialize the logger")?;

    let connection = connection_to(ADDRESS)
        .await
        .expect("Could not connect to the D-Bus daemon");

    // When adding more services here, the order might be important.
    questions::export_dbus_objects(&connection).await?;
    log::info!("Started questions interface");
    l10n::export_dbus_objects(&connection, &locale).await?;
    log::info!("Started locale interface");

    connection
        .request_name(SERVICE_NAME)
        .await
        .context(format!("Requesting name {SERVICE_NAME}"))?;

    // Do other things or go to wait forever
    pending::<()>().await;

    Ok(())
}
