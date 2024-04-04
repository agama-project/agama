use std::{
    fs,
    io::{self, Write},
    os::unix::fs::OpenOptionsExt,
    path::{Path, PathBuf},
    process::{ExitCode, Termination},
};

use agama_lib::connection_to;
use agama_server::{
    l10n::helpers,
    web::{self, generate_token, run_monitor},
};
use anyhow::Context;
use clap::{Args, Parser, Subcommand};
use tokio::sync::broadcast::channel;
use tracing_subscriber::prelude::*;
use utoipa::OpenApi;

const DEFAULT_WEB_UI_DIR: &str = "/usr/share/agama/web_ui";

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
    // Directory containing the web UI code.
    #[arg(long)]
    web_ui_dir: Option<PathBuf>,
    #[arg(long)]
    generate_token: Option<PathBuf>,
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

fn find_web_ui_dir() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        let path = Path::new(&home).join(".local/share/agama");
        if path.exists() {
            return path;
        }
    }

    Path::new(DEFAULT_WEB_UI_DIR).into()
}

/// Start serving the API.
///
/// `args`: command-line arguments.
async fn serve_command(args: ServeArgs) -> anyhow::Result<()> {
    let journald = tracing_journald::layer().context("could not connect to journald")?;
    tracing_subscriber::registry().with(journald).init();

    let listener = tokio::net::TcpListener::bind(&args.address)
        .await
        .unwrap_or_else(|_| panic!("could not listen on {}", &args.address));

    let (tx, _) = channel(16);
    run_monitor(tx.clone()).await?;

    let config = web::ServiceConfig::load()?;

    if let Some(token_file) = args.generate_token {
        write_token(&token_file, &config.jwt_secret).context("could not create the token file")?;
    }

    let dbus = connection_to(&args.dbus_address).await?;
    let web_ui_dir = args.web_ui_dir.unwrap_or(find_web_ui_dir());
    let service = web::service(config, tx, dbus, web_ui_dir).await?;
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

fn write_token(path: &PathBuf, secret: &str) -> io::Result<()> {
    let token = generate_token(secret);
    let mut file = fs::OpenOptions::new()
        .create(true)
        .write(true)
        .mode(0o400)
        .open(path)?;
    file.write_all(token.as_bytes())?;
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
    _ = helpers::init_locale();

    if let Err(error) = run_command(cli).await {
        eprintln!("{:?}", error);
        return CliResult::Error;
    }

    CliResult::Ok
}
