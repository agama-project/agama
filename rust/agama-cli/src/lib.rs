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
use agama_utils::make_long;
use anyhow::Context;
use clap::{Arg, ArgAction, ArgMatches, Command};
use fluent_uri::UriRef;
use gettextrs::gettext;
use tokio::time::sleep;
use url::Url;

use crate::{
    auth::run as run_auth_cmd, auth_tokens_file::AuthTokensFile, commands::Format,
    config::run as run_config_cmd, error::CliError, events::run as run_events_cmd,
    logs::run as run_logs_cmd, questions::run as run_questions_cmd,
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
mod monitor;
mod questions;
mod status;

use context::InstallationContext;
use status::StatusReport;

/// Agama's CLI global options
#[derive(Clone, Debug)]
pub struct GlobalOpts {
    pub host: String,
    pub insecure: bool,
    pub local: bool,
}

impl GlobalOpts {
    pub fn from_matches(matches: &ArgMatches) -> Self {
        Self {
            host: matches
                .get_one::<String>("host")
                .cloned()
                .unwrap_or_else(|| "http://localhost".to_string()),
            insecure: matches.get_flag("insecure"),
            local: matches.get_flag("local"),
        }
    }
}

pub fn build_cli() -> Command {
    // TRANSLATORS: CLI help for: agama
    let about = gettext("Agama's command-line interface");
    let long_about = make_long(
        &about,
        &gettext(
            // TRANSLATORS: CLI help for: agama (details)
            "\
        This program allows inspecting or changing Agama's configuration, handling installation \
        profiles, starting the installation, monitoring the process, etc.\n\
        \n\
        Please, use the \"help\" command to learn more.",
        ),
    );
    Command::new("agama")
        .subcommand_required(true)
        .arg_required_else_help(true)
        .about(&about)
        .long_about(long_about)
        .arg(
            Arg::new("host")
                .value_name("HOST")
                .long("host")
                .default_value("http://localhost")
                // TRANSLATORS: CLI help for: agama --host <HOST>
                .long_help(gettext("\
                    URI pointing to Agama's remote host.\n\
                    \n\
                          Examples: https://my-server.lan my-server.local localhost:10443",
                ))
        )
        .arg(
            Arg::new("insecure")
                .long("insecure")
                .action(ArgAction::SetTrue)
                .default_value("false")
                // TRANSLATORS: CLI help for: agama --insecure
                .help(gettext("Whether to accept invalid (self-signed, ...) certificates or not"))
        )
        .arg(
            Arg::new("local")
                .long("local")
                .action(ArgAction::SetTrue)
                .default_value("false")
                // TRANSLATORS: CLI help for: agama --local
                .help(gettext("Some commands could be able to work even without connection to the agama server"))
        )
        .subcommand(crate::commands::build_config_cmd())
        .subcommand(crate::commands::build_probe_cmd())
        .subcommand(crate::commands::build_install_cmd())
        .subcommand(crate::commands::build_questions_cmd())
        .subcommand(crate::commands::build_logs_cmd())
        .subcommand(crate::commands::build_auth_cmd())
        .subcommand(crate::commands::build_download_cmd())
        .subcommand(crate::commands::build_finish_cmd())
        .subcommand(crate::commands::build_monitor_cmd())
        .subcommand(crate::commands::build_status_cmd())
        .subcommand(crate::commands::build_events_cmd())
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
        if status.progresses.is_empty() && status.tasks.is_empty() {
            break;
        }
        eprintln!("There are already running operations. Waiting for them to finish...");
        loop {
            match ws.receive().await? {
                api::Event::ProgressFinished { .. }
                | api::Event::TaskFinished { remaining: 0, .. } => break,
                _ => (),
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
/// * `theme`: color theme name to use.
pub async fn show_progress(
    http: BaseHTTPClient,
    ws: WebSocketClient,
    stop_on_idle: bool,
) -> anyhow::Result<()> {
    monitor::run(http, ws, stop_on_idle).await?;

    Ok(())
}

pub async fn run_command(matches: ArgMatches) -> anyhow::Result<()> {
    let opts = GlobalOpts::from_matches(&matches);
    let api_url = api_url(opts.host.clone())?;

    match matches.subcommand() {
        Some(("config", sub_matches)) => run_config_cmd(sub_matches, opts).await?,
        Some(("probe", _)) => {
            let (http, mut ws) = build_clients(api_url, opts.insecure).await?;
            wait_until_idle(&http, &mut ws)
                .await
                .context("Failed to check if service is busy")?;
            probe(http, ws).await?
        }
        Some(("install", _)) => {
            let (http, mut ws) = build_clients(api_url, opts.insecure).await?;
            wait_until_idle(&http, &mut ws)
                .await
                .context("Failed to check if service is busy")?;
            install(http, ws).await?
        }
        Some(("finish", sub_matches)) => {
            let method = sub_matches.get_one::<FinishMethod>("method").copied();
            let (http, mut ws) = build_clients(api_url, opts.insecure).await?;
            wait_until_idle(&http, &mut ws)
                .await
                .context("Failed to check if service is busy")?;
            finish(http, ws, method).await?;
        }
        Some(("questions", sub_matches)) => {
            let client = build_http_client(api_url, opts.insecure, true).await?;
            run_questions_cmd(client, sub_matches).await?
        }
        Some(("logs", sub_matches)) => {
            let client = build_http_client(api_url, opts.insecure, true).await?;
            run_logs_cmd(client, sub_matches).await?
        }
        Some(("download", sub_matches)) => {
            let url = sub_matches.get_one::<String>("url").unwrap().clone();
            let destination = sub_matches
                .get_one::<PathBuf>("destination")
                .unwrap()
                .clone();
            download_file(&url, &destination, opts.insecure)?
        }
        Some(("auth", sub_matches)) => {
            let client = build_http_client(api_url, opts.insecure, false).await?;
            run_auth_cmd(client, sub_matches).await?;
        }
        Some(("monitor", _)) => {
            let (http, ws) = build_clients(api_url, opts.insecure).await?;
            monitor::run(http, ws, false).await?;
        }
        Some(("status", sub_matches)) => {
            let format = sub_matches.get_one::<Format>("format").unwrap().clone();
            let client = build_http_client(api_url, opts.insecure, true).await?;
            print_status(&client, format).await?;
        }
        Some(("events", sub_matches)) => {
            let pretty = sub_matches.get_flag("pretty");
            let ws_client = build_ws_client(api_url, opts.insecure).await?;
            run_events_cmd(ws_client, pretty).await?;
        }
        _ => {}
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
