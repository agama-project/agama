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
    scope::{ConfigScope, Scope},
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
        let system = self
            .send_and_wait(|tx| Message::GetSystem { respond_to: tx })
            .await?;
        Ok(system)
    }

    pub async fn get_full_config(&self) -> Result<InstallSettings, Error> {
        let config = self
            .send_and_wait(|tx| Message::GetFullConfig { respond_to: tx })
            .await?;
        Ok(config)
    }

    pub async fn get_full_config_scope(&self, scope: Scope) -> Result<Option<ConfigScope>, Error> {
        let config_scope = self
            .send_and_wait(|tx| Message::GetFullConfigScope {
                scope,
                respond_to: tx,
            })
            .await?;
        Ok(config_scope)
    }

    pub async fn get_config(&self) -> Result<InstallSettings, Error> {
        let config = self
            .send_and_wait(|tx| Message::GetConfig { respond_to: tx })
            .await?;
        Ok(config)
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

    pub async fn get_config_scope(&self, scope: Scope) -> Result<Option<ConfigScope>, Error> {
        let config_scope = self
            .send_and_wait(|tx| Message::GetConfigScope {
                scope,
                respond_to: tx,
            })
            .await?;
        Ok(config_scope)
    }

    pub fn update_config_scope(&self, config: ConfigScope) -> Result<(), Error> {
        self.send(Message::UpdateConfigScope {
            config: config.clone(),
        })?;
        Ok(())
    }

    pub fn patch_config_scope(&self, config: ConfigScope) -> Result<(), Error> {
        self.send(Message::PatchConfigScope {
            config: config.clone(),
        })?;
        Ok(())
    }

    pub async fn get_proposal(&self) -> Result<Option<Proposal>, Error> {
        let proposal = self
            .send_and_wait(|tx| Message::GetProposal { respond_to: tx })
            .await?;
        Ok(proposal)
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
