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

use agama_utils::{actor::{self, Actor, Handler, MessageHandler}, api::{Issue, bootloader::Config}, issue};
use async_trait::async_trait;

use crate::{client::{self, Client}, message};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    Client(#[from] client::Error),
}

/// Builds and spawns the bootloader service.
///
/// This struct allows to build a bootloader service. It allows replacing
/// the "model" for a custom one.
pub struct Starter {
    connection: zbus::Connection,
    client: Option<Box<dyn client::BootloaderClient + Send + 'static>>,
    issues: Handler<issue::Service>,
}

impl Starter {
    /// Creates a new starter.
    ///
    /// * `issues`: handler to the issues service.
    pub fn new(connection: zbus::Connection, issues: Handler<issue::Service>) -> Self {
        Self {
            connection,
            client: None,
            issues,
        }
    }

    /// Starts the service and returns a handler to communicate with it.
    ///
    /// The service uses a separate monitor to listen to system configuration
    /// changes.
    pub async fn start(self) -> Result<Handler<Service>, Error> {
        let client = match self.client {
            Some(client) => client,
            None => Box::new(Client::new(self.connection.clone()).await?),
        };
        let service = Service {
            config: Config::default(),
            client: client,
            issues: self.issues,
        };
        let handler = actor::spawn(service);
        Ok(handler)
    }
}

/// Localization service.
///
/// It is responsible for handling the localization part of the installation:
///
/// * Reads the list of known locales, keymaps and timezones.
/// * Keeps track of the localization settings of the underlying system (the installer).
/// * Holds the user configuration.
/// * Applies the user configuration at the end of the installation.
pub struct Service {
    config: Config,
    client: Box<dyn client::BootloaderClient + Send + 'static>,
    issues: Handler<issue::Service>,
}

impl Service {
    pub fn starter(connection: zbus::Connection, issues: Handler<issue::Service>) -> Starter {
        Starter::new(connection, issues)
    }

    /// Returns configuration issues.
    ///
    /// It returns an issue for each unknown element (locale, keymap and timezone).
    fn find_issues(&self) -> Vec<Issue> {
        // TODO: get issues from bootloader proposal
        vec![]
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
    async fn handle(
        &mut self,
        message: message::SetConfig<Config>,
    ) -> Result<(), Error> {
        self.client.set_config(&message.config.unwrap_or_default()).await?;
        Ok(())
    }
}