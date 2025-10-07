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

use crate::supervisor::{
    l10n,
    message::{self, Action},
    proposal::Proposal,
    scope::{ConfigScope, Scope},
    system_info::SystemInfo,
};
use agama_lib::install_settings::InstallSettings;
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    progress,
};
use async_trait::async_trait;
use merge_struct::merge;
use serde::Serialize;
use std::convert::Infallible;

const PROGRESS_SCOPE: &str = "main";

fn progress_scope() -> String {
    PROGRESS_SCOPE.to_string()
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Cannot merge the configuration")]
    MergeConfig,
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    Progress(#[from] progress::service::Error),
    #[error(transparent)]
    L10n(#[from] l10n::service::Error),
    #[error(transparent)]
    Infallible(#[from] Infallible),
}

#[derive(Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum State {
    /// Configuring the installation
    Configuring,
    /// Installing the system
    Installing,
    /// Installation finished
    Finished,
}

pub struct Service {
    progress: Handler<progress::Service>,
    l10n: Handler<l10n::Service>,
    state: State,
    config: InstallSettings,
}

impl Service {
    pub fn new(progress: Handler<progress::Service>, l10n: Handler<l10n::Service>) -> Self {
        Self {
            progress,
            l10n,
            state: State::Configuring,
            config: InstallSettings::default(),
        }
    }

    async fn start_install(&mut self) -> Result<(), Error> {
        self.state = State::Installing;
        // TODO: translate progress steps.
        self.progress
            .call(progress::message::StartWithSteps::new(
                progress_scope(),
                vec!["Installing l10n".to_string()],
            ))
            .await?;
        Ok(())
    }

    async fn progress_step(&self) -> Result<(), Error> {
        self.progress
            .call(progress::message::Next::new(progress_scope()))
            .await?;
        Ok(())
    }

    async fn finish_install(&mut self) -> Result<(), Error> {
        self.state = State::Finished;
        self.progress
            .call(progress::message::Finish::new(progress_scope()))
            .await?;
        Ok(())
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::GetStatus> for Service {
    /// It returns the status of the installation.
    async fn handle(&mut self, _message: message::GetStatus) -> Result<message::Status, Error> {
        let progresses = self.progress.call(progress::message::Get).await?;
        Ok(message::Status {
            state: self.state.clone(),
            progresses,
        })
    }
}

#[async_trait]
impl MessageHandler<message::GetSystem> for Service {
    /// It returns the information of the underlying system.
    async fn handle(&mut self, _message: message::GetSystem) -> Result<SystemInfo, Error> {
        let l10n_system = self.l10n.call(l10n::message::GetSystem).await?;
        Ok(SystemInfo {
            localization: l10n_system,
        })
    }
}

#[async_trait]
impl MessageHandler<message::GetExtendedConfig> for Service {
    /// Gets the current configuration.
    ///
    /// It includes user and default values.
    async fn handle(
        &mut self,
        _message: message::GetExtendedConfig,
    ) -> Result<InstallSettings, Error> {
        let l10n_config = self.l10n.call(l10n::message::GetConfig).await?;
        Ok(InstallSettings {
            localization: Some(l10n_config),
            ..Default::default()
        })
    }
}

#[async_trait]
impl MessageHandler<message::GetExtendedConfigScope> for Service {
    /// It returns the configuration for the given scope.
    async fn handle(
        &mut self,
        message: message::GetExtendedConfigScope,
    ) -> Result<Option<ConfigScope>, Error> {
        let option = match message.scope {
            Scope::L10n => {
                let l10n_config = self.l10n.call(l10n::message::GetConfig).await?;
                Some(ConfigScope::L10n(l10n_config))
            }
        };
        Ok(option)
    }
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    /// Gets the current configuration set by the user.
    ///
    /// It includes only the values that were set by the user.
    async fn handle(&mut self, _message: message::GetConfig) -> Result<InstallSettings, Error> {
        Ok(self.config.clone())
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig> for Service {
    /// Sets the user configuration with the given values.
    ///
    /// It merges the values in the top-level. Therefore, if the configuration
    /// for a scope is not given, it keeps the previous one.
    ///
    /// FIXME: We should replace not given sections with the default ones.
    /// After all, now we have config/user/:scope URLs.
    async fn handle(&mut self, message: message::SetConfig) -> Result<(), Error> {
        if let Some(l10n_config) = &message.config.localization {
            self.l10n
                .call(l10n::message::SetConfig::new(l10n_config.clone()))
                .await?;
        }
        self.config = message.config;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::UpdateConfig> for Service {
    /// Patches the user configuration with the given values.
    ///
    /// It merges the current configuration with the given one.
    async fn handle(&mut self, message: message::UpdateConfig) -> Result<(), Error> {
        let config = merge(&self.config, &message.config).map_err(|_| Error::MergeConfig)?;
        self.handle(message::SetConfig::new(config)).await
    }
}

#[async_trait]
impl MessageHandler<message::GetConfigScope> for Service {
    /// It returns the configuration set by the user for the given scope.
    async fn handle(
        &mut self,
        message: message::GetConfigScope,
    ) -> Result<Option<ConfigScope>, Error> {
        // FIXME: implement this logic at InstallSettings level: self.get_config().by_scope(...)
        // It would allow us to drop this method.
        let option = match message.scope {
            Scope::L10n => self
                .config
                .localization
                .clone()
                .map(|c| ConfigScope::L10n(c)),
        };
        Ok(option)
    }
}

#[async_trait]
impl MessageHandler<message::SetConfigScope> for Service {
    /// Sets the user configuration within the given scope.
    ///
    /// It replaces the current configuration with the given one and calculates a
    /// new proposal. Only the configuration in the given scope is affected.
    async fn handle(&mut self, message: message::SetConfigScope) -> Result<(), Error> {
        match message.config {
            ConfigScope::L10n(l10n_config) => {
                self.l10n
                    .call(l10n::message::SetConfig::new(l10n_config.clone()))
                    .await?;
                self.config.localization = Some(l10n_config);
            }
        }
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::UpdateConfigScope> for Service {
    /// Patches the user configuration within the given scope.
    ///
    /// It merges the current configuration with the given one.
    async fn handle(&mut self, message: message::UpdateConfigScope) -> Result<(), Error> {
        match message.config {
            ConfigScope::L10n(l10n_config) => {
                let base_config = self.config.localization.clone().unwrap_or_default();
                let config = merge(&base_config, &l10n_config).map_err(|_| Error::MergeConfig)?;
                self.handle(message::SetConfigScope::new(ConfigScope::L10n(config)))
                    .await?;
            }
        }
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::GetProposal> for Service {
    /// It returns the current proposal, if any.
    async fn handle(&mut self, _message: message::GetProposal) -> Result<Option<Proposal>, Error> {
        let localization = self.l10n.call(l10n::message::GetProposal).await?;
        Ok(Some(Proposal { localization }))
    }
}

#[async_trait]
impl MessageHandler<message::RunAction> for Service {
    /// It runs the given action.
    async fn handle(&mut self, message: message::RunAction) -> Result<(), Error> {
        match message.action {
            Action::ConfigureL10n(config) => {
                let l10n_message = l10n::message::SetSystem::new(config);
                self.l10n.call(l10n_message).await?;
            }
            Action::Install => {
                self.start_install().await?;
                self.progress_step().await?;
                self.l10n.call(l10n::message::Install).await?;
                self.finish_install().await?
            }
        }
        Ok(())
    }
}
