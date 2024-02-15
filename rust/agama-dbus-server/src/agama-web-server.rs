use agama_lib::connection;
use clap::Parser;

use agama_dbus_server::server;
use tracing_subscriber::prelude::*;

#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Cli {
    /// Address to listen on (default: "0.0.0.0:3000")
    #[arg(long, default_value = "0.0.0.0:3000")]
    address: String,
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    let journald = tracing_journald::layer().expect("could not connect to journald");
    tracing_subscriber::registry().with(journald).init();

    let listener = tokio::net::TcpListener::bind(&cli.address)
        .await
        .unwrap_or_else(|_| panic!("could not listen on {}", &cli.address));

    let dbus_connection = connection().await.unwrap();
    axum::serve(listener, server::service(dbus_connection))
        .await
        .expect("could not mount app on listener");
}
