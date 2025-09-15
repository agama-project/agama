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

use agama_utils::service::{Client, Service};
use tokio::sync::{mpsc, oneshot};

use crate::{L10n, L10nAction, L10nConfig, L10nProposal, LocaleError};

#[derive(Debug)]
pub enum L10nCommand {
    GetConfig {
        respond_to: oneshot::Sender<L10nConfig>,
    },
    SetConfig {
        config: L10nConfig,
    },
    GetProposal {
        respond_to: oneshot::Sender<L10nProposal>,
    },
    DispatchAction {
        action: L10nAction,
    },
}

#[derive(Clone)]
pub struct L10nService {
    sender: mpsc::UnboundedSender<L10nCommand>,
}

impl Client for L10nService {
    type Err = LocaleError;
    type Command = L10nCommand;

    fn commands(&self) -> &mpsc::UnboundedSender<Self::Command> {
        &self.sender
    }
}

impl L10nService {
    pub fn start() -> Result<Self, LocaleError> {
        let (sender, receiver) = mpsc::unbounded_channel();
        let mut server = L10n::new(receiver);
        tokio::spawn(async move {
            server.run().await;
        });

        Ok(Self { sender })
    }

    pub async fn get_config(&self) -> Result<L10nConfig, LocaleError> {
        let result = self
            .send_and_wait(|tx| L10nCommand::GetConfig { respond_to: tx })
            .await?;
        Ok(result)
    }

    pub async fn set_config(&self, config: &L10nConfig) -> Result<(), LocaleError> {
        self.send(L10nCommand::SetConfig {
            config: config.clone(),
        })?;
        Ok(())
    }

    pub async fn get_proposal(&self) -> Result<L10nProposal, LocaleError> {
        let result = self
            .send_and_wait(|tx| L10nCommand::GetProposal { respond_to: tx })
            .await?;
        Ok(result)
    }

    pub async fn dispatch_action(&self, action: L10nAction) -> Result<(), LocaleError> {
        self.send(L10nCommand::DispatchAction { action })?;
        Ok(())
    }
}
