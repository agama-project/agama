use agama_lib::connection;
use clap::Parser;

mod http;
mod server;
mod ws;
use server::AgamaServer;

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

    let connection = connection().await.unwrap();
    let server = AgamaServer::new(&cli.address, connection);
    server.run().await;
}
