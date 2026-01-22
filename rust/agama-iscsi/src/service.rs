// Copyright (c) [2026] SUSE LLC
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

use crate::{
    client::{self, Client},
    message,
    monitor::{self, Monitor},
    storage,
};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::event,
    progress,
};
use async_trait::async_trait;
use serde_json::Value;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    Client(#[from] client::Error),
    #[error(transparent)]
    Monitor(#[from] monitor::Error),
}

pub struct Starter {
    storage: Handler<storage::Service>,
    events: event::Sender,
    progress: Handler<progress::Service>,
    connection: zbus::Connection,
    client: Option<Box<dyn client::ISCSIClient + Send + 'static>>,
}

impl Starter {
    pub fn new(
        storage: Handler<storage::Service>,
        events: event::Sender,
        progress: Handler<progress::Service>,
        connection: zbus::Connection,
    ) -> Self {
        Self {
            storage,
            events,
            progress,
            connection,
            client: None,
        }
    }

    pub fn with_client(mut self, client: impl client::ISCSIClient + Send + 'static) -> Self {
        self.client = Some(Box::new(client));
        self
    }

    pub async fn start(self) -> Result<Handler<Service>, Error> {
        let client = match self.client {
            Some(client) => client,
            None => Box::new(Client::new(self.connection.clone()).await?),
        };
        let service = Service { client };
        let handler = actor::spawn(service);

        let monitor = Monitor::new(self.storage, self.progress, self.events, self.connection);
        monitor::spawn(monitor)?;

        Ok(handler)
    }
}

pub struct Service {
    client: Box<dyn client::ISCSIClient + Send + 'static>,
}

impl Service {
    pub fn starter(
        storage: Handler<storage::Service>,
        events: event::Sender,
        progress: Handler<progress::Service>,
        connection: zbus::Connection,
    ) -> Starter {
        Starter::new(storage, events, progress, connection)
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::Discover> for Service {
    async fn handle(&mut self, message: message::Discover) -> Result<u32, Error> {
        let result = self.client.discover(message.config).await?;
        Ok(result)
    }
}

#[async_trait]
impl MessageHandler<message::GetSystem> for Service {
    async fn handle(&mut self, _message: message::GetSystem) -> Result<Option<Value>, Error> {
        let system = self.client.get_system().await?;
        Ok(system)
    }
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(&mut self, _message: message::GetConfig) -> Result<Option<Value>, Error> {
        let config = self.client.get_config().await?;
        Ok(config)
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig> for Service {
    async fn handle(&mut self, message: message::SetConfig) -> Result<(), Error> {
        self.client.set_config(message.config).await?;
        Ok(())
    }
}
