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

use crate::{bootloader, files, hardware, hostname, l10n, message, network, software, storage};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        self, event,
        files::scripts::ScriptsGroup,
        manager::{self, LicenseContent},
        status::Stage,
        Action, Config, Event, Issue, IssueMap, Proposal, Scope, Status, SystemInfo,
    },
    issue, licenses,
    products::{self, ProductSpec},
    progress, question,
};
use async_trait::async_trait;
use gettextrs::gettext;
use merge::Merge;
use network::NetworkSystemClient;
use serde_json::Value;
use std::sync::Arc;
use tokio::{
    runtime::Handle,
    sync::{broadcast, RwLock},
};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Missing product")]
    MissingProduct,
    #[error(transparent)]
    Event(#[from] broadcast::error::SendError<Event>),
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    Bootloader(#[from] bootloader::service::Error),
    #[error(transparent)]
    Hostname(#[from] hostname::service::Error),
    #[error(transparent)]
    L10n(#[from] l10n::service::Error),
    #[error(transparent)]
    Software(#[from] software::service::Error),
    #[error(transparent)]
    Storage(#[from] storage::service::Error),
    #[error(transparent)]
    Files(#[from] files::service::Error),
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
    #[error(transparent)]
    Hardware(#[from] hardware::Error),
    #[error("Cannot dispatch this action in {current} stage (expected {expected}).")]
    UnexpectedStage { current: Stage, expected: Stage },
}

pub struct Starter {
    questions: Handler<question::Service>,
    events: event::Sender,
    dbus: zbus::Connection,
    bootloader: Option<Handler<bootloader::Service>>,
    hostname: Option<Handler<hostname::Service>>,
    l10n: Option<Handler<l10n::Service>>,
    network: Option<NetworkSystemClient>,
    software: Option<Handler<software::Service>>,
    storage: Option<Handler<storage::Service>>,
    files: Option<Handler<files::Service>>,
    issues: Option<Handler<issue::Service>>,
    progress: Option<Handler<progress::Service>>,
    hardware: Option<hardware::Registry>,
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
            bootloader: None,
            hostname: None,
            l10n: None,
            network: None,
            software: None,
            storage: None,
            files: None,
            issues: None,
            progress: None,
            hardware: None,
        }
    }

    pub fn with_bootloader(mut self, bootloader: Handler<bootloader::Service>) -> Self {
        self.bootloader = Some(bootloader);
        self
    }
    pub fn with_hostname(mut self, hostname: Handler<hostname::Service>) -> Self {
        self.hostname = Some(hostname);
        self
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

    pub fn with_files(mut self, files: Handler<files::Service>) -> Self {
        self.files = Some(files);
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

    pub fn with_hardware(mut self, hardware: hardware::Registry) -> Self {
        self.hardware = Some(hardware);
        self
    }

    /// Starts the service and returns a handler to communicate with it.
    pub async fn start(self) -> Result<Handler<Service>, Error> {
        let issues = match self.issues {
            Some(issues) => issues,
            None => issue::Service::starter(self.events.clone()).start(),
        };

        let progress = match self.progress {
            Some(progress) => progress,
            None => progress::Service::starter(self.events.clone()).start(),
        };

        let bootloader = match self.bootloader {
            Some(bootloader) => bootloader,
            None => {
                bootloader::Service::starter(self.dbus.clone(), issues.clone())
                    .start()
                    .await?
            }
        };
        let hostname = match self.hostname {
            Some(hostname) => hostname,
            None => {
                hostname::Service::starter(self.events.clone(), issues.clone())
                    .start()
                    .await?
            }
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
                software::Service::starter(
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

        let files = match self.files {
            Some(files) => files,
            None => {
                files::Service::starter(progress.clone(), self.questions.clone(), software.clone())
                    .start()
                    .await?
            }
        };

        let network = match self.network {
            Some(network) => network,
            None => network::start().await?,
        };

        let hardware = match self.hardware {
            Some(hardware) => hardware,
            None => hardware::Registry::new_from_system(),
        };

        let mut service = Service {
            questions: self.questions,
            progress,
            issues,
            bootloader,
            hostname,
            l10n,
            network,
            software,
            storage,
            files,
            products: products::Registry::default(),
            licenses: licenses::Registry::default(),
            hardware,
            config: Config::default(),
            system: manager::SystemInfo::default(),
            product: None,
        };

        service.setup().await?;
        Ok(actor::spawn(service))
    }
}

pub struct Service {
    bootloader: Handler<bootloader::Service>,
    hostname: Handler<hostname::Service>,
    l10n: Handler<l10n::Service>,
    software: Handler<software::Service>,
    network: NetworkSystemClient,
    storage: Handler<storage::Service>,
    files: Handler<files::Service>,
    issues: Handler<issue::Service>,
    progress: Handler<progress::Service>,
    questions: Handler<question::Service>,
    products: products::Registry,
    licenses: licenses::Registry,
    hardware: hardware::Registry,
    product: Option<Arc<RwLock<ProductSpec>>>,
    config: Config,
    system: manager::SystemInfo,
}

impl Service {
    pub fn starter(
        questions: Handler<question::Service>,
        events: event::Sender,
        dbus: zbus::Connection,
    ) -> Starter {
        Starter::new(questions, events, dbus)
    }

    /// Set up the service by reading the registries, the hardware info and determining the default product.
    ///
    /// If a default product is set, it asks the other services to initialize their configurations.
    pub async fn setup(&mut self) -> Result<(), Error> {
        self.read_system_info().await?;

        if let Some(product) = self.products.default_product() {
            let config = Config::with_product(product.id.clone());
            self.set_config(config).await?;
        } else {
            self.update_issues()?;
        };

        Ok(())
    }

    async fn read_system_info(&mut self) -> Result<(), Error> {
        self.licenses.read()?;
        self.products.read()?;
        self.hardware.read().await?;

        self.system.licenses = self.licenses.licenses().into_iter().cloned().collect();
        self.system.products = self.products.products();
        self.system.hardware = self.hardware.to_hardware_info();

        Ok(())
    }

    async fn set_config(&mut self, config: Config) -> Result<(), Error> {
        self.set_product(&config)?;

        let Some(product) = &self.product else {
            return Err(Error::MissingProduct);
        };

        self.hostname
            .call(hostname::message::SetConfig::new(config.hostname.clone()))
            .await?;

        self.files
            .call(files::message::SetConfig::new(config.files.clone()))
            .await?;

        self.files
            .call(files::message::RunScripts::new(ScriptsGroup::Pre))
            .await?;

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

        // call bootloader always after storage to ensure that bootloader reflect new storage settings
        self.bootloader
            .call(bootloader::message::SetConfig::new(
                config.bootloader.clone(),
            ))
            .await?;

        if let Some(network) = config.network.clone() {
            self.network.update_config(network).await?;
            self.network.apply().await?;
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
            let issue = Issue::new("no_product", "No product has been selected.");
            self.issues
                .cast(issue::message::Set::new(Scope::Manager, vec![issue]))?;
        }
        Ok(())
    }

    async fn check_stage(&self, expected: Stage) -> Result<(), Error> {
        let current = self.progress.call(progress::message::GetStage).await?;
        if current != expected {
            return Err(Error::UnexpectedStage { expected, current });
        }
        Ok(())
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<progress::message::GetStatus> for Service {
    /// It returns the status of the installation.
    async fn handle(&mut self, message: progress::message::GetStatus) -> Result<Status, Error> {
        let status = self.progress.call(message).await?;
        Ok(status)
    }
}

#[async_trait]
impl MessageHandler<message::GetSystem> for Service {
    /// It returns the information of the underlying system.
    async fn handle(&mut self, _message: message::GetSystem) -> Result<SystemInfo, Error> {
        let hostname = self.hostname.call(hostname::message::GetSystem).await?;
        let l10n = self.l10n.call(l10n::message::GetSystem).await?;
        let manager = self.system.clone();
        let storage = self.storage.call(storage::message::GetSystem).await?;
        let network = self.network.get_system().await?;
        let software = self.software.call(software::message::GetSystem).await?;
        Ok(SystemInfo {
            hostname,
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
        let bootloader = self
            .bootloader
            .call(bootloader::message::GetConfig)
            .await?
            .to_option();
        let hostname = self.hostname.call(hostname::message::GetConfig).await?;
        let l10n = self.l10n.call(l10n::message::GetConfig).await?;
        let software = self.software.call(software::message::GetConfig).await?;
        let questions = self.questions.call(question::message::GetConfig).await?;
        let network = self.network.get_config().await?;
        let storage = self.storage.call(storage::message::GetConfig).await?;

        Ok(Config {
            bootloader,
            hostname: Some(hostname),
            l10n: Some(l10n),
            questions,
            network: Some(network),
            software: Some(software),
            storage,
            files: None,
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
        self.check_stage(Stage::Configuring).await?;
        self.set_config(message.config).await
    }
}

#[async_trait]
impl MessageHandler<message::UpdateConfig> for Service {
    /// Patches the config.
    ///
    /// It merges the current config with the given one. If some scope is missing in the given
    /// config, then it keeps the values from the current config.
    async fn handle(&mut self, message: message::UpdateConfig) -> Result<(), Error> {
        self.check_stage(Stage::Configuring).await?;
        let mut new_config = message.config;
        new_config.merge(self.config.clone());
        self.set_config(new_config).await
    }
}

#[async_trait]
impl MessageHandler<message::GetProposal> for Service {
    /// It returns the current proposal, if any.
    async fn handle(&mut self, _message: message::GetProposal) -> Result<Option<Proposal>, Error> {
        let hostname = self.hostname.call(hostname::message::GetProposal).await?;
        let l10n = self.l10n.call(l10n::message::GetProposal).await?;
        let software = self.software.call(software::message::GetProposal).await?;
        let storage = self.storage.call(storage::message::GetProposal).await?;
        let network = self.network.get_proposal().await?;

        Ok(Some(Proposal {
            hostname,
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
        self.check_stage(Stage::Configuring).await?;

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
                let action = InstallAction {
                    l10n: self.l10n.clone(),
                    network: self.network.clone(),
                    software: self.software.clone(),
                    storage: self.storage.clone(),
                    files: self.files.clone(),
                    progress: self.progress.clone(),
                };
                action.run();
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
        self.check_stage(Stage::Configuring).await?;
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
        self.check_stage(Stage::Configuring).await?;
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
        self.check_stage(Stage::Configuring).await?;
        self.software.call(message).await?;
        Ok(())
    }
}

/// Implements the installation process.
///
/// This action runs on a separate Tokio task to prevent the manager from blocking.
struct InstallAction {
    l10n: Handler<l10n::Service>,
    network: NetworkSystemClient,
    software: Handler<software::Service>,
    storage: Handler<storage::Service>,
    files: Handler<files::Service>,
    progress: Handler<progress::Service>,
}

impl InstallAction {
    /// Runs the installation process on a separate Tokio task.
    pub fn run(mut self) {
        tokio::spawn(async move {
            if let Err(error) = self.install().await {
                tracing::error!("Installation failed: {error}");
                if let Err(error) = self
                    .progress
                    .call(progress::message::SetStage::new(Stage::Failed))
                    .await
                {
                    tracing::error!(
                        "It was not possible to set the stage to {}: {error}",
                        Stage::Failed
                    );
                }
            }
        });
    }

    async fn install(&mut self) -> Result<(), Error> {
        // NOTE: consider a NextState message?
        self.progress
            .call(progress::message::SetStage::new(Stage::Installing))
            .await?;

        //
        // Preparation
        //
        self.progress
            .call(progress::message::StartWithSteps::new(
                Scope::Manager,
                vec![
                    gettext("Prepare the system"),
                    gettext("Install software"),
                    gettext("Configure the system"),
                ],
            ))
            .await?;

        self.storage.call(storage::message::Install).await?;
        self.files
            .call(files::message::RunScripts::new(
                ScriptsGroup::PostPartitioning,
            ))
            .await?;

        //
        // Installation
        //
        self.progress
            .call(progress::message::Next::new(Scope::Manager))
            .await?;
        self.software.call(software::message::Install).await?;

        //
        // Configuration
        //
        self.progress
            .call(progress::message::Next::new(Scope::Manager))
            .await?;
        self.l10n.call(l10n::message::Install).await?;
        self.software.call(software::message::Finish).await?;
        self.files.call(files::message::WriteFiles).await?;
        self.storage.call(storage::message::Finish).await?;

        //
        // Finish progress and changes
        //
        self.progress
            .call(progress::message::Finish::new(Scope::Manager))
            .await?;

        self.progress
            .call(progress::message::SetStage::new(Stage::Finished))
            .await?;
        Ok(())
    }
}
