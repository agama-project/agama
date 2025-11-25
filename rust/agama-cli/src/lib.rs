// Copyright (c) [2024] SUSE LLC
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

use agama_lib::auth::AuthToken;
use agama_lib::context::InstallationContext;
use agama_lib::manager::{FinishMethod, ManagerHTTPClient};
use agama_lib::monitor::{Monitor, MonitorClient};
use agama_transfer::Transfer;
use anyhow::Context;
use auth_tokens_file::AuthTokensFile;
use clap::{Args, Parser};
use fluent_uri::UriRef;

mod auth;
mod auth_tokens_file;
mod cli_input;
mod cli_output;
mod commands;
mod config;
mod error;
mod events;
mod logs;
mod progress;
mod questions;

use crate::error::CliError;
use agama_lib::error::ServiceError;
use agama_lib::http::{BaseHTTPClient, WebSocketClient};
use auth::run as run_auth_cmd;
use commands::Commands;
use config::run as run_config_cmd;
use events::run as run_events_cmd;
use logs::run as run_logs_cmd;
use progress::ProgressMonitor;
use questions::run as run_questions_cmd;
use std::fs;
use std::os::unix::fs::OpenOptionsExt;
use std::path::PathBuf;
use std::{
    process::{ExitCode, Termination},
    thread::sleep,
    time::Duration,
};
use url::Url;

/// Agama's CLI global options
#[derive(Args, Clone)]
pub struct GlobalOpts {
    #[clap(long, default_value = "http://localhost")]
    /// URI pointing to Agama's remote host.
    ///
    /// Examples: https://my-server.lan my-server.local localhost:10443
    pub host: String,

    #[clap(long, default_value = "false")]
    /// Whether to accept invalid (self-signed, ...) certificates or not
    pub insecure: bool,

    #[clap(long, default_value = "false")]
    /// Some commands could be able to work even without connection to
    /// the agama server
    pub local: bool,
}

/// Agama's command-line interface
///
/// This program allows inspecting or changing Agama's configuration, handling installation
/// profiles, starting the installation, monitoring the process, etc.
///
/// Please, use the "help" command to learn more.
#[derive(Parser)]
#[command(name = "agama", about, long_about, max_term_width = 100)]
pub struct Cli {
    #[clap(flatten)]
    pub opts: GlobalOpts,

    #[command(subcommand)]
    pub command: Commands,
}

async fn probe(manager: ManagerHTTPClient, monitor: MonitorClient) -> anyhow::Result<()> {
    let probe = tokio::spawn(async move {
        let _ = manager.probe().await;
    });
    show_progress(monitor, true).await;
    Ok(probe.await?)
}

/// Starts the installation process
///
/// Before starting, it makes sure that the manager is idle.
///
/// * `manager`: the manager client.
async fn install(
    manager: ManagerHTTPClient,
    monitor: MonitorClient,
    max_attempts: usize,
) -> anyhow::Result<()> {
    wait_until_idle(monitor.clone()).await?;

    let status = manager.status().await?;
    if !status.can_install {
        return Err(CliError::Validation)?;
    }

    let progress = tokio::spawn(async {
        show_progress(monitor, true).await;
    });
    // Try to start the installation up to max_attempts times.
    let mut attempts = 1;
    loop {
        match manager.install().await {
            Ok(()) => break,
            Err(e) => {
                eprintln!(
                    "Could not start the installation process: {e}. Attempt {}/{}.",
                    attempts, max_attempts
                );
            }
        }
        if attempts == max_attempts {
            eprintln!("Giving up.");
            return Err(CliError::Installation)?;
        }
        attempts += 1;
        sleep(Duration::from_secs(1));
    }
    let _ = progress.await;
    Ok(())
}

/// Finish the instalation with the given method
///
/// Before finishing, it makes sure that the manager is idle.
///
/// * `manager`: the manager client.
async fn finish(
    manager: ManagerHTTPClient,
    monitor: MonitorClient,
    method: FinishMethod,
) -> anyhow::Result<()> {
    wait_until_idle(monitor.clone()).await?;

    if !manager.finish(method).await? {
        eprintln!("Cannot finish the installation ({method})");
        return Err(CliError::NotFinished)?;
    }
    Ok(())
}

async fn wait_until_idle(monitor: MonitorClient) -> anyhow::Result<()> {
    // FIXME: implement something like "wait_until_idle" in the monitor?
    let status = monitor.get_status().await?;
    if status.installer_status.is_busy {
        eprintln!("The Agama service is busy. Waiting for it to be available...");
        show_progress(monitor.clone(), true).await;
    }
    Ok(())
}

pub fn download_file(url: &str, path: &PathBuf, insecure: bool) -> anyhow::Result<()> {
    let mut file = fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .mode(0o600)
        .open(path)
        .context(format!("Cannot write the file '{}'", path.display()))?;

    let context = InstallationContext::from_env().unwrap();
    let uri = UriRef::parse(url).context("Invalid URL")?;
    let absolute_url = if uri.has_scheme() {
        uri.to_string()
    } else {
        uri.resolve_against(&context.source)?.to_string()
    };

    Transfer::get(&absolute_url, &mut file, insecure)?;
    println!("File saved to {}", path.display());
    Ok(())
}

