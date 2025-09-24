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
    proposal::Proposal,
    scope::{Scope, ScopeConfig},
    service::{self, Action, Message},
    system_info::SystemInfo,
};
use agama_lib::install_settings::InstallSettings;
use agama_utils::{handler, Handler as AgamaHandler};
use tokio::sync::mpsc;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Handler(#[from] handler::Error<Message>),
    #[error(transparent)]
    Service(#[from] service::Error),
}

#[derive(Clone)]
pub struct Handler {
    sender: mpsc::UnboundedSender<Message>,
}

impl Handler {
    pub fn new(sender: mpsc::UnboundedSender<Message>) -> Self {
        Self { sender }
    }

    pub async fn get_system(&self) -> Result<SystemInfo, Error> {
        let result = self
            .send_and_wait(|tx| Message::GetSystem { respond_to: tx })
            .await?;
        Ok(result)
    }

    pub async fn get_config(&self) -> Result<InstallSettings, Error> {
        let result = self
            .send_and_wait(|tx| Message::GetConfig { respond_to: tx })
            .await?;
        Ok(result)
    }

    pub fn update_config(&self, config: &InstallSettings) -> Result<(), Error> {
        self.send(Message::UpdateConfig {
            config: config.clone(),
        })?;
        Ok(())
    }

    pub fn patch_config(&self, config: &InstallSettings) -> Result<(), Error> {
        self.send(Message::PatchConfig {
            config: config.clone(),
        })?;
        Ok(())
    }

    pub async fn get_scope_config(&self, scope: Scope) -> Result<Option<ScopeConfig>, Error> {
        let result = self
            .send_and_wait(|tx| Message::GetScopeConfig {
                scope,
                respond_to: tx,
            })
            .await?;
        Ok(result)
    }

    pub fn update_scope_config(&self, config: ScopeConfig) -> Result<(), Error> {
        self.send(Message::UpdateScopeConfig {
            config: config.clone(),
        })?;
        Ok(())
    }

    pub fn patch_scope_config(&self, config: ScopeConfig) -> Result<(), Error> {
        self.send(Message::PatchScopeConfig {
            config: config.clone(),
        })?;
        Ok(())
    }

    pub async fn get_user_config(&self) -> Result<InstallSettings, Error> {
        let result = self
            .send_and_wait(|tx| Message::GetUserConfig { respond_to: tx })
            .await?;
        Ok(result)
    }

    pub async fn get_proposal(&self) -> Result<Option<Proposal>, Error> {
        let result = self
            .send_and_wait(|tx| Message::GetProposal { respond_to: tx })
            .await?;
        Ok(result)
    }

    pub async fn run_action(&self, action: Action) -> Result<(), Error> {
        self.send(Message::RunAction { action })
    }
}

impl AgamaHandler for Handler {
    type Err = Error;
    type Message = Message;

    fn channel(&self) -> &mpsc::UnboundedSender<Self::Message> {
        &self.sender
    }
}
