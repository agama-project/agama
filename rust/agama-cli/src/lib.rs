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

use clap::{Args, Parser};

mod auth;
mod commands;
mod config;
mod error;
mod logs;
mod profile;
mod progress;
mod questions;

use crate::error::CliError;
use agama_lib::base_http_client::BaseHTTPClient;
use agama_lib::{
    error::ServiceError, manager::ManagerClient, progress::ProgressMonitor, transfer::Transfer,
};
use auth::run as run_auth_cmd;
use commands::Commands;
use config::run as run_config_cmd;
use inquire::Confirm;
use logs::run as run_logs_cmd;
use profile::run as run_profile_cmd;
use progress::InstallerProgress;
use questions::run as run_questions_cmd;
use std::{
    collections::HashMap,
    process::{ExitCode, Termination},
    thread::sleep,
    time::Duration,
};

/// Agama's CLI global options
#[derive(Args)]
pub struct GlobalOpts {
    #[clap(long, default_value = "http://localhost/api")]
    /// uri pointing to agama's remote api. If not provided, default https://localhost/api is
    /// used
    pub api: String,
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

async fn probe() -> anyhow::Result<()> {
    let another_manager = build_manager().await?;
    let probe = tokio::spawn(async move {
        let _ = another_manager.probe().await;
    });
    show_progress().await?;

    Ok(probe.await?)
}

/// Starts the installation process
///
/// Before starting, it makes sure that the manager is idle.
///
/// * `manager`: the manager client.
async fn install(manager: &ManagerClient<'_>, max_attempts: u8) -> anyhow::Result<()> {
    if manager.is_busy().await {
        println!("Agama's manager is busy. Waiting until it is ready...");
    }

    // Make sure that the manager is ready
    manager.wait().await?;

    if !manager.can_install().await? {
        return Err(CliError::Validation)?;
    }

    let progress = tokio::spawn(async { show_progress().await });
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

async fn show_progress() -> Result<(), ServiceError> {
    // wait 1 second to give other task chance to start, so progress can display something
    tokio::time::sleep(Duration::from_secs(1)).await;
    let conn = agama_lib::connection().await?;
    let mut monitor = ProgressMonitor::new(conn).await.unwrap();
    let presenter = InstallerProgress::new();
    monitor
        .run(presenter)
        .await
        .expect("failed to monitor the progress");
    Ok(())
}

async fn wait_for_services(manager: &ManagerClient<'_>) -> Result<(), ServiceError> {
    let services = manager.busy_services().await?;
    // TODO: having it optional
    if !services.is_empty() {
        eprintln!("The Agama service is busy. Waiting for it to be available...");
        show_progress().await?
    }
    Ok(())
}

async fn build_manager<'a>() -> anyhow::Result<ManagerClient<'a>> {
    let conn = agama_lib::connection().await?;
    Ok(ManagerClient::new(conn).await?)
}

#[derive(PartialEq)]
enum InsecureApi {
    Secure,      // Remote api is secure
    Insecure,    // Remote api is insecure - e.g. self-signed certificate
    Forbidden, // Remote api is insecure and its use is forbidden (e.g. user decided not to use it)
    Unreachable, // Remote api is unrecheable
}

/// Returns if insecure connection to remote api server is required and user allowed that
async fn check_remote_api(api_url: String) -> Result<InsecureApi, ServiceError> {
    // fake client used for remote site detection
    let mut ping_client = BaseHTTPClient::default();
    ping_client.base_url = api_url;

    // decide whether access to remote site has to be insecure (self-signed certificate or not)
    match ping_client.get::<HashMap<String, String>>("/ping").await {
        Ok(res) => {
            if res["status"] == "success" {
                Ok(InsecureApi::Secure)
            } else {
                Ok(InsecureApi::Unreachable)
            }
        }
        Err(err) => {
            // So far we only know that we cannot communicate with the remote site, it can mean
            // the issue with a self-signed certificate or whatever else
            if Confirm::new("Remote API uses self-signed certificate. Do you want to continue?")
                .with_default(false)
                .prompt()
                .map_err(|_| err)?
            {
                Ok(InsecureApi::Insecure)
            } else {
                Ok(InsecureApi::Forbidden)
            }
        }
    }
}

pub async fn run_command(cli: Cli) -> Result<(), ServiceError> {
    // somehow check whether we need to ask user for self-signed certificate acceptance
    let api_url = cli.opts.api.trim_end_matches('/').to_string();
    let insecure = check_remote_api(api_url.clone()).await? == InsecureApi::Insecure;

    // we need to distinguish commands on those which assume that authentication JWT is already
    // available and those which not (or don't need it)
    let mut client = if let Commands::Auth(_) = cli.command {
        BaseHTTPClient::bare(insecure)
    } else {
        // this deals with authentication need inside
        BaseHTTPClient::new_with_params(insecure)?
    };

    client.base_url = api_url.clone();

    match cli.command {
        Commands::Config(subcommand) => run_config_cmd(client, subcommand).await?,
        Commands::Probe => {
            let manager = build_manager().await?;
            wait_for_services(&manager).await?;
            probe().await?
        }
        Commands::Profile(subcommand) => run_profile_cmd(subcommand).await?,
        Commands::Install => {
            let manager = build_manager().await?;
            install(&manager, 3).await?
        }
        Commands::Questions(subcommand) => run_questions_cmd(subcommand).await?,
        // TODO: logs command was originally designed with idea that agama's cli and agama
        // installation runs on the same machine, so it is unable to do remote connection
        Commands::Logs(subcommand) => run_logs_cmd(subcommand).await?,
        Commands::Download { url } => Transfer::get(&url, std::io::stdout())?,
        Commands::Auth(subcommand) => {
            run_auth_cmd(client, subcommand).await?;
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