/// * `api_url`: API URL.
/// * `insecure`: whether an insecure connnection (e.g., using a self-signed certificate)
///   is allowed.
/// * `authenticated`: build an authenticated client (if possible).
async fn build_http_client(
    api_url: Url,
    insecure: bool,
    authenticated: bool,
) -> anyhow::Result<BaseHTTPClient> {
    let mut client = BaseHTTPClient::new(api_url)?;

    if insecure {
        client = client.insecure();
    }

    // we need to distinguish commands on those which assume that authentication JWT is already
    // available and those which not (or don't need it)
    if authenticated {
        // this deals with authentication need inside
        if let Some(token) = find_client_token(&client.base_url) {
            return Ok(client.authenticated(&token)?);
        }
        return Err(ServiceError::NotAuthenticated.into());
    } else {
        Ok(client.unauthenticated()?)
    }
}

/// Build a WebSocket client.
///
/// * `api_url`: API URL.
/// * `insecure`: whether an insecure connnection (e.g., using a self-signed certificate)
///   is allowed.
async fn build_ws_client(api_url: Url, insecure: bool) -> anyhow::Result<WebSocketClient> {
    let mut url = api_url.join("ws")?;
    let scheme = if api_url.scheme() == "http" {
        "ws"
    } else {
        "wss"
    };

    let token = find_client_token(&api_url).ok_or(ServiceError::NotAuthenticated)?;
    // Setting the scheme to a known value ("ws" or "wss" should not fail).
    url.set_scheme(scheme).unwrap();
    Ok(WebSocketClient::connect(&url, &token, insecure).await?)
}

/// Build the API url from the host.
///
/// * `host`: ip or host name. The protocol is optional, using https if omitted (e.g, "myserver",
/// "http://myserver", "192.168.100.101").
pub fn api_url(host: String) -> anyhow::Result<Url> {
    let sanitized_host = host.trim_end_matches('/').to_string();

    let url_str = if sanitized_host.starts_with("http://") || sanitized_host.starts_with("https://")
    {
        format!("{}/api/", sanitized_host)
    } else {
        format!("https://{}/api/", sanitized_host)
    };

    Url::parse(&url_str).context("The given URL is not valid.")
}

fn find_client_token(api_url: &Url) -> Option<AuthToken> {
    let hostname = api_url.host_str().unwrap_or("localhost");
    if let Ok(hosts_file) = AuthTokensFile::read() {
        if let Some(token) = hosts_file.get_token(hostname) {
            return Some(token);
        }
    }

    AuthToken::master()
}

async fn build_clients(
    api_url: Url,
    insecure: bool,
) -> anyhow::Result<(BaseHTTPClient, MonitorClient)> {
    let client = build_http_client(api_url.clone(), insecure, true).await?;
    let ws_client = build_ws_client(api_url, insecure).await?;
    let monitor = Monitor::connect(client.clone(), ws_client).await?;
    Ok((client, monitor))
}

/// Helper function to display the progress in the terminal.
///
/// * `monitor`: monitor client.
/// * `stop_on_idle`: stop displaying the progress when Agama becomes idle.
pub async fn show_progress(monitor: MonitorClient, stop_on_idle: bool) {
    let mut progress = ProgressMonitor::new(monitor).stop_on_idle(stop_on_idle);
    if let Err(e) = progress.run().await {
        eprintln!("Could not display the progress: {e:?}");
    }
}

pub async fn run_command(cli: Cli) -> anyhow::Result<()> {
    let api_url = api_url(cli.opts.clone().host)?;

    match cli.command {
        Commands::Config(subcommand) => run_config_cmd(subcommand, cli.opts).await?,
        Commands::Probe => {
            let (client, monitor) = build_clients(api_url, cli.opts.insecure).await?;
            let manager = ManagerHTTPClient::new(client.clone());
            let _ = wait_until_idle(monitor.clone()).await;
            probe(manager, monitor).await?
        }
        Commands::Install => {
            let (client, monitor) = build_clients(api_url, cli.opts.insecure).await?;
            let manager = ManagerHTTPClient::new(client.clone());
            let _ = wait_until_idle(monitor.clone()).await;
            install(manager, monitor, 3).await?
        }
        Commands::Finish { method } => {
            let (client, monitor) = build_clients(api_url, cli.opts.insecure).await?;
            let manager = ManagerHTTPClient::new(client.clone());
            let _ = wait_until_idle(monitor.clone()).await;
            let method = method.unwrap_or_default();
            finish(manager, monitor, method).await?;
        }
        Commands::Questions(subcommand) => {
            let client = build_http_client(api_url, cli.opts.insecure, true).await?;
            run_questions_cmd(client, subcommand).await?
        }
        Commands::Logs(subcommand) => {
            let client = build_http_client(api_url, cli.opts.insecure, true).await?;
            run_logs_cmd(client, subcommand).await?
        }
        Commands::Download { url, destination } => {
            download_file(&url, &destination, cli.opts.insecure)?
        }
        Commands::Auth(subcommand) => {
            let client = build_http_client(api_url, cli.opts.insecure, false).await?;
            run_auth_cmd(client, subcommand).await?;
        }
        Commands::Monitor => {
            let (_client, monitor) = build_clients(api_url, cli.opts.insecure).await?;
            show_progress(monitor, false).await;
        }
        Commands::Events { pretty } => {
            let ws_client = build_ws_client(api_url, cli.opts.insecure).await?;
            run_events_cmd(ws_client, pretty).await?;
        }
    };

    Ok(())
}

/// Represents the result of execution.
pub enum CliResult {
    /// Successful execution.
    Ok = 0,
    /// Something went wrong.
    Error = 1,
}

impl Termination for CliResult {
    fn report(self) -> ExitCode {
        ExitCode::from(self as u8)
    }
}
