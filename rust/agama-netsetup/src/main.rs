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

//! Interactive network setup for the installer initrd.
//!
//! It lets the user configure the network (especially without DHCP), test it and set a proxy
//! before the installer needs the network. It talks to NetworkManager, which dracut starts in
//! the initrd, so the result is handed over to the live system as usual.

mod bootparams;
mod checks;
mod console;
mod engine;
mod line_ui;
mod proxy;
mod settings;

use clap::Parser;
use console::{ConsoleInfo, UiMode};
use engine::NmBackend;
use line_ui::LineUi;
use proxy::{ProxyStore, DEFAULT_PROXY_FILE};
use std::{fs::OpenOptions, path::PathBuf, process::ExitCode, sync::Mutex};

/// Interactive network setup
#[derive(Parser, Debug)]
#[command(version, about)]
struct Args {
    /// User interface to use.
    #[arg(long, value_enum, default_value_t = UiMode::Auto)]
    ui: UiMode,

    /// URL used to test the connection.
    #[arg(long, default_value = "http://www.suse.com")]
    test_url: String,

    /// File to store the proxy setting in (dracut command line snippet).
    #[arg(long, default_value = DEFAULT_PROXY_FILE)]
    proxy_file: PathBuf,

    /// Save the connections to disk instead of keeping them in memory (/run).
    #[arg(long)]
    persistent: bool,

    /// Log file.
    #[arg(long, default_value = "/run/agama-netsetup.log")]
    log_file: PathBuf,
}

fn main() -> ExitCode {
    let args = Args::parse();
    init_logging(&args.log_file);

    let mode = ConsoleInfo::from_system().resolve(args.ui);
    tracing::info!("Requested UI: {:?}, using: {:?}", args.ui, mode);
    if mode == UiMode::Full && args.ui == UiMode::Full {
        println!("The full-screen interface is not available yet, using the line mode.");
    }

    let backend = match NmBackend::new(args.persistent) {
        Ok(backend) => backend,
        Err(e) => {
            eprintln!("Error: {e:#}");
            return ExitCode::FAILURE;
        }
    };

    let proxy = ProxyStore::from_system(args.proxy_file);
    let stdin = std::io::stdin();
    let mut ui = LineUi::new(
        stdin.lock(),
        std::io::stdout(),
        backend,
        &proxy,
        &args.test_url,
    );
    if let Err(e) = ui.run() {
        eprintln!("Error: {e}");
        return ExitCode::FAILURE;
    }
    ExitCode::SUCCESS
}

/// Logs to a file, the console is used by the user interface.
fn init_logging(path: &PathBuf) {
    let Ok(file) = OpenOptions::new().create(true).append(true).open(path) else {
        return;
    };
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_ansi(false)
        .with_writer(Mutex::new(file))
        .init();
}
