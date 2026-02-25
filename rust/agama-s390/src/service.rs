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
    dasd::{self, client::DASDClient},
    message, storage,
};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        event,
        s390::{Config, SystemInfo},
    },
    progress,
};
use async_trait::async_trait;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    DASDClient(#[from] dasd::client::Error),
    #[error(transparent)]
    DASDMonitor(#[from] dasd::monitor::Error),
}

pub struct Starter {
    storage: Handler<storage::Service>,
    events: event::Sender,
    progress: Handler<progress::Service>,
    connection: zbus::Connection,
    dasd: Option<Box<dyn DASDClient + Send + 'static>>,
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
            dasd: None,
        }
    }

    pub fn with_dasd(mut self, client: impl DASDClient + Send + 'static) -> Self {
        self.dasd = Some(Box::new(client));
        self
    }

    pub async fn start(self) -> Result<Handler<Service>, Error> {
        let dasd_client = match self.dasd {
            Some(client) => client,
            None => Box::new(dasd::Client::new(self.connection.clone()).await?),
        };
        let service = Service { dasd: dasd_client };
        let handler = actor::spawn(service);

        let dasd_monitor =
            dasd::Monitor::new(self.storage, self.progress, self.events, self.connection);
        dasd::monitor::spawn(dasd_monitor)?;

        Ok(handler)
    }
}

pub struct Service {
    dasd: Box<dyn DASDClient + Send + 'static>,
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
impl MessageHandler<message::ProbeDASD> for Service {
    async fn handle(&mut self, _message: message::ProbeDASD) -> Result<(), Error> {
        self.dasd.probe().await?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::GetSystem> for Service {
    async fn handle(&mut self, _message: message::GetSystem) -> Result<SystemInfo, Error> {
        let dasd = self.dasd.get_system().await?;
        Ok(SystemInfo { dasd })
    }
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(&mut self, _message: message::GetConfig) -> Result<Config, Error> {
        let dasd = self.dasd.get_config().await?;
        Ok(Config { dasd })
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig> for Service {
    async fn handle(&mut self, message: message::SetConfig) -> Result<(), Error> {
        let config = message.config.and_then(|c| c.dasd);
        self.dasd.set_config(config).await?;
        Ok(())
    }
}
