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

use agama_lib::http::{BaseHTTPClient, BaseHTTPClientError, WebSocketClient, WebSocketError};
use agama_utils::{
    actor::{self, Actor, Error as ActorError, Handler, MessageHandler},
    api::{Config, Event, SystemInfo},
};
use async_trait::async_trait;
use tokio::sync::mpsc;

use crate::{api::message, event::AppEvent};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    HTTP(#[from] BaseHTTPClientError),
    #[error(transparent)]
    WebSocket(#[from] WebSocketError),
    #[error(transparent)]
    Actor(#[from] ActorError),
}

#[derive(Default)]
struct ServiceState {
    // NOTE: should it be the whole ServerStat an Option?
    system_info: Option<SystemInfo>,
    config: Option<Config>,
}

/// Represents the state of the Agama server.
///
/// It retrieves the information on startup and listens to the websocket to keep it up-to-date.
pub struct Service {
    http: BaseHTTPClient,
    state: ServiceState,
}

impl Service {
    pub fn new(http: BaseHTTPClient) -> Self {
        Service {
            http,
            state: ServiceState::default(),
        }
    }

    pub async fn read_system_info(&mut self) -> Result<(), Error> {
        let system_info = self.http.get::<SystemInfo>("v2/system").await?;
        self.state.system_info = Some(system_info);
        Ok(())
    }

    pub async fn read_config(&mut self) -> Result<(), Error> {
        let config = self.http.get::<Config>("v2/config").await?;
        self.state.config = Some(config);
        Ok(())
    }

    pub fn starter(
        http: BaseHTTPClient,
        ws: WebSocketClient,
        events_rx: mpsc::Sender<AppEvent>,
    ) -> ServerStarter {
        ServerStarter::new(http, ws, events_rx)
    }
}

pub struct ServerStarter {
    http: BaseHTTPClient,
    ws: WebSocketClient,
    events_tx: mpsc::Sender<AppEvent>,
}

impl ServerStarter {
    pub fn new(
        http: BaseHTTPClient,
        ws: WebSocketClient,
        events_tx: mpsc::Sender<AppEvent>,
    ) -> Self {
        Self {
            http,
            ws,
            events_tx,
        }
    }

    pub async fn start(self) -> Result<Handler<Service>, Error> {
        let mut service = Service::new(self.http);
        service.read_system_info().await?;
        service.read_config().await?;

        let handler = actor::spawn(service);

        // Listen for changes.
        let mut monitor = Monitor::new(self.ws, handler.clone(), self.events_tx);
        tokio::task::spawn(async move {
            monitor.run().await;
        });

        Ok(handler)
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::Get<SystemInfo>> for Service {
    async fn handle(
        &mut self,
        _message: message::Get<SystemInfo>,
    ) -> Result<Option<SystemInfo>, Error> {
        Ok(self.state.system_info.clone())
    }
}

#[async_trait]
impl MessageHandler<message::Get<Config>> for Service {
    async fn handle(&mut self, _message: message::Get<Config>) -> Result<Option<Config>, Error> {
        Ok(self.state.config.clone())
    }
}

#[async_trait]
impl MessageHandler<message::ReadSystemInfo> for Service {
    async fn handle(&mut self, _message: message::ReadSystemInfo) -> Result<(), Error> {
        self.read_system_info().await
    }
}

#[async_trait]
impl MessageHandler<message::ReadConfig> for Service {
    async fn handle(&mut self, _message: message::ReadConfig) -> Result<(), Error> {
        self.read_config().await
    }
}

/// Listens for events and asks the service to refresh the information when it changes.
///
/// NOTE: ideally, Agama should provide the new object in the event. As it is not the case (yet),
/// we need to do an extra call to the API.
struct Monitor {
    ws: WebSocketClient,
    server: Handler<Service>,
    events_tx: mpsc::Sender<AppEvent>,
}

impl Monitor {
    pub fn new(
        ws: WebSocketClient,
        server: Handler<Service>,
        events_tx: mpsc::Sender<AppEvent>,
    ) -> Self {
        Self {
            ws,
            server,
            events_tx,
        }
    }

    pub async fn run(&mut self) {
        loop {
            if let Ok(event) = self.ws.receive().await {
                self.events_tx
                    .send(AppEvent::Api(event.clone()))
                    .await
                    .expect("Could not send the message, channel closed (?)");
                match event {
                    Event::SystemChanged { scope: _ } => {
                        _ = self.server.cast(message::ReadSystemInfo);
                    }
                    Event::ConfigChanged { scope: _ } => {
                        _ = self.server.cast(message::ReadConfig);
                    }
                    _ => {}
                }
            }
        }
    }
}
