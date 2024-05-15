//! Functions to work with logs.

use anyhow::Context;
use libsystemd::logging;
use tracing_subscriber::prelude::*;

/// Initializes the logging mechanism.
///
/// It is based on [Tracing](https://github.com/tokio-rs/tracing), part of the Tokio ecosystem.
pub fn start_logging() -> anyhow::Result<()> {
    if logging::connected_to_journal() {
        let journald = tracing_journald::layer().context("could not connect to journald")?;
        tracing_subscriber::registry().with(journald).init();
    } else {
        tracing_subscriber::fmt::init();
    }
    Ok(())
}
