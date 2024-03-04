use std::process::{ExitCode, Termination};

use agama_dbus_server::{
    l10n::helpers,
    web::{self, run_monitor},
};
use agama_lib::connection_to;
use clap::{Args, Parser, Subcommand};
use tokio::sync::broadcast::channel;
use tracing_subscriber::prelude::*;
use utoipa::OpenApi;

#[derive(Subcommand, Debug)]
enum Commands {
    /// Start the API server.
    Serve(ServeArgs),
    /// Display the API documentation in OpenAPI format.
    Openapi,
}

#[derive(Debug, Args)]
pub struct ServeArgs {
    // Address to listen on (":::3000" listens for both IPv6 and IPv4
    // connections unless manually disabled in /proc/sys/net/ipv6/bindv6only)
    #[arg(long, default_value = ":::3000")]
    address: String,
    // Agama D-Bus address
    #[arg(long, default_value = "unix:path=/run/agama/bus")]
    dbus_address: String,
}

#[derive(Parser, Debug)]
#[command(
    version,
    about = "Starts the Agama web-based API.",
    long_about = None)]
struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

/// Start serving the API.
///
/// `args`: command-line arguments.
async fn serve_command(args: ServeArgs) -> anyhow::Result<()> {
    let journald = tracing_journald::layer().expect("could not connect to journald");
    tracing_subscriber::registry().with(journald).init();

    let listener = tokio::net::TcpListener::bind(&args.address)
        .await
        .unwrap_or_else(|_| panic!("could not listen on {}", &args.address));

    let (tx, _) = channel(16);
    run_monitor(tx.clone()).await?;

    let config = web::ServiceConfig::load()?;
    let dbus = connection_to(&args.dbus_address).await?;
    let service = web::service(config, tx, dbus).await;
    axum::serve(listener, service)
        .await
        .expect("could not mount app on listener");

    Ok(())
}

/// Display the API documentation in OpenAPI format.
fn openapi_command() -> anyhow::Result<()> {
    println!("{}", web::ApiDoc::openapi().to_pretty_json().unwrap());
    Ok(())
}

async fn run_command(cli: Cli) -> anyhow::Result<()> {
    match cli.command {
        Commands::Serve(args) => serve_command(args).await,
        Commands::Openapi => openapi_command(),
    }
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
    _ = helpers::init_locale();

    if let Err(error) = run_command(cli).await {
        eprintln!("{:?}", error);
        return CliResult::Error;
    }

    CliResult::Ok
}
