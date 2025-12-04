// Copyright (c) [2025] SUSE LLC
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

mod api;
mod app;
mod message;
mod ui;
mod utils;

use std::sync::{Arc, Mutex};

use agama_cli::api_url;
use clap::Parser;
use ratatui::{self, crossterm};
use tokio::sync::mpsc::{self, Sender};

use crate::{
    api::{Api, ApiState},
    app::App,
    message::Message,
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

async fn handle_input_event(events_tx: Sender<Message>) {
    while let Ok(event) = crossterm::event::read() {
        if let crossterm::event::Event::Key(key) = event {
            let exit = key.code == crossterm::event::KeyCode::Char('q');
            events_tx.send(Message::Key(key)).await.unwrap();
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

    let tx_clone = tx.clone();
    tokio::task::spawn(async move {
        handle_input_event(tx_clone).await;
    });

    let state = ApiState::from_client(&http).await?;

    // TODO: move the state to the client, so it can be accessed through
    // ApiClient::state().
    let state = Arc::new(Mutex::new(state));
    let api = Api::start(state.clone(), http.clone(), ws, tx.clone());
    let mut app = App::build(state, api, tx, rx).await;

    let mut terminal = ratatui::init();
    let result = app.run(&mut terminal).await;
    ratatui::restore();
    result
}
