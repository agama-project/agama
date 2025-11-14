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

use crate::{l10n, message, network, software, storage};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        self, event,
        manager::{self, LicenseContent},
        status::State,
        Action, Config, Event, Issue, IssueMap, IssueSeverity, Proposal, Scope, Status, SystemInfo,
    },
    issue, licenses,
    products::{self, ProductSpec},
    progress, question,
};
use async_trait::async_trait;
use merge_struct::merge;
use network::NetworkSystemClient;
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Missing product")]
    MissingProduct,
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
    Products(#[from] products::Error),
    #[error(transparent)]
    Licenses(#[from] licenses::Error),
    #[error(transparent)]
    Progress(#[from] progress::service::Error),
    #[error(transparent)]
    Network(#[from] network::error::Error),
    // TODO: we could unify network errors when we refactor the network service to work like the
    // rest.
    #[error(transparent)]
    NetworkSystem(#[from] network::NetworkSystemError),
}

pub struct Starter {
    questions: Handler<question::Service>,
    events: event::Sender,
    dbus: zbus::Connection,
    l10n: Option<Handler<l10n::Service>>,
    network: Option<NetworkSystemClient>,
    software: Option<Handler<software::Service>>,
    storage: Option<Handler<storage::Service>>,
    issues: Option<Handler<issue::Service>>,
    progress: Option<Handler<progress::Service>>,
}

impl Starter {
    pub fn new(
        questions: Handler<question::Service>,
        events: event::Sender,
        dbus: zbus::Connection,
    ) -> Self {
        Self {
            events,
            dbus,
            questions,
            l10n: None,
            network: None,
            software: None,
            storage: None,
            issues: None,
            progress: None,
        }
    }

    pub fn with_network(mut self, network: NetworkSystemClient) -> Self {
        self.network = Some(network);
        self
    }

    pub fn with_software(mut self, software: Handler<software::Service>) -> Self {
        self.software = Some(software);
        self
    }

    pub fn with_storage(mut self, storage: Handler<storage::Service>) -> Self {
        self.storage = Some(storage);
        self
    }

    pub fn with_l10n(mut self, l10n: Handler<l10n::Service>) -> Self {
        self.l10n = Some(l10n);
        self
    }

    pub fn with_issues(mut self, issues: Handler<issue::Service>) -> Self {
        self.issues = Some(issues);
        self
    }

    pub fn with_progress(mut self, progress: Handler<progress::Service>) -> Self {
        self.progress = Some(progress);
        self
    }

    /// Starts the service and returns a handler to communicate with it.
    pub async fn start(self) -> Result<Handler<Service>, Error> {
        let issues = match self.issues {
            Some(issues) => issues,
            None => issue::start(self.events.clone()).await?,
        };

        let progress = match self.progress {
            Some(progress) => progress,
            None => progress::Service::starter(self.events.clone()).start(),
        };

        let l10n = match self.l10n {
            Some(l10n) => l10n,
            None => {
                l10n::Service::starter(self.events.clone(), issues.clone())
                    .start()
                    .await?
            }
        };

        let software = match self.software {
            Some(software) => software,
            None => {
                software::Service::builder(
                    self.events.clone(),
                    issues.clone(),
                    progress.clone(),
                    self.questions.clone(),
                )
                .start()
                .await?
            }
        };

        let storage = match self.storage {
            Some(storage) => storage,
            None => {
                storage::Service::starter(
                    self.events.clone(),
                    issues.clone(),
                    progress.clone(),
                    self.dbus.clone(),
                )
                .start()
                .await?
            }
        };

        let network = match self.network {
            Some(network) => network,
            None => network::start().await?,
        };

        let mut service = Service {
            events: self.events,
            questions: self.questions,
            progress,
            issues,
            l10n,
            network,
            software,
            storage,
            products: products::Registry::default(),
            licenses: licenses::Registry::default(),
            // FIXME: state is already used for service state.
            state: State::Configuring,
            config: Config::default(),
            system: manager::SystemInfo::default(),
            product: None,
        };

        service.setup().await?;
        Ok(actor::spawn(service))
    }
}

pub struct Service {
    l10n: Handler<l10n::Service>,
    software: Handler<software::Service>,
    network: NetworkSystemClient,
    storage: Handler<storage::Service>,
    issues: Handler<issue::Service>,
    progress: Handler<progress::Service>,
    questions: Handler<question::Service>,
    products: products::Registry,
    licenses: licenses::Registry,
    product: Option<Arc<RwLock<ProductSpec>>>,
    state: State,
    config: Config,
    system: manager::SystemInfo,
    events: event::Sender,
}

impl Service {
    pub fn starter(
        questions: Handler<question::Service>,
        events: event::Sender,
        dbus: zbus::Connection,
    ) -> Starter {
        Starter::new(questions, events, dbus)
    }

    /// Set up the service by reading the registries and determining the default product.
    ///
    /// If a default product is set, it asks the other services to initialize their configurations.
    pub async fn setup(&mut self) -> Result<(), Error> {
        self.read_registries().await?;

        if let Some(product) = self.products.default_product() {
            let config = Config::with_product(product.id.clone());
            self.set_config(config).await?;
        }

        Ok(())
    }

    async fn read_registries(&mut self) -> Result<(), Error> {
        self.licenses.read()?;
        self.products.read()?;
        self.system.licenses = self.licenses.licenses().into_iter().cloned().collect();
        self.system.products = self.products.products();
        Ok(())
    }

    async fn set_config(&mut self, config: Config) -> Result<(), Error> {
        self.set_product(&config)?;

        let Some(product) = &self.product else {
            return Err(Error::MissingProduct);
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

    async fn update_config(&mut self, config: Config) -> Result<(), Error> {
        self.set_product(&config)?;

        let Some(product) = &self.product else {
            return Err(Error::MissingProduct);
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
        let software = self.software.call(software::message::GetSystem).await?;
        Ok(SystemInfo {
            l10n,
            manager,
            network,
            storage,
            software,
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
        self.set_config(message.config).await
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
        self.update_config(config).await
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
impl MessageHandler<message::GetLicense> for Service {
    async fn handle(
        &mut self,
        message: message::GetLicense,
    ) -> Result<Option<LicenseContent>, Error> {
        Ok(self.licenses.find(&message.id, &message.lang))
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
