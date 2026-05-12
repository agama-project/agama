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
    message,
    model::{self, chrony},
};

use agama_software::{self as software, Resolvable};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{self, event},
};
use async_trait::async_trait;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    Model(#[from] model::Error),
    #[error(transparent)]
    Software(#[from] software::service::Error),
}

pub struct Starter {
    _events: event::Sender,
    model: Box<dyn model::ModelAdapter + Send + 'static>,
    software: Handler<software::Service>,
}

impl Starter {
    pub fn new(events: event::Sender, software: Handler<software::Service>) -> Starter {
        Self {
            _events: events,
            model: Box::new(chrony::Model::new()),

            software,
        }
    }

    pub fn with_model(mut self, model: Box<dyn model::ModelAdapter>) -> Self {
        self.model = model;
        self
    }

    pub async fn start(self) -> Result<Handler<Service>, Error> {
        let mut service = Service {
            config: None,
            model: self.model,
            software: self.software,
        };

        service.setup().await;
        let handler = actor::spawn(service);
        Ok(handler)
    }
}

pub struct Service {
    // FIXME: is this the right place to keep the configuration?
    config: Option<api::ntp::Config>,
    model: Box<dyn model::ModelAdapter + Send + 'static>,
    software: Handler<software::Service>,
}

impl Service {
    pub fn starter(events: event::Sender, software: Handler<software::Service>) -> Starter {
        Starter::new(events, software)
    }

    /// Initializes the service by reading the current configuration.
    pub async fn setup(&mut self) {
        if let Ok(config) = self.model.get_config().await {
            if !config.is_empty() {
                self.config = Some(config);
            }
        }

        tracing::info!("Additional NTP configuration: {:?}", &self.config);
    }

    async fn set_resolvables(&mut self, resolvables: Vec<Resolvable>) {
        let result = self
            .software
            .call(agama_software::message::SetResolvables::new(
                "agama-ntp".to_string(),
                resolvables,
            ))
            .await;

        if let Err(e) = result {
            tracing::error!("Failed to set resolvables for agama-ntp: {e}");
        }
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(
        &mut self,
        _message: message::GetConfig,
    ) -> Result<Option<api::ntp::Config>, Error> {
        Ok(self.config.clone())
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig<api::ntp::Config>> for Service {
    async fn handle(&mut self, message: message::SetConfig<api::ntp::Config>) -> Result<(), Error> {
        if let Some(config) = &message.config {
            if let Err(e) = self.model.write_config(config).await {
                tracing::error!("Failed to write NTP configuration: {e}");
            }

            self.set_resolvables(self.model.resolvables()).await;
        } else {
            if let Err(e) = self.model.remove_config().await {
                tracing::error!("Failed to remove the NTP configuration: {e}");
            }
            self.set_resolvables(vec![]).await;
        }

        if self.config != message.config {
            if let Err(e) = self.model.sync().await {
                tracing::error!("Failed to synchronize with the NTP server: {e}");
            }
        }
        self.config = message.config;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::Finish> for Service {
    async fn handle(&mut self, _message: message::Finish) -> Result<(), Error> {
        if let Some(config) = &self.config {
            if let Err(e) = self.model.install(config).await {
                tracing::error!("Failed to install NTP configuration: {}", e);
            }
        }
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::SetLocale> for Service {
    async fn handle(&mut self, _message: message::SetLocale) -> Result<(), Error> {
        Ok(())
    }
}
