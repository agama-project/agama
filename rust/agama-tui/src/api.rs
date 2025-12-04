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

//! This module implements a service that retrieves and keeps the information
//! from an Agama's server.

use std::sync::{Arc, Mutex};

use agama_lib::http::{BaseHTTPClient, WebSocketClient};
use agama_utils::api::{Config, Proposal, SystemInfo};
use tokio::sync::mpsc;

use crate::message::Message;

pub struct ApiState {
    pub system_info: SystemInfo,
    pub proposal: Proposal,
    pub config: Config,
}

impl ApiState {
    pub async fn from_client(http: &BaseHTTPClient) -> anyhow::Result<Self> {
        let system_info = http.get::<SystemInfo>("v2/system").await?;
        let proposal = http.get::<Proposal>("v2/proposal").await?;
        let config = http.get::<Config>("v2/config").await?;

        Ok(Self {
            system_info,
            proposal,
            config,
        })
    }
}

enum ApiAction {
    SelectProduct(String),
}

/// Client to interact with the Agama API.
///
/// NOTE: it could implement the ::start method to make [Api] private.
#[derive(Clone)]
pub struct ApiClient {
    actions_tx: mpsc::Sender<ApiAction>,
}

impl ApiClient {
    /// Selects a product.
    pub async fn select_product(&self, id: &str) -> anyhow::Result<()> {
        self.actions_tx
            .send(ApiAction::SelectProduct(id.to_string()))
            .await?;
        Ok(())
    }
}

/// Interface to the Agama API.
pub struct Api {
    actions_rx: mpsc::Receiver<ApiAction>,
    http: BaseHTTPClient,
    messages: mpsc::Sender<Message>,
}

impl Api {
    /// Starts the API interface and returns a client to interact with it.
    pub fn start(
        state: Arc<Mutex<ApiState>>,
        http: BaseHTTPClient,
        ws: WebSocketClient,
        messages: mpsc::Sender<Message>,
    ) -> ApiClient {
        let (actions_tx, actions_rx) = mpsc::channel(16);

        let monitor = ApiMonitor::new(state, ws, messages.clone());
        tokio::task::spawn(async move {
            monitor.run().await;
        });

        let api = Api::new(http, actions_rx, messages);
        tokio::spawn(async move {
            api.run().await;
        });

        ApiClient { actions_tx }
    }

    fn new(
        http: BaseHTTPClient,
        actions_rx: mpsc::Receiver<ApiAction>,
        messages: mpsc::Sender<Message>,
    ) -> Self {
        Self {
            http,
            actions_rx,
            messages,
        }
    }

    async fn run(mut self) {
        while let Some(action) = self.actions_rx.recv().await {
            self.dispatch(action).await;
        }
    }

    async fn dispatch(&mut self, action: ApiAction) {
        match action {
            ApiAction::SelectProduct(id) => {
                _ = self.select_product(id).await;
            }
        }
    }

    pub async fn select_product(&self, id: String) -> anyhow::Result<()> {
        self.messages.send(Message::RequestStarted).await?;
        let config = Config::with_product(id.to_string());
        self.http.put_void("v2/config", &config).await?;
        self.messages.send(Message::RequestFinished).await?;
        self.messages.send(Message::ProductSelected).await?;
        Ok(())
    }
}

/// Monitors the events coming from the API and updates the ApiState.
struct ApiMonitor {
    _state: Arc<Mutex<ApiState>>,
    ws: WebSocketClient,
    messages: mpsc::Sender<Message>,
}

impl ApiMonitor {
    pub fn new(
        _state: Arc<Mutex<ApiState>>,
        ws: WebSocketClient,
        messages: mpsc::Sender<Message>,
    ) -> Self {
        Self {
            _state,
            ws,
            messages,
        }
    }

    async fn run(mut self) {
        loop {
            if let Ok(_) = self.ws.receive().await {
                // TODO: update the state accordingly to the event.
                self.messages
                    .send(Message::ApiStateChanged)
                    .await
                    .expect("Could not send the message, channel closed (?)");
            }
        }
    }
}
