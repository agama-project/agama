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
    message, storage, storage_client,
    zfcp::{self, client::ZFCPClient},
};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        event,
        s390::{Config, SystemInfo},
    },
    issue, progress,
};
use async_trait::async_trait;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    DASDClient(#[from] dasd::client::Error),
    #[error(transparent)]
    ZFCPClient(#[from] zfcp::client::Error),
    #[error(transparent)]
    DASDMonitor(#[from] dasd::monitor::Error),
    #[error(transparent)]
    ZFCPMonitor(#[from] zfcp::monitor::Error),
    #[error(transparent)]
    StorageClient(#[from] storage_client::Error),
}

pub struct Starter {
    storage: Handler<storage::Service>,
    events: event::Sender,
    progress: Handler<progress::Service>,
    issues: Handler<issue::Service>,
    connection: zbus::Connection,
    dasd: Option<Box<dyn DASDClient + Send + 'static>>,
    zfcp: Option<Box<dyn ZFCPClient + Send + 'static>>,
}

impl Starter {
    pub fn new(
        storage: Handler<storage::Service>,
        events: event::Sender,
        progress: Handler<progress::Service>,
        issues: Handler<issue::Service>,
        connection: zbus::Connection,
    ) -> Self {
        Self {
            storage,
            events,
            progress,
            issues,
            connection,
            dasd: None,
            zfcp: None,
        }
    }

    pub fn with_dasd(mut self, client: impl DASDClient + Send + 'static) -> Self {
        self.dasd = Some(Box::new(client));
        self
    }

    pub fn with_zfcp(mut self, client: impl ZFCPClient + Send + 'static) -> Self {
        self.zfcp = Some(Box::new(client));
        self
    }

    pub async fn start(self) -> Result<Handler<Service>, Error> {
        // Create storage_client only if needed.
        let (service, storage_client) = match (self.dasd, self.zfcp) {
            (Some(dasd), Some(zfcp)) => {
                let service = Service { dasd, zfcp };
                (service, None)
            }
            (dasd_opt, zfcp_opt) => {
                let storage_client = storage_client::service::Starter::new(self.connection.clone())
                    .start()
                    .await?;

                let dasd =
                    dasd_opt.unwrap_or_else(|| Box::new(dasd::Client::new(storage_client.clone())));

                let zfcp =
                    zfcp_opt.unwrap_or_else(|| Box::new(zfcp::Client::new(storage_client.clone())));

                let service = Service { dasd, zfcp };

                (service, Some(storage_client))
            }
        };

        let handler = actor::spawn(service);

        let dasd_monitor = dasd::Monitor::new(
            self.storage.clone(),
            self.progress.clone(),
            self.events.clone(),
            self.connection.clone(),
        );
        dasd::monitor::spawn(dasd_monitor)?;

        // FIXME: allow mocking storage_client instead of preventing its creation during tests.
        if let Some(storage_client) = storage_client {
            let zfcp_monitor = zfcp::Monitor::new(
                self.storage,
                self.progress,
                self.issues,
                self.events,
                self.connection,
                storage_client.clone(),
            );
            zfcp::monitor::spawn(zfcp_monitor)?;
        }

        Ok(handler)
    }
}

pub struct Service {
    dasd: Box<dyn DASDClient + Send + 'static>,
    zfcp: Box<dyn ZFCPClient + Send + 'static>,
}

impl Service {
    pub fn starter(
        storage: Handler<storage::Service>,
        events: event::Sender,
        progress: Handler<progress::Service>,
        issues: Handler<issue::Service>,
        connection: zbus::Connection,
    ) -> Starter {
        Starter::new(storage, events, progress, issues, connection)
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
impl MessageHandler<message::ProbeZFCP> for Service {
    async fn handle(&mut self, _message: message::ProbeZFCP) -> Result<(), Error> {
        self.zfcp.probe().await?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::GetSystem> for Service {
    async fn handle(&mut self, _message: message::GetSystem) -> Result<SystemInfo, Error> {
        let dasd = self.dasd.get_system().await?;
        let zfcp = self.zfcp.get_system().await?;
        Ok(SystemInfo { dasd, zfcp })
    }
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(&mut self, _message: message::GetConfig) -> Result<Config, Error> {
        let dasd = self.dasd.get_config().await?;
        let zfcp = self.zfcp.get_config().await?;
        Ok(Config { dasd, zfcp })
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig> for Service {
    async fn handle(&mut self, message: message::SetConfig) -> Result<(), Error> {
        if let Some(config) = message.config {
            self.dasd.set_config(config.dasd).await?;
            self.zfcp.set_config(config.zfcp).await?;
        } else {
            self.dasd.set_config(None).await?;
            self.zfcp.set_config(None).await?;
        }
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::SetLocale> for Service {
    async fn handle(&mut self, _message: message::SetLocale) -> Result<(), Error> {
        self.zfcp.probe().await?;
        Ok(())
    }
}
