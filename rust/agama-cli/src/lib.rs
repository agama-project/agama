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

use std::{
    fs,
    os::unix::fs::OpenOptionsExt,
    path::PathBuf,
    process::{ExitCode, Termination},
    time::Duration,
};

use agama_lib::{
    auth::AuthToken,
    error::ServiceError,
    http::{BaseHTTPClient, WebSocketClient},
    manager::ManagerHTTPClient,
    monitor::Monitor,
};
use agama_transfer::Transfer;
use agama_utils::api::{self, status::Stage, FinishMethod, IssueWithScope};
use anyhow::Context;
use clap::{Args, Parser};
use fluent_uri::UriRef;
use tokio::time::sleep;
use url::Url;

use crate::{
    auth::run as run_auth_cmd,
    auth_tokens_file::AuthTokensFile,
    commands::{Commands, Format},
    config::run as run_config_cmd,
    error::CliError,
    events::run as run_events_cmd,
    logs::run as run_logs_cmd,
    progress::ProgressMonitor,
    questions::run as run_questions_cmd,
};

mod auth;
mod auth_tokens_file;
mod cli_input;
mod cli_output;
mod commands;
mod config;
mod context;
mod error;
mod events;
mod logs;
mod progress;
mod questions;
mod status;

use context::InstallationContext;
use status::StatusReport;

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

async fn probe(http: BaseHTTPClient, ws: WebSocketClient) -> anyhow::Result<()> {
    let manager_client = ManagerHTTPClient::new(http.clone());
    let probe = tokio::spawn(async move {
        let _ = manager_client.probe().await;
    });
    show_progress(http, ws, true).await?;
    Ok(probe.await?)
}

/// Starts the installation process
///
/// Before starting, it makes sure that the manager is idle.
///
/// * `manager`: the manager client.
async fn install(http_client: BaseHTTPClient, mut ws: WebSocketClient) -> anyhow::Result<()> {
    wait_until_idle(&http_client, &mut ws)
        .await
        .context("failed to check if service is busy")?;

    let manager_client = ManagerHTTPClient::new(http_client.clone());
    let status = manager_client.status().await?;
    let issues: Vec<IssueWithScope> = manager_client.issues().await?;
    if status.stage != Stage::Configuring {
        return Err(CliError::Installation)?;
    }
    if !issues.is_empty() {
        return Err(CliError::Validation)?;
    }

    manager_client.install().await?;

    // wait a bit before start monitoring
    sleep(Duration::from_secs(1)).await;

    let res = show_progress(http_client, ws, true).await;
    if let Err(e) = res {
        eprintln!("Failed to show progress: {:?}", e);
    }
    Ok(())
}

/// Finish the instalation with the given method
///
/// Before finishing, it makes sure that the manager is idle.
///
/// * `manager`: the manager client.
async fn finish(
    http: BaseHTTPClient,
    mut ws: WebSocketClient,
    method: Option<FinishMethod>,
) -> anyhow::Result<()> {
    wait_until_idle(&http, &mut ws)
        .await
        .context("failed to check if service is busy")?;

    let method = method
        .unwrap_or_else(|| FinishMethod::from_kernel_cmdline().unwrap_or(FinishMethod::Reboot));
    let manager = ManagerHTTPClient::new(http);
    manager.finish(method).await?;
    Ok(())
}

async fn print_status(http: &BaseHTTPClient, format: Format) -> anyhow::Result<()> {
    let status = Monitor::get_installation_status(http).await?;
    let report = StatusReport::new(status);
    match format {
        Format::Json => {
            println!("{}", serde_json::to_string_pretty(&report)?);
        }
        Format::Text => {
            println!("{}", report);
        }
    }
    Ok(())
}

async fn wait_until_idle(http: &BaseHTTPClient, ws: &mut WebSocketClient) -> anyhow::Result<()> {
    let manager = ManagerHTTPClient::new(http.clone());
    loop {
        let status = manager.status().await?;
        if status.progresses.is_empty() {
            break;
        }
        eprintln!("There are already running operations. Waiting for them to finish...");
        loop {
            if matches!(ws.receive().await?, api::Event::ProgressFinished { .. }) {
                break;
            }
        }
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
        Err(ServiceError::NotAuthenticated.into())
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
///   "http://myserver", "192.168.100.101").
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
) -> anyhow::Result<(BaseHTTPClient, WebSocketClient)> {
    let client = build_http_client(api_url.clone(), insecure, true).await?;
    let ws_client = build_ws_client(api_url, insecure).await?;
    Ok((client, ws_client))
}

/// Helper function to display the progress in the terminal.
///
/// * `monitor`: monitor client.
/// * `stop_on_idle`: stop displaying the progress when Agama becomes idle.
pub async fn show_progress(
    http: BaseHTTPClient,
    ws: WebSocketClient,
    stop_on_idle: bool,
) -> anyhow::Result<()> {
    ProgressMonitor::run(http, ws, stop_on_idle).await?;

    Ok(())
}

pub async fn run_command(cli: Cli) -> anyhow::Result<()> {
    let api_url = api_url(cli.opts.clone().host)?;

    match cli.command {
        Commands::Config(subcommand) => run_config_cmd(subcommand, cli.opts).await?,
        Commands::Probe => {
            let (http, mut ws) = build_clients(api_url, cli.opts.insecure).await?;
            wait_until_idle(&http, &mut ws)
                .await
                .context("Failed to check if service is busy")?;
            probe(http, ws).await?
        }
        Commands::Install => {
            let (http, mut ws) = build_clients(api_url, cli.opts.insecure).await?;
            wait_until_idle(&http, &mut ws)
                .await
                .context("Failed to check if service is busy")?;
            install(http, ws).await?
        }
        Commands::Finish { method } => {
            let (http, mut ws) = build_clients(api_url, cli.opts.insecure).await?;
            wait_until_idle(&http, &mut ws)
                .await
                .context("Failed to check if service is busy")?;
            finish(http, ws, method).await?;
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
            let (http, ws) = build_clients(api_url, cli.opts.insecure).await?;
            show_progress(http, ws, false).await?;
        }
        Commands::Status { format } => {
            let client = build_http_client(api_url, cli.opts.insecure, true).await?;
            print_status(&client, format).await?;
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
