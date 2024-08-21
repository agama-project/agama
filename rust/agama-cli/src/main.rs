use clap::Parser;

mod auth;
mod commands;
mod config;
mod error;
mod logs;
mod profile;
mod progress;
mod questions;

use crate::error::CliError;
use agama_lib::error::ServiceError;
use agama_lib::manager::ManagerClient;
use agama_lib::progress::ProgressMonitor;
use auth::run as run_auth_cmd;
use commands::Commands;
use config::run as run_config_cmd;
use logs::run as run_logs_cmd;
use profile::run as run_profile_cmd;
use progress::InstallerProgress;
use questions::run as run_questions_cmd;
use std::{
    process::{ExitCode, Termination},
    thread::sleep,
    time::Duration,
};

/// Agama's command-line interface
///
/// This program allows inspecting or changing Agama's configuration, handling installation
/// profiles, starting the installation, monitoring the process, etc.
///
/// Please, use the "help" command to learn more.
#[derive(Parser)]
#[command(name = "agama", about, long_about, max_term_width = 100)]
struct Cli {
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

async fn run_command(cli: Cli) -> Result<(), ServiceError> {
    match cli.command {
        Commands::Config(subcommand) => {
            let manager = build_manager().await?;
            wait_for_services(&manager).await?;
            run_config_cmd(subcommand).await?
        }
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
        Commands::Logs(subcommand) => run_logs_cmd(subcommand).await?,
        Commands::Auth(subcommand) => run_auth_cmd(subcommand).await?,
        Commands::Download { url } => crate::profile::download(&url, std::io::stdout())?,
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

#[tokio::main]
async fn main() -> CliResult {
    let cli = Cli::parse();

    if let Err(error) = run_command(cli).await {
        eprintln!("{:?}", error);
        return CliResult::Error;
    }
    CliResult::Ok
}
