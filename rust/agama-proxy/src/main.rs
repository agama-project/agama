use agama_proxy::model::ProxyConfig;
use anyhow::Context;
use libsystemd::logging;
use tracing::level_filters::LevelFilter;
use tracing_subscriber::{prelude::*, EnvFilter};

/// Initializes the logging mechanism.
///
/// It is based on [Tracing](https://github.com/tokio-rs/tracing), part of the Tokio ecosystem.
pub fn init_logging() -> anyhow::Result<()> {
    let filter = EnvFilter::builder()
        .with_default_directive(LevelFilter::INFO.into())
        .with_env_var("AGAMA_LOG")
        .from_env_lossy();

    if logging::connected_to_journal() {
        let journald = tracing_journald::layer().context("could not connect to journald")?;
        tracing_subscriber::registry()
            .with(filter)
            .with(journald)
            .init();
    } else {
        let subscriber = tracing_subscriber::fmt()
            .with_env_filter(filter)
            .with_file(true)
            .with_line_number(true)
            .compact()
            .finish();
        tracing::subscriber::set_global_default(subscriber)?;
    }
    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    init_logging().context("Could not initialize the logger")?;
    if let Some(config) = ProxyConfig::from_cmdline() {
        config.write()?;
    } else {
        tracing::info!("No proxy configuration was found");
    }
    Ok(())
}
