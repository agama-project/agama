mod api;
mod app;
mod event;
mod utils;

use agama_cli::api_url;
use clap::Parser;
use ratatui::{self, crossterm};
use tokio::sync::mpsc::{self, Sender};

use crate::{
    api::Service,
    app::App,
    event::AppEvent,
    utils::{build_http_client, build_ws_client},
};

#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Cli {
    #[arg(long, default_value = "http://localhost")]
    pub host: String,
    #[arg(long, default_value_t = false)]
    pub insecure: bool,
}

async fn handle_input_event(events_tx: Sender<AppEvent>) {
    while let Ok(event) = crossterm::event::read() {
        if let crossterm::event::Event::Key(key) = event {
            let exit = key.code == crossterm::event::KeyCode::Char('q');
            events_tx.send(AppEvent::Key(key)).await.unwrap();
            if exit {
                return;
            }
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    println!("Connecting to {:?}", cli.host);

    // Channel to receive application events (from the API or the user).
    let (tx, rx) = mpsc::channel(16);

    let url = api_url(cli.host)?;
    let http = build_http_client(url.clone(), cli.insecure, true).await?;
    let ws = build_ws_client(url, cli.insecure).await?;
    let server = Service::starter(http, ws, tx.clone()).start().await?;

    let tx_clone = tx.clone();
    tokio::task::spawn(async move {
        handle_input_event(tx_clone).await;
    });
    let mut app = App::new(server, rx);

    let mut terminal = ratatui::init();
    let result = app.run(&mut terminal).await;
    ratatui::restore();
    result
}
