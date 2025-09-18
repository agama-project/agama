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

use crate::{
    server::{Proposal, Scope, ScopeConfig, SystemInfo},
    supervisor,
};
use agama_lib::install_settings::InstallSettings;
use agama_utils::{Handler as AgamaHandler, Service as _};
use tokio::sync::mpsc;

use crate::{
    server::ServerError,
    supervisor::{Action, Message, Service},
};

#[derive(Clone)]
pub struct Handler {
    sender: mpsc::UnboundedSender<Message>,
}

impl Handler {
    pub async fn start() -> Result<Self, ServerError> {
        let (sender, receiver) = mpsc::unbounded_channel();
        let mut service = Service::start(receiver).await?;
        tokio::spawn(async move {
            service.run().await;
        });

        Ok(Self { sender })
    }

    pub async fn get_config(&self) -> Result<InstallSettings, ServerError> {
        let result = self
            .send_and_wait(|tx| Message::GetConfig { respond_to: tx })
            .await?;
        Ok(result)
    }

    pub fn update_config(&self, config: &InstallSettings) -> Result<(), ServerError> {
        self.send(Message::UpdateConfig {
            config: config.clone(),
        })?;
        Ok(())
    }

    pub fn patch_config(&self, config: &InstallSettings) -> Result<(), ServerError> {
        self.send(Message::PatchConfig {
            config: config.clone(),
        })?;
        Ok(())
    }

    pub async fn get_scope_config(&self, scope: Scope) -> Result<Option<ScopeConfig>, ServerError> {
        let result = self
            .send_and_wait(|tx| Message::GetScopeConfig {
                scope,
                respond_to: tx,
            })
            .await?;
        Ok(result)
    }

    pub fn update_scope_config(&self, config: ScopeConfig) -> Result<(), ServerError> {
        self.send(Message::UpdateScopeConfig {
            config: config.clone(),
        })?;
        Ok(())
    }

    pub fn patch_scope_config(&self, config: ScopeConfig) -> Result<(), ServerError> {
        self.send(Message::PatchScopeConfig {
            config: config.clone(),
        })?;
        Ok(())
    }

    pub async fn get_user_config(&self) -> Result<InstallSettings, ServerError> {
        let result = self
            .send_and_wait(|tx| Message::GetUserConfig { respond_to: tx })
            .await?;
        Ok(result)
    }

    pub async fn get_proposal(&self) -> Result<Option<Proposal>, ServerError> {
        let result = self
            .send_and_wait(|tx| Message::GetProposal { respond_to: tx })
            .await?;
        Ok(result)
    }

    pub async fn get_system(&self) -> Result<SystemInfo, ServerError> {
        let result = self
            .send_and_wait(|tx| Message::GetSystem { respond_to: tx })
            .await?;
        Ok(result)
    }
}

impl AgamaHandler for Handler {
    type Err = ServerError;
    type Message = supervisor::Message;

    fn channel(&self) -> &mpsc::UnboundedSender<Self::Message> {
        &self.sender
    }
}
