use agama_dbus_server::web;
use agama_lib::connection;
use clap::{Parser, Subcommand};
use tracing_subscriber::prelude::*;
use utoipa::OpenApi;

#[derive(Subcommand, Debug)]
enum Commands {
    /// Start the API server.
    Serve {
        /// Address to listen on (default: "0.0.0.0:3000")
        #[arg(long, default_value = "0.0.0.0:3000")]
        address: String,
    },
    /// Display the API documentation in OpenAPI format.
    Openapi,
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
async fn serve_command(address: &str) {
    let journald = tracing_journald::layer().expect("could not connect to journald");
    tracing_subscriber::registry().with(journald).init();

    let listener = tokio::net::TcpListener::bind(address)
        .await
        .unwrap_or_else(|_| panic!("could not listen on {}", address));

    let dbus_connection = connection().await.unwrap();
    let config = web::ServiceConfig::load().unwrap();
    let service = web::service(config, dbus_connection);
    axum::serve(listener, service)
        .await
        .expect("could not mount app on listener");
}

/// Display the API documentation in OpenAPI format.
fn openapi_command() {
    println!("{}", web::ApiDoc::openapi().to_pretty_json().unwrap());
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Serve { address } => serve_command(&address).await,
        Commands::Openapi => openapi_command(),
    }
}
