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

use crate::{
    client::{self, Client, StorageClient},
    message,
    monitor::{self, Monitor},
};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{event, storage::Config},
    issue, progress,
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

/// Starts the storage service.
pub struct Starter {
    events: event::Sender,
    issues: Handler<issue::Service>,
    progress: Handler<progress::Service>,
    dbus: zbus::Connection,
    client: Option<Box<dyn StorageClient + Send + 'static>>,
}

impl Starter {
    pub fn new(
        events: event::Sender,
        issues: Handler<issue::Service>,
        progress: Handler<progress::Service>,
        dbus: zbus::Connection,
    ) -> Self {
        Self {
            events,
            issues,
            progress,
            dbus,
            client: None,
        }
    }

    pub fn with_client<T: StorageClient + Send + 'static>(mut self, client: T) -> Self {
        self.client = Some(Box::new(client));
        self
    }

    /// Starts the service and returns a handler to communicate with it.
    pub async fn start(self) -> Result<Handler<Service>, Error> {
        let client = match self.client {
            Some(client) => client,
            None => Box::new(Client::new(self.dbus.clone())),
        };

        let service = Service { client };
        let handler = actor::spawn(service);

        let monitor = Monitor::new(self.progress, self.issues, self.events, self.dbus);
        monitor::spawn(monitor)?;
        Ok(handler)
    }
}

/// Storage service.
pub struct Service {
    client: Box<dyn StorageClient + Send + 'static>,
}

impl Service {
    pub fn starter(
        events: event::Sender,
        issues: Handler<issue::Service>,
        progress: Handler<progress::Service>,
        dbus: zbus::Connection,
    ) -> Starter {
        Starter::new(events, issues, progress, dbus)
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::Activate> for Service {
    async fn handle(&mut self, _message: message::Activate) -> Result<(), Error> {
        self.client.activate().await?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::Probe> for Service {
    async fn handle(&mut self, _message: message::Probe) -> Result<(), Error> {
        self.client.probe().await?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::Install> for Service {
    async fn handle(&mut self, _message: message::Install) -> Result<(), Error> {
        self.client.install().await?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::Finish> for Service {
    async fn handle(&mut self, _message: message::Finish) -> Result<(), Error> {
        self.client.finish().await?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::GetSystem> for Service {
    async fn handle(&mut self, _message: message::GetSystem) -> Result<Option<Value>, Error> {
        self.client.get_system().await.map_err(|e| e.into())
    }
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(&mut self, _message: message::GetConfig) -> Result<Option<Config>, Error> {
        self.client.get_config().await.map_err(|e| e.into())
    }
}

#[async_trait]
impl MessageHandler<message::GetConfigModel> for Service {
    async fn handle(&mut self, _message: message::GetConfigModel) -> Result<Option<Value>, Error> {
        self.client.get_config_model().await.map_err(|e| e.into())
    }
}

#[async_trait]
impl MessageHandler<message::GetProposal> for Service {
    async fn handle(&mut self, _message: message::GetProposal) -> Result<Option<Value>, Error> {
        self.client.get_proposal().await.map_err(|e| e.into())
    }
}

#[async_trait]
impl MessageHandler<message::SetProduct> for Service {
    async fn handle(&mut self, message: message::SetProduct) -> Result<(), Error> {
        self.client.set_product(message.id).await?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig> for Service {
    async fn handle(&mut self, message: message::SetConfig) -> Result<(), Error> {
        self.client
            .set_config(message.product, message.config)
            .await?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::SetConfigModel> for Service {
    async fn handle(&mut self, message: message::SetConfigModel) -> Result<(), Error> {
        self.client.set_config_model(message.model).await?;
        Ok(())
    }
}
#[async_trait]
impl MessageHandler<message::SolveConfigModel> for Service {
    async fn handle(&mut self, message: message::SolveConfigModel) -> Result<Option<Value>, Error> {
        self.client
            .solve_config_model(message.model)
            .await
            .map_err(|e| e.into())
    }
}

#[async_trait]
impl MessageHandler<message::SetLocale> for Service {
    async fn handle(&mut self, message: message::SetLocale) -> Result<(), Error> {
        self.client.set_locale(message.locale).await?;
        Ok(())
    }
}
