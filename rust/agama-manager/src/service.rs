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

use crate::{l10n, message, network, storage};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        self, event, status::State, Action, Config, Event, IssueMap, Proposal, Scope, Status,
        SystemInfo,
    },
    issue, progress, question,
};
use async_trait::async_trait;
use merge_struct::merge;
use network::{NetworkSystemClient, NetworkSystemError};
use serde_json::Value;
use tokio::sync::broadcast;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Cannot merge the configuration")]
    MergeConfig,
    #[error(transparent)]
    Event(#[from] broadcast::error::SendError<Event>),
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    L10n(#[from] l10n::service::Error),
    #[error(transparent)]
    Storage(#[from] storage::service::Error),
    #[error(transparent)]
    Issues(#[from] issue::service::Error),
    #[error(transparent)]
    Questions(#[from] question::service::Error),
    #[error(transparent)]
    Progress(#[from] progress::service::Error),
    #[error(transparent)]
    NetworkSystemError(#[from] NetworkSystemError),
}

pub struct Service {
    l10n: Handler<l10n::Service>,
    network: NetworkSystemClient,
    storage: Handler<storage::Service>,
    issues: Handler<issue::Service>,
    progress: Handler<progress::Service>,
    questions: Handler<question::Service>,
    state: State,
    config: Config,
    events: event::Sender,
}

impl Service {
    pub fn new(
        l10n: Handler<l10n::Service>,
        network: NetworkSystemClient,
        storage: Handler<storage::Service>,
        issues: Handler<issue::Service>,
        progress: Handler<progress::Service>,
        questions: Handler<question::Service>,
        events: event::Sender,
    ) -> Self {
        Self {
            l10n,
            network,
            storage,
            issues,
            progress,
            questions,
            events,
            state: State::Configuring,
            config: Config::default(),
        }
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
        let storage = self.storage.call(storage::message::GetSystem).await?;
        let network = self.network.get_system_config().await?;
        Ok(SystemInfo {
            l10n,
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
        let questions = self.questions.call(question::message::GetConfig).await?;
        let network = self.network.get_config().await?;
        let storage = self.storage.call(storage::message::GetConfig).await?;

        Ok(Config {
            l10n: Some(l10n),
            questions: questions,
            network: Some(network),
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
    /// Sets the config.
    async fn handle(&mut self, message: message::SetConfig) -> Result<(), Error> {
        let config = message.config;

        self.l10n
            .call(l10n::message::SetConfig::new(config.l10n.clone()))
            .await?;

        self.questions
            .call(question::message::SetConfig::new(config.questions.clone()))
            .await?;

        self.storage
            .call(storage::message::SetConfig::new(config.storage.clone()))
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
                .call(storage::message::SetConfig::with(storage.clone()))
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
        let storage = self.storage.call(storage::message::GetProposal).await?;
        let network = self.network.get_proposal().await?;

        Ok(Some(Proposal {
            l10n,
            network,
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
