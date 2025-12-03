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

use std::sync::Arc;

use agama_lib::http::{BaseHTTPClient, WebSocketClient};
use agama_utils::api::{Config, SystemInfo};
use tokio::sync::{mpsc, Mutex};

use crate::event::AppEvent;

pub struct ApiState {
    pub system_info: SystemInfo,
    pub config: Config,
}

impl ApiState {
    pub async fn from_client(http: &BaseHTTPClient) -> anyhow::Result<Self> {
        let system_info = http.get::<SystemInfo>("v2/system").await?;
        let config = http.get::<Config>("v2/config").await?;

        Ok(Self {
            system_info,
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
pub struct ApiClient {
    actions_tx: mpsc::Sender<ApiAction>,
}

impl ApiClient {
    /// Selects a product.
    pub async fn select_product(&mut self, id: String) -> anyhow::Result<()> {
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
    events: mpsc::Sender<AppEvent>,
}

impl Api {
    /// Starts the API interface and returns a client to interact with it.
    pub fn start(
        state: Arc<Mutex<ApiState>>,
        http: BaseHTTPClient,
        ws: WebSocketClient,
        events: mpsc::Sender<AppEvent>,
    ) -> ApiClient {
        let (actions_tx, actions_rx) = mpsc::channel(16);

        let monitor = ApiMonitor::new(state, ws, events.clone());
        tokio::task::spawn(async move {
            monitor.run().await;
        });

        let api = Api::new(http, actions_rx, events);
        tokio::spawn(async move {
            api.run().await;
        });

        ApiClient { actions_tx }
    }

    fn new(
        http: BaseHTTPClient,
        actions_rx: mpsc::Receiver<ApiAction>,
        events: mpsc::Sender<AppEvent>,
    ) -> Self {
        Self {
            http,
            actions_rx,
            events,
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

    async fn select_product(&mut self, id: String) -> anyhow::Result<()> {
        self.events.send(AppEvent::RequestStarted).await?;
        let config = Config::with_product(id);
        self.http.put_void("v2/config", &config).await?;
        self.events.send(AppEvent::RequestFinished).await?;
        self.events.send(AppEvent::ProductSelected).await?;
        Ok(())
    }
}

/// Monitors the events coming from the API and updates the ApiState.
struct ApiMonitor {
    _state: Arc<Mutex<ApiState>>,
    ws: WebSocketClient,
    events: mpsc::Sender<AppEvent>,
}

impl ApiMonitor {
    pub fn new(
        _state: Arc<Mutex<ApiState>>,
        ws: WebSocketClient,
        events: mpsc::Sender<AppEvent>,
    ) -> Self {
        Self { _state, ws, events }
    }

    async fn run(mut self) {
        loop {
            if let Ok(_) = self.ws.receive().await {
                // TODO: update the state accordingly to the event.
                self.events
                    .send(AppEvent::ApiStateChanged)
                    .await
                    .expect("Could not send the message, channel closed (?)");
            }
        }
    }
}
