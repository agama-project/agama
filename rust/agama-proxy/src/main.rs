// Copyright (c) [2026] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

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
