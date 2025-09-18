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

use super::{error::ServerResult, Scope, ScopeConfig, SupervisorError};
use crate::server::{Proposal, SystemInfo};
use agama_l10n::{Handler as L10nHandler, L10nAction};
use agama_lib::install_settings::InstallSettings;
use agama_utils::{Service as AgamaService, ServiceError};
use merge_struct::merge;
use serde::Deserialize;
use tokio::sync::{mpsc, oneshot};

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum Action {
    L10n(L10nAction),
}

#[derive(Debug)]
pub enum Message {
    GetConfig {
        respond_to: oneshot::Sender<InstallSettings>,
    },
    UpdateConfig {
        config: InstallSettings,
    },
    PatchConfig {
        config: InstallSettings,
    },
    GetScopeConfig {
        scope: Scope,
        respond_to: oneshot::Sender<Option<ScopeConfig>>,
    },
    UpdateScopeConfig {
        config: ScopeConfig,
    },
    PatchScopeConfig {
        config: ScopeConfig,
    },
    RunAction {
        action: Action,
    },
    GetSystem {
        respond_to: oneshot::Sender<SystemInfo>,
    },
    GetProposal {
        respond_to: oneshot::Sender<Option<Proposal>>,
    },
    GetUserConfig {
        respond_to: oneshot::Sender<InstallSettings>,
    },
}

pub struct Service {
    l10n: L10nHandler,
    user_config: InstallSettings,
    config: InstallSettings,
    proposal: Option<Proposal>,
    messages: mpsc::UnboundedReceiver<Message>,
}

impl Service {
    pub async fn start(
        messages: mpsc::UnboundedReceiver<Message>,
    ) -> Result<Self, SupervisorError> {
        Ok(Self {
            l10n: L10nHandler::start().await?,
            config: InstallSettings::default(),
            user_config: InstallSettings::default(),
            proposal: None,
            messages,
        })
    }

    /// Gets the current configuration.
    ///
    /// It includes user and default values.
    pub async fn get_config(&self) -> InstallSettings {
        InstallSettings {
            localization: Some(self.l10n.get_config().await.unwrap()),
            ..Default::default()
        }
    }

    /// Gets the current configuration set by the user.
    ///
    /// It includes only the values that were set by the user.
    pub async fn get_user_config(&self) -> &InstallSettings {
        &self.user_config
    }

    /// It returns the configuration for the given scope.
    ///
    /// * scope: scope to get the configuration for.
    pub async fn get_scope_config(&self, scope: Scope) -> Option<ScopeConfig> {
        // FIXME: implement this logic at InstallSettings level: self.get_config().by_scope(...)
        // It would allow us to drop this method.
        match scope {
            Scope::L10n => self
                .config
                .localization
                .clone()
                .map(|c| ScopeConfig::L10n(c)),
        }
    }

    /// Patches the user configuration with the given values.
    ///
    /// It merges the current configuration with the given one.
    pub async fn patch_config(&mut self, user_config: InstallSettings) -> ServerResult<()> {
        let config = merge(&self.user_config, &user_config).unwrap();
        self.update_config(config).await
    }

    /// Sets the user configuration with the given values.
    ///
    /// It merges the values in the top-level. Therefore, if the configuration
    /// for a scope is not given, it keeps the previous one.
    ///
    /// FIXME: We should replace not given sections with the default ones.
    /// After all, now we have config/user/:scope URLs.
    pub async fn update_config(&mut self, user_config: InstallSettings) -> ServerResult<()> {
        if let Some(l10n_user_config) = &user_config.localization {
            self.l10n.set_config(l10n_user_config).await?;
        }
        self.user_config = user_config;
        Ok(())
    }

    /// Patches the user configuration within the given scope.
    ///
    /// It merges the current configuration with the given one.
    pub async fn patch_scope_config(&mut self, user_config: ScopeConfig) -> ServerResult<()> {
        match user_config {
            ScopeConfig::L10n(new_config) => {
                let base_config = self.user_config.localization.clone().unwrap_or_default();
                let config = merge(&base_config, &new_config).unwrap();
                // FIXME: we are doing pattern matching twice. Is it ok?
                // Implementing a "merge" for ScopeConfig would allow to simplify this function.
                self.update_scope_config(ScopeConfig::L10n(config)).await?;
            }
        }

        Ok(())
    }

    /// Sets the user configuration within the given scope.
    ///
    /// It replaces the current configuration with the given one and calculates a
    /// new proposal. Only the configuration in the given scope is affected.
    pub async fn update_scope_config(&mut self, user_config: ScopeConfig) -> ServerResult<()> {
        match user_config {
            ScopeConfig::L10n(new_config) => {
                self.l10n.set_config(&new_config).await?;
                self.user_config.localization = Some(new_config);
            }
        }

        Ok(())
    }

    // TODO: report error if the action fails.
    pub async fn dispatch_action(&mut self, action: Action) {
        match action {
            Action::L10n(l10n_action) => self.l10n.dispatch_action(l10n_action).await.unwrap(),
        }
    }

    /// It returns the current proposal, if any.
    pub async fn get_proposal(&self) -> Option<&Proposal> {
        self.proposal.as_ref()
    }

    /// It returns the information of the underlying system.
    pub async fn get_system(&self) -> Result<SystemInfo, SupervisorError> {
        Ok(SystemInfo {
            localization: self.l10n.get_system().await?,
        })
    }
}

impl AgamaService for Service {
    type Err = SupervisorError;
    type Message = Message;

    fn channel(&mut self) -> &mut tokio::sync::mpsc::UnboundedReceiver<Self::Message> {
        &mut self.messages
    }

    async fn dispatch(&mut self, command: Self::Message) -> Result<(), Self::Err> {
        match command {
            Self::Message::GetConfig { respond_to } => {
                respond_to
                    .send(self.get_config().await)
                    .map_err(|_| ServiceError::SendResponse)?;
            }
            Self::Message::UpdateConfig { config } => {
                self.update_config(config)
                    .await
                    .map_err(|_| ServiceError::SendResponse)?;
            }
            Self::Message::PatchConfig { config } => {
                self.patch_config(config)
                    .await
                    .map_err(|_| ServiceError::SendResponse)?;
            }
            Self::Message::GetScopeConfig { scope, respond_to } => {
                respond_to
                    .send(self.get_scope_config(scope).await)
                    .map_err(|_| ServiceError::SendResponse)?;
            }
            Self::Message::UpdateScopeConfig { config } => {
                self.update_scope_config(config)
                    .await
                    .map_err(|_| ServiceError::SendResponse)?;
            }
            Self::Message::PatchScopeConfig { config } => {
                self.patch_scope_config(config)
                    .await
                    .map_err(|_| ServiceError::SendResponse)?;
            }
            Self::Message::GetProposal { respond_to } => {
                respond_to
                    .send(self.get_proposal().await.cloned())
                    .map_err(|_| ServiceError::SendResponse)?;
            }
            Self::Message::GetSystem { respond_to } => {
                respond_to
                    .send(self.get_system().await?.clone())
                    .map_err(|_| ServiceError::SendResponse)?;
            }
            Self::Message::GetUserConfig { respond_to } => {
                respond_to
                    .send(self.get_user_config().await.clone())
                    .map_err(|_| ServiceError::SendResponse)?;
            }
            _ => {
                unimplemented!("TODO");
            }
        }
        Ok(())
    }
}
