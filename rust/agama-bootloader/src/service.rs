// Copyright (c) [2025-2026] SUSE LLC
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
    message, storage_client,
};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::bootloader::Config,
};
use async_trait::async_trait;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    Client(#[from] client::Error),
    #[error(transparent)]
    StorageClient(#[from] storage_client::Error),
}

/// Builds and spawns the bootloader service.
///
/// This struct allows to build a bootloader service. It allows replacing
/// the client for a custom one.
pub struct Starter {
    connection: zbus::Connection,
    client: Option<Box<dyn client::BootloaderClient + Send + 'static>>,
}

impl Starter {
    /// Creates a new starter.
    ///
    /// * `connection`: connection to the D-Bus.
    pub fn new(connection: zbus::Connection) -> Self {
        Self {
            connection,
            client: None,
        }
    }

    /// Sets a custom client.
    pub fn with_client(mut self, client: impl client::BootloaderClient + Send + 'static) -> Self {
        self.client = Some(Box::new(client));
        self
    }

    /// Starts the service and returns a handler to communicate with it.
    pub async fn start(self) -> Result<Handler<Service>, Error> {
        let client = match self.client {
            Some(client) => client,
            None => {
                let storage_client = storage_client::service::Starter::new(self.connection.clone())
                    .start()
                    .await?;
                Box::new(Client::new(storage_client).await?)
            }
        };
        let service = Service { client };
        let handler = actor::spawn(service);
        Ok(handler)
    }
}

/// Bootloader service.
///
/// It is responsible for handling the bootloader configuration.
pub struct Service {
    client: Box<dyn client::BootloaderClient + Send + 'static>,
}

impl Service {
    pub fn starter(connection: zbus::Connection) -> Starter {
        Starter::new(connection)
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(&mut self, _message: message::GetConfig) -> Result<Config, Error> {
        Ok(self.client.get_config().await?)
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig<Config>> for Service {
    async fn handle(&mut self, message: message::SetConfig<Config>) -> Result<(), Error> {
        self.client
            .set_config(&message.config.unwrap_or_default())
            .await?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::SetKernelArg> for Service {
    async fn handle(&mut self, message: message::SetKernelArg) -> Result<(), Error> {
        self.client.set_kernel_arg(message.id, message.value).await;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::SetLocale> for Service {
    async fn handle(&mut self, _message: message::SetLocale) -> Result<(), Error> {
        Ok(())
    }
}
