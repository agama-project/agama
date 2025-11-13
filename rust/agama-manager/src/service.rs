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

use std::sync::Arc;

use crate::{l10n, message, network, software, storage};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        self, event, manager, status::State, Action, Config, Event, Issue, IssueMap, IssueSeverity,
        Proposal, Scope, Status, SystemInfo,
    },
    issue,
    license::{Error as LicenseError, LicensesRegistry},
    products::{ProductSpec, ProductsRegistry, ProductsRegistryError},
    progress, question,
};
use async_trait::async_trait;
use merge_struct::merge;
use network::NetworkSystemClient;
use serde_json::Value;
use tokio::sync::{broadcast, RwLock};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Missing product")]
    Product,
    #[error("Cannot merge the configuration")]
    MergeConfig,
    #[error(transparent)]
    Event(#[from] broadcast::error::SendError<Event>),
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    L10n(#[from] l10n::service::Error),
    #[error(transparent)]
    Software(#[from] software::service::Error),
    #[error(transparent)]
    Storage(#[from] storage::service::Error),
    #[error(transparent)]
    Issues(#[from] issue::service::Error),
    #[error(transparent)]
    Questions(#[from] question::service::Error),
    #[error(transparent)]
    ProductsRegistry(#[from] ProductsRegistryError),
    #[error(transparent)]
    License(#[from] LicenseError),
    #[error(transparent)]
    Progress(#[from] progress::service::Error),
    #[error(transparent)]
    Network(#[from] network::NetworkSystemError),
}

pub struct Service {
    l10n: Handler<l10n::Service>,
    software: Handler<software::Service>,
    network: NetworkSystemClient,
    storage: Handler<storage::Service>,
    issues: Handler<issue::Service>,
    progress: Handler<progress::Service>,
    questions: Handler<question::Service>,
    products: ProductsRegistry,
    licenses: LicensesRegistry,
    product: Option<Arc<RwLock<ProductSpec>>>,
    state: State,
    config: Config,
    system: manager::SystemInfo,
    events: event::Sender,
}

impl Service {
    pub fn new(
        l10n: Handler<l10n::Service>,
        network: NetworkSystemClient,
        software: Handler<software::Service>,
        storage: Handler<storage::Service>,
        issues: Handler<issue::Service>,
        progress: Handler<progress::Service>,
        questions: Handler<question::Service>,
        events: event::Sender,
    ) -> Self {
        Self {
            l10n,
            network,
            software,
            storage,
            issues,
            progress,
            questions,
            products: ProductsRegistry::default(),
            licenses: LicensesRegistry::default(),
            // FIXME: state is already used for service state.
            state: State::Configuring,
            config: Config::default(),
            system: manager::SystemInfo::default(),
            product: None,
            events,
        }
    }

    /// Set up the service by reading the registries and determining the default product.
    ///
    /// If a default product is set, it asks the other services to initialize their configurations.
    pub async fn setup(&mut self) -> Result<(), Error> {
        self.read_registries().await?;

        if let Some(product) = self.products.default_product() {
            let product = Arc::new(RwLock::new(product.clone()));
            _ = self.software.cast(software::message::SetConfig::new(
                Arc::clone(&product),
                None,
            ));
            self.product = Some(product);
        }

        self.update_issues()?;
        Ok(())
    }

    async fn read_registries(&mut self) -> Result<(), Error> {
        self.licenses.read()?;
        self.products.read()?;
        self.system.licenses = self.licenses.licenses().into_iter().cloned().collect();
        self.system.products = self.products.products();
        Ok(())
    }

    async fn configure_l10n(&self, config: api::l10n::SystemConfig) -> Result<(), Error> {
        self.l10n
            .call(l10n::message::SetSystem::new(config.clone()))
            .await?;
        if let Some(locale) = config.locale {
            self.storage
                .cast(storage::message::SetLocale::new(locale.as_str()))?;
        }
        Ok(())
    }

    async fn activate_storage(&self) -> Result<(), Error> {
        self.storage.call(storage::message::Activate).await?;
        Ok(())
    }

    async fn probe_storage(&self) -> Result<(), Error> {
        self.storage.call(storage::message::Probe).await?;
        Ok(())
    }

    async fn install(&mut self) -> Result<(), Error> {
        self.state = State::Installing;
        self.events.send(Event::StateChanged)?;
        // TODO: translate progress steps.
        self.progress
            .call(progress::message::StartWithSteps::new(
                Scope::Manager,
                &["Installing l10n"],
            ))
            .await?;
        self.l10n.call(l10n::message::Install).await?;
        self.progress
            .call(progress::message::Finish::new(Scope::Manager))
            .await?;
        self.state = State::Finished;
        self.events.send(Event::StateChanged)?;
        Ok(())
    }

    fn set_product(&mut self, config: &Config) -> Result<(), Error> {
        self.product = None;
        self.update_product(config)
    }

    fn update_product(&mut self, config: &Config) -> Result<(), Error> {
        let product_id = config
            .software
            .as_ref()
            .and_then(|s| s.product.as_ref())
            .and_then(|p| p.id.as_ref());

        if let Some(id) = product_id {
            if let Some(product_spec) = self.products.find(&id) {
                let product = RwLock::new(product_spec.clone());
                self.product = Some(Arc::new(product));
            } else {
                self.product = None;
                tracing::warn!("Unknown product '{id}'");
            }
        }

        self.update_issues()?;
        Ok(())
    }

    fn update_issues(&self) -> Result<(), Error> {
        if self.product.is_some() {
            self.issues
                .cast(issue::message::Clear::new(Scope::Manager))?;
        } else {
            let issue = Issue::new(
                "no_product",
                "No product has been selected.",
                IssueSeverity::Error,
            );
            self.issues
                .cast(issue::message::Set::new(Scope::Manager, vec![issue]))?;
        }
        Ok(())
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::GetStatus> for Service {
    /// It returns the status of the installation.
    async fn handle(&mut self, _message: message::GetStatus) -> Result<Status, Error> {
        let progresses = self.progress.call(progress::message::Get).await?;
        Ok(Status {
            state: self.state.clone(),
            progresses,
        })
    }
}

#[async_trait]
impl MessageHandler<message::GetSystem> for Service {
    /// It returns the information of the underlying system.
    async fn handle(&mut self, _message: message::GetSystem) -> Result<SystemInfo, Error> {
        let l10n = self.l10n.call(l10n::message::GetSystem).await?;
        let manager = self.system.clone();
        let storage = self.storage.call(storage::message::GetSystem).await?;
        let network = self.network.get_system().await?;
        Ok(SystemInfo {
            l10n,
            manager,
            network,
            storage,
        })
    }
}

#[async_trait]
impl MessageHandler<message::GetExtendedConfig> for Service {
    /// Gets the current configuration.
    ///
    /// It includes user and default values.
    async fn handle(&mut self, _message: message::GetExtendedConfig) -> Result<Config, Error> {
        let l10n = self.l10n.call(l10n::message::GetConfig).await?;
        let software = self.software.call(software::message::GetConfig).await?;
        let questions = self.questions.call(question::message::GetConfig).await?;
        let network = self.network.get_config().await?;
        let storage = self.storage.call(storage::message::GetConfig).await?;

        Ok(Config {
            l10n: Some(l10n),
            questions: questions,
            network: Some(network),
            software: Some(software),
            storage,
        })
    }
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    /// Gets the current configuration set by the user.
    ///
    /// It includes only the values that were set by the user.
    async fn handle(&mut self, _message: message::GetConfig) -> Result<Config, Error> {
        Ok(self.config.clone())
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig> for Service {
    /// Sets the user configuration with the given values.
    async fn handle(&mut self, message: message::SetConfig) -> Result<(), Error> {
        let config = message.config;
        self.set_product(&config)?;

        let Some(product) = &self.product else {
            return Err(Error::Product);
        };

        self.questions
            .call(question::message::SetConfig::new(config.questions.clone()))
            .await?;

        self.software
            .call(software::message::SetConfig::new(
                Arc::clone(product),
                config.software.clone(),
            ))
            .await?;

        self.l10n
            .call(l10n::message::SetConfig::new(config.l10n.clone()))
            .await?;

        self.storage
            .call(storage::message::SetConfig::new(
                Arc::clone(product),
                config.storage.clone(),
            ))
            .await?;

        if let Some(network) = config.network.clone() {
            self.network.update_config(network).await?;
            self.network.apply().await?;
        }

        self.config = config;
        Ok(())
    }
}

fn merge_network(mut config: Config, update_config: Config) -> Config {
    if let Some(network) = &update_config.network {
        if let Some(connections) = &network.connections {
            if let Some(ref mut config_network) = config.network {
                config_network.connections = Some(connections.clone());
            }
        }
    }

    config
}

#[async_trait]
impl MessageHandler<message::UpdateConfig> for Service {
    /// Patches the config.
    ///
    /// It merges the current config with the given one. If some scope is missing in the given
    /// config, then it keeps the values from the current config.
    async fn handle(&mut self, message: message::UpdateConfig) -> Result<(), Error> {
        let config = merge(&self.config, &message.config).map_err(|_| Error::MergeConfig)?;
        let config = merge_network(config, message.config);
        self.set_product(&config)?;

        let Some(product) = &self.product else {
            return Err(Error::Product);
        };

        if let Some(l10n) = &config.l10n {
            self.l10n
                .call(l10n::message::SetConfig::with(l10n.clone()))
                .await?;
        }

        if let Some(questions) = &config.questions {
            self.questions
                .call(question::message::SetConfig::with(questions.clone()))
                .await?;
        }

        if let Some(storage) = &config.storage {
            self.storage
                .call(storage::message::SetConfig::with(
                    Arc::clone(product),
                    storage.clone(),
                ))
                .await?;
        }

        if let Some(software) = &config.software {
            self.software
                .call(software::message::SetConfig::with(
                    Arc::clone(product),
                    software.clone(),
                ))
                .await?;
        }

        if let Some(network) = &config.network {
            self.network.update_config(network.clone()).await?;
        }

        self.config = config;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::GetProposal> for Service {
    /// It returns the current proposal, if any.
    async fn handle(&mut self, _message: message::GetProposal) -> Result<Option<Proposal>, Error> {
        let l10n = self.l10n.call(l10n::message::GetProposal).await?;
        let software = self.software.call(software::message::GetProposal).await?;
        let storage = self.storage.call(storage::message::GetProposal).await?;
        let network = self.network.get_proposal().await?;

        Ok(Some(Proposal {
            l10n,
            network,
            software,
            storage,
        }))
    }
}

#[async_trait]
impl MessageHandler<message::GetIssues> for Service {
    /// It returns the current proposal, if any.
    async fn handle(&mut self, _message: message::GetIssues) -> Result<IssueMap, Error> {
        Ok(self.issues.call(issue::message::Get).await?)
    }
}

#[async_trait]
impl MessageHandler<message::RunAction> for Service {
    /// It runs the given action.
    async fn handle(&mut self, message: message::RunAction) -> Result<(), Error> {
        match message.action {
            Action::ConfigureL10n(config) => {
                self.configure_l10n(config).await?;
            }
            Action::ActivateStorage => {
                self.activate_storage().await?;
            }
            Action::ProbeStorage => {
                self.probe_storage().await?;
            }
            Action::Install => {
                self.install().await?;
            }
        }
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::GetStorageModel> for Service {
    /// It returns the storage model.
    async fn handle(&mut self, _message: message::GetStorageModel) -> Result<Option<Value>, Error> {
        Ok(self.storage.call(storage::message::GetConfigModel).await?)
    }
}

#[async_trait]
impl MessageHandler<message::SetStorageModel> for Service {
    /// It sets the storage model.
    async fn handle(&mut self, message: message::SetStorageModel) -> Result<(), Error> {
        Ok(self
            .storage
            .call(storage::message::SetConfigModel::new(message.model))
            .await?)
    }
}

#[async_trait]
impl MessageHandler<message::SolveStorageModel> for Service {
    /// It solves the storage model.
    async fn handle(
        &mut self,
        message: message::SolveStorageModel,
    ) -> Result<Option<Value>, Error> {
        Ok(self
            .storage
            .call(storage::message::SolveConfigModel::new(message.model))
            .await?)
    }
}

// FIXME: write a macro to forward a message.
#[async_trait]
impl MessageHandler<software::message::SetResolvables> for Service {
    /// It sets the software resolvables.
    async fn handle(&mut self, message: software::message::SetResolvables) -> Result<(), Error> {
        self.software.call(message).await?;
        Ok(())
    }
}
