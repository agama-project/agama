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
    bootloader, checks, files, hardware, hostname, iscsi, l10n, message, network, proxy, s390,
    security, software, storage, tasks, users,
};
use agama_users::PasswordCheckResult;
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        self, event,
        manager::{self, LicenseContent},
        status::Stage,
        Action, Config, Event, FinishMethod, Issue, IssueMap, Proposal, Scope, Status, SystemInfo,
    },
    arch::Arch,
    issue, licenses,
    products::{self, ProductSpec},
    progress, question,
};
use async_trait::async_trait;
use merge::Merge;
use network::NetworkSystemClient;
use serde_json::Value;
use std::{collections::HashMap, process::Command, sync::Arc};
use tokio::sync::{broadcast, RwLock};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Event(#[from] broadcast::error::SendError<Event>),
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    Bootloader(#[from] bootloader::service::Error),
    #[error(transparent)]
    Hostname(#[from] hostname::service::Error),
    #[error(transparent)]
    ISCSI(#[from] iscsi::service::Error),
    #[error(transparent)]
    L10n(#[from] l10n::service::Error),
    #[error(transparent)]
    Security(#[from] security::service::Error),
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
    Proxy(#[from] proxy::service::Error),
    #[error(transparent)]
    Hardware(#[from] hardware::Error),
    #[error("Cannot dispatch this action in {current} stage (expected {expected}).")]
    UnexpectedStage { current: Stage, expected: Stage },
    #[error("Failed to perform the action because the system is busy: {scopes:?}.")]
    Busy { scopes: Vec<Scope> },
    #[error(
        "It is not possible to install the system because there are some pending issues: {issues:?}."
    )]
    PendingIssues { issues: HashMap<Scope, Vec<Issue>> },
    #[error(transparent)]
    Users(#[from] users::service::Error),
    #[error(transparent)]
    S390(#[from] s390::service::Error),
}

pub struct Starter {
    questions: Handler<question::Service>,
    events: event::Sender,
    dbus: zbus::Connection,
    bootloader: Option<Handler<bootloader::Service>>,
    hostname: Option<Handler<hostname::Service>>,
    iscsi: Option<Handler<iscsi::Service>>,
    l10n: Option<Handler<l10n::Service>>,
    network: Option<NetworkSystemClient>,
    proxy: Option<Handler<proxy::Service>>,
    security: Option<Handler<security::Service>>,
    software: Option<Handler<software::Service>>,
    storage: Option<Handler<storage::Service>>,
    files: Option<Handler<files::Service>>,
    issues: Option<Handler<issue::Service>>,
    progress: Option<Handler<progress::Service>>,
    hardware: Option<hardware::Registry>,
    users: Option<Handler<users::Service>>,
    s390: Option<Handler<s390::Service>>,
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
            iscsi: None,
            l10n: None,
            network: None,
            proxy: None,
            security: None,
            software: None,
            storage: None,
            files: None,
            issues: None,
            progress: None,
            hardware: None,
            users: None,
            s390: None,
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

    pub fn with_iscsi(mut self, iscsi: Handler<iscsi::Service>) -> Self {
        self.iscsi = Some(iscsi);
        self
    }

    pub fn with_network(mut self, network: NetworkSystemClient) -> Self {
        self.network = Some(network);
        self
    }

    pub fn with_security(mut self, security: Handler<security::Service>) -> Self {
        self.security = Some(security);
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

    pub fn with_proxy(mut self, proxy: Handler<proxy::Service>) -> Self {
        self.proxy = Some(proxy);
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

    pub fn with_users(mut self, users: Handler<users::Service>) -> Self {
        self.users = Some(users);
        self
    }

    pub fn with_s390(mut self, s390: Handler<s390::Service>) -> Self {
        self.s390 = Some(s390);
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

        let proxy = match self.proxy {
            Some(proxy) => proxy,
            None => proxy::Service::starter(self.events.clone()).start()?,
        };

        let l10n = match self.l10n {
            Some(l10n) => l10n,
            None => {
                l10n::Service::starter(self.events.clone(), issues.clone())
                    .start()
                    .await?
            }
        };

        let security = match self.security {
            Some(security) => security,
            None => security::Service::starter(self.questions.clone()).start()?,
        };

        let software = match self.software {
            Some(software) => software,
            None => {
                software::Service::starter(
                    self.events.clone(),
                    issues.clone(),
                    progress.clone(),
                    self.questions.clone(),
                    security.clone(),
                    bootloader.clone(),
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

        let iscsi = match self.iscsi {
            Some(iscsi) => iscsi,
            None => {
                iscsi::Service::starter(
                    storage.clone(),
                    self.events.clone(),
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
            None => {
                network::Service::starter(self.events.clone(), progress.clone())
                    .start()
                    .await?
            }
        };

        let hardware = match self.hardware {
            Some(hardware) => hardware,
            None => hardware::Registry::new_from_system(),
        };

        let users = match self.users {
            Some(users) => users,
            None => {
                users::Service::starter(self.events.clone(), issues.clone())
                    .start()
                    .await?
            }
        };

        let s390 = match self.s390 {
            Some(s390) => Some(s390),
            None => {
                if !Arch::is_s390() {
                    None
                } else {
                    let s390 = s390::Service::starter(
                        storage.clone(),
                        self.events.clone(),
                        progress.clone(),
                        self.dbus.clone(),
                    )
                    .start()
                    .await?;
                    Some(s390)
                }
            }
        };

        let runner = tasks::TasksRunner {
            bootloader: bootloader.clone(),
            files: files.clone(),
            hostname: hostname.clone(),
            iscsi: iscsi.clone(),
            issues: issues.clone(),
            l10n: l10n.clone(),
            network: network.clone(),
            progress: progress.clone(),
            proxy: proxy.clone(),
            questions: self.questions.clone(),
            security: security.clone(),
            software: software.clone(),
            storage: storage.clone(),
            users: users.clone(),
            s390: s390.clone(),
        };
        let tasks = actor::spawn(runner);

        let mut service = Service {
            questions: self.questions,
            progress,
            issues,
            bootloader,
            hostname,
            iscsi,
            l10n,
            network,
            proxy,
            software,
            storage,
            products: products::Registry::default(),
            licenses: licenses::Registry::default(),
            hardware,
            config: Config::default(),
            system: manager::SystemInfo::default(),
            product: None,
            users,
            tasks,
            s390,
        };

        service.setup().await?;
        Ok(actor::spawn(service))
    }
}

pub struct Service {
    bootloader: Handler<bootloader::Service>,
    hostname: Handler<hostname::Service>,
    iscsi: Handler<iscsi::Service>,
    proxy: Handler<proxy::Service>,
    l10n: Handler<l10n::Service>,
    software: Handler<software::Service>,
    network: NetworkSystemClient,
    storage: Handler<storage::Service>,
    issues: Handler<issue::Service>,
    progress: Handler<progress::Service>,
    questions: Handler<question::Service>,
    products: products::Registry,
    licenses: licenses::Registry,
    hardware: hardware::Registry,
    product: Option<Arc<RwLock<ProductSpec>>>,
    config: Config,
    system: manager::SystemInfo,
    users: Handler<users::Service>,
    s390: Option<Handler<s390::Service>>,
    tasks: Handler<tasks::TasksRunner>,
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
        self.network_default().await?;
        self.read_system_info().await?;

        if let Some(product) = self.products.default_product() {
            let config = Config::with_product(product.id.clone());
            self.set_config(config).await?;
        } else {
            self.update_issues()?;
        };

        Ok(())
    }

    // Configure the network according to defaults
    async fn network_default(&mut self) -> Result<(), Error> {
        self.network.propose_default().await?;
        self.network.apply().await?;
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
        self.config = config;

        let set_config = tasks::message::SetConfig::new(self.product.clone(), self.config.clone());
        self.tasks.cast(set_config)?;

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

    async fn discover_iscsi(&self, config: api::iscsi::DiscoverConfig) -> Result<(), Error> {
        self.iscsi
            .call(iscsi::message::Discover::new(config))
            .await?;
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

    async fn probe_dasd(&self) -> Result<(), Error> {
        if let Some(s390) = &self.s390 {
            s390.call(s390::message::ProbeDASD).await?;
        }
        Ok(())
    }

    fn set_product(&mut self, config: &Config) -> Result<(), Error> {
        self.product = None;
        self.update_product(config)
    }

    fn update_product(&mut self, config: &Config) -> Result<(), Error> {
        let product = config.software.as_ref().and_then(|s| s.product.as_ref());

        if let Some(product) = product {
            if let Some(id) = &product.id {
                let mode = product.mode.as_ref().map(|m| m.as_str());
                tracing::debug!("Setting product and mode to {} and {:?}", id, mode);
                let product_spec = self.products.find(&id, mode)?;
                let product = RwLock::new(product_spec.clone());
                self.product = Some(Arc::new(product));
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

    /// Determines whether the software service is available.
    ///
    /// Consider the service as available if there is no pending progress.
    async fn is_software_available(&self) -> Result<bool, Error> {
        let is_empty = self
            .progress
            .call(progress::message::IsEmpty::with_scope(Scope::Software))
            .await?;
        Ok(is_empty)
    }

    /// Returns the product configuration.
    ///
    /// When the software is busy, the configuration will not include the product
    /// information. However, most of that information is already available in the
    /// manager service.
    async fn product_software_config(&self) -> Result<Option<api::software::Config>, Error> {
        let Some(product) = &self.product else {
            return Ok(None);
        };

        let mut software_config = self.config.software.clone().unwrap_or_default();
        let product_config = software_config.product.get_or_insert_default();
        let product = product.read().await;
        product_config.id = Some(product.id.clone());
        product_config.mode = product.mode.clone();

        Ok(Some(software_config))
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
        let proxy = self.proxy.call(proxy::message::GetSystem).await?;
        let l10n = self.l10n.call(l10n::message::GetSystem).await?;
        let manager = self.system.clone();
        let storage = self.storage.call(storage::message::GetSystem).await?;
        let iscsi = self.iscsi.call(iscsi::message::GetSystem).await?;
        let network = self.network.get_system().await?;

        let s390 = if let Some(s390) = &self.s390 {
            Some(s390.call(s390::message::GetSystem).await?)
        } else {
            None
        };

        // If the software service is busy, it will not answer.
        let software = if self.is_software_available().await? {
            self.software.call(software::message::GetSystem).await?
        } else {
            Default::default()
        };

        Ok(SystemInfo {
            hostname,
            proxy,
            l10n,
            manager,
            network,
            storage,
            iscsi,
            s390,
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
        let iscsi = self.iscsi.call(iscsi::message::GetConfig).await?;
        let l10n = self.l10n.call(l10n::message::GetConfig).await?;
        // FIXME: the security service might be busy asking some question, so it cannot answer.
        // By now, let's consider that the whole security configuration is set by the user
        // (ignoring imported certificates by questions).
        let security = self.config.security.clone();
        let proxy = self.proxy.call(proxy::message::GetConfig).await?;
        let questions = self.questions.call(question::message::GetConfig).await?;
        let network = self.network.get_config().await?;
        let storage = self.storage.call(storage::message::GetConfig).await?;
        let users = self.users.call(users::message::GetConfig).await?;

        let s390 = if let Some(s390) = &self.s390 {
            Some(s390.call(s390::message::GetConfig).await?)
        } else {
            None
        };

        // If the software service is busy, it will not answer.
        let software = if self.is_software_available().await? {
            Some(self.software.call(software::message::GetConfig).await?)
        } else {
            self.product_software_config().await?
        };

        Ok(Config {
            bootloader,
            hostname: Some(hostname),
            iscsi,
            l10n: Some(l10n),
            proxy,
            questions,
            network: Some(network),
            security,
            software,
            storage,
            files: None,
            users: Some(users),
            s390,
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
        checks::check_stage(&self.progress, Stage::Configuring).await?;
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
        checks::check_stage(&self.progress, Stage::Configuring).await?;
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
        let storage = self.storage.call(storage::message::GetProposal).await?;
        let network = self.network.get_proposal().await?;
        let users = self.users.call(users::message::GetProposal).await?;

        // If the software service is busy, it will not answer.
        let software = if self.is_software_available().await? {
            self.software.call(software::message::GetProposal).await?
        } else {
            None
        };

        Ok(Some(Proposal {
            hostname,
            l10n,
            network,
            software,
            storage,
            users,
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
                checks::check_stage(&self.progress, Stage::Configuring).await?;
                self.configure_l10n(config).await?;
            }
            Action::DiscoverISCSI(config) => {
                checks::check_stage(&self.progress, Stage::Configuring).await?;
                self.discover_iscsi(config).await?;
            }
            Action::ActivateStorage => {
                checks::check_stage(&self.progress, Stage::Configuring).await?;
                self.activate_storage().await?;
            }
            Action::ProbeStorage => {
                checks::check_stage(&self.progress, Stage::Configuring).await?;
                self.probe_storage().await?;
            }
            Action::ProbeDASD => {
                checks::check_stage(&self.progress, Stage::Configuring).await?;
                self.probe_dasd().await?;
            }
            Action::Install => {
                self.tasks.cast(tasks::message::Install)?;
            }
            Action::Finish(method) => {
                checks::check_stage(&self.progress, Stage::Finished).await?;
                let action = FinishAction::new(method);
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
        checks::check_stage(&self.progress, Stage::Configuring).await?;
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
        checks::check_stage(&self.progress, Stage::Configuring).await?;
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
        checks::check_stage(&self.progress, Stage::Configuring).await?;
        self.software.call(message).await?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<users::message::CheckPassword> for Service {
    async fn handle(
        &mut self,
        message: users::message::CheckPassword,
    ) -> Result<PasswordCheckResult, Error> {
        Ok(self.users.call(message).await?)
    }
}

/// Implements the finish action.
struct FinishAction {
    method: FinishMethod,
}

impl FinishAction {
    pub fn new(method: FinishMethod) -> Self {
        Self { method }
    }

    pub fn run(self) {
        let option = match self.method {
            FinishMethod::Halt => Some("-H"),
            FinishMethod::Reboot => Some("-r"),
            FinishMethod::Poweroff => Some("-P"),
            FinishMethod::Stop => None,
        };
        let mut command = Command::new("shutdown");

        if let Some(switch) = option {
            command.arg(switch);
        } else {
            tracing::info!("Stopped as requested");
            return;
        }

        command.arg("now");
        match command.output() {
            Ok(output) => {
                if !output.status.success() {
                    tracing::error!("Failed to shutdown the system: {output:?}")
                }
            }
            Err(error) => {
                tracing::error!("Failed to run the shutdown command: {error}");
            }
        }
    }
}
