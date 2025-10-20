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
    config::Config,
    event::{self},
    message,
    model::{
        license::{Error as LicenseError, LicensesRepo},
        products::{ProductsRegistry, ProductsRegistryError},
        ModelAdapter,
    },
    proposal::Proposal,
    system_info::SystemInfo,
    zypp_server::{self, SoftwareAction},
};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    issue::{self},
};
use async_trait::async_trait;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("software service could not send the event")]
    Event,
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error("Failed to send message to libzypp thread: {0}")]
    ZyppSender(#[from] tokio::sync::mpsc::error::SendError<SoftwareAction>),
    #[error("Failed to receive result from libzypp thread: {0}")]
    ZyppReceiver(#[from] tokio::sync::oneshot::error::RecvError),
    #[error(transparent)]
    IO(#[from] std::io::Error),
    #[error("There is no proposal for software")]
    MissingProposal,
    #[error("There is no product selected")]
    MissingProduct,
    #[error("There is no {0} product")]
    WrongProduct(String),
    #[error(transparent)]
    ProductsRegistry(#[from] ProductsRegistryError),
    #[error(transparent)]
    License(#[from] LicenseError),
    #[error(transparent)]
    ZyppServerError(#[from] zypp_server::ZyppServerError),
    #[error(transparent)]
    ZyppError(#[from] zypp_agama::errors::ZyppError),
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
    model: Box<dyn ModelAdapter + Send + 'static>,
    products: ProductsRegistry,
    licenses: LicensesRepo,
    issues: Handler<issue::Service>,
    events: event::Sender,
    state: State,
}

#[derive(Default)]
struct State {
    config: Config,
    system: SystemInfo,
}

impl Service {
    pub fn new<T: ModelAdapter>(
        model: T,
        issues: Handler<issue::Service>,
        events: event::Sender,
    ) -> Service {
        Self {
            model: Box::new(model),
            issues,
            events,
            licenses: LicensesRepo::default(),
            products: ProductsRegistry::default(),
            state: Default::default(),
        }
    }

    pub fn read(&mut self) -> Result<(), Error> {
        self.licenses.read()?;
        self.products.read()?;
        Ok(())
    }

    pub fn update_system(&mut self) -> Result<(), Error> {
        let licenses = self.licenses.licenses().into_iter().cloned().collect();
        let products = self.products.products();

        self.state.system = SystemInfo {
            licenses,
            products,
            ..Default::default()
        };

        Ok(())
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::GetSystem> for Service {
    async fn handle(&mut self, _message: message::GetSystem) -> Result<SystemInfo, Error> {
        Ok(self.state.system.clone())
    }
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(&mut self, _message: message::GetConfig) -> Result<Config, Error> {
        Ok(self.state.config.clone())
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig<Config>> for Service {
    async fn handle(&mut self, message: message::SetConfig<Config>) -> Result<(), Error> {
        todo!();
    }
}

#[async_trait]
impl MessageHandler<message::GetProposal> for Service {
    async fn handle(&mut self, _message: message::GetProposal) -> Result<Option<Proposal>, Error> {
        todo!();
    }
}

#[async_trait]
impl MessageHandler<message::Probe> for Service {
    async fn handle(&mut self, _message: message::Probe) -> Result<(), Error> {
        let Some(product_id) = self.state.config.product.clone().and_then(|c| c.id) else {
            return Err(Error::MissingProduct);
        };

        let Some(product) = self.products.find(&product_id) else {
            return Err(Error::WrongProduct(product_id));
        };

        self.model.probe(product).await?;
        self.update_system();
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::Install> for Service {
    async fn handle(&mut self, _message: message::Install) -> Result<bool, Error> {
        self.model.install().await
    }
}

#[async_trait]
impl MessageHandler<message::Finish> for Service {
    async fn handle(&mut self, _message: message::Finish) -> Result<(), Error> {
        self.model.finish()?;
        Ok(())
    }
}
