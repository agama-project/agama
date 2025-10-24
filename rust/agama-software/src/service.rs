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

use std::{ops::DerefMut, sync::Arc};

use crate::{
    config::Config,
    event,
    message,
    model::{
        license::{Error as LicenseError, LicensesRepo},
        packages::ResolvableType,
        products::{ProductsRegistry, ProductsRegistryError},
        ModelAdapter,
    },
    proposal::Proposal,
    system_info::SystemInfo,
    zypp_server::{self, SoftwareAction},
    Event,
};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    issue::{self},
};
use async_trait::async_trait;
use tokio::sync::{mpsc::error::SendError, Mutex, RwLock};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("software service could not send the event")]
    Event(#[from] SendError<Event>),
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
    model: Arc<Mutex<dyn ModelAdapter + Send + 'static>>,
    products: ProductsRegistry,
    licenses: LicensesRepo,
    issues: Handler<issue::Service>,
    events: event::Sender,
    state: State,
}

#[derive(Default)]
struct State {
    config: Config,
    system: Arc<RwLock<SystemInfo>>,
}

impl Service {
    pub fn new<T: ModelAdapter>(
        model: T,
        issues: Handler<issue::Service>,
        events: event::Sender,
    ) -> Service {
        Self {
            model: Arc::new(Mutex::new(model)),
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

    async fn update_system(&self) -> Result<(), Error> {
        let licenses = self.licenses.licenses().into_iter().cloned().collect();
        let products = self.products.products();

        let mut system = self.state.system.write().await;
        system.licenses = licenses;
        system.products = products;

        self.events.send(Event::SystemChanged)?;

        Ok(())
    }

    async fn apply_config(config: &Config, model: &mut dyn ModelAdapter) -> Result<(), Error> {
        if let Some(software) = &config.software {
            let user_id = "user";
            let patterns = software.patterns.clone().unwrap_or_default();
            let packages = software.packages.clone().unwrap_or_default();
            let extra_repositories = software.extra_repositories.clone().unwrap_or_default();
            // TODO: patterns as it as it can be either set or add/remove set
            model.set_resolvables(user_id, ResolvableType::Package, packages, false)
                .await?;
            // for repositories we should allow also to remove previously defined one, but now for simplicity just check if it there and if not, then add it
            // TODO: replace it with future repository registry
            let existing_repositories = model.repositories().await?;
            let new_repos = extra_repositories
                .iter()
                .filter(|r| {
                    existing_repositories
                        .iter()
                        .find(|repo| repo.alias == r.alias)
                        .is_none()
                })
                .cloned()
                .collect();
            model.add_repositories(new_repos).await?;
        }

        Ok(())
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::GetSystem> for Service {
    async fn handle(&mut self, _message: message::GetSystem) -> Result<SystemInfo, Error> {
        Ok(self.state.system.read().await.clone())
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
        let new_product = message.config.product.as_ref().and_then(|c| c.id.as_ref());
        let need_probe = new_product
            != self.state.config.product.as_ref().and_then(|c| c.id.as_ref());
        let new_product_spec = new_product.and_then(|id| self.products.find(id).and_then(|p| Some(p.clone())));

        self.state.config = message.config.clone();
        self.events.send(Event::ConfigChanged)?;
        let model = self.model.clone();
        tokio::task::spawn( async move {
            let mut my_model = model.lock().await;
            // FIXME: convert unwraps to sending issues
            if need_probe {
                my_model.probe(&new_product_spec.unwrap()).await.unwrap();
            }
            Self::apply_config(&message.config, my_model.deref_mut()).await.unwrap();        
        });
        
        Ok(())
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

        self.model.lock().await.probe(product).await?;
        self.update_system();
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::Install> for Service {
    async fn handle(&mut self, _message: message::Install) -> Result<bool, Error> {
        self.model.lock().await.install().await
    }
}

#[async_trait]
impl MessageHandler<message::Finish> for Service {
    async fn handle(&mut self, _message: message::Finish) -> Result<(), Error> {
        self.model.lock().await.finish().await?;
        Ok(())
    }
}
