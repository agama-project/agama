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
    event::EventsSender, Error, L10nAction, Message, Monitor, Proposal, Service, SystemInfo,
    UserConfig,
};
use agama_utils::{Handler as AgamaHandler, Service as _};
use tokio::sync::mpsc;

#[derive(Clone)]
pub struct Handler {
    sender: mpsc::UnboundedSender<Message>,
}

impl Handler {
    pub async fn start(events: EventsSender) -> Result<Self, Error> {
        let (sender, receiver) = mpsc::unbounded_channel();
        let mut service = Service::new(receiver, events);
        tokio::spawn(async move {
            service.run().await;
        });

        let mut monitor = Monitor::new(sender.clone()).await?;
        tokio::spawn(async move {
            monitor.run().await.unwrap();
        });

        Ok(Self { sender })
    }

    pub async fn get_config(&self) -> Result<UserConfig, Error> {
        let result = self
            .send_and_wait(|tx| Message::GetConfig { respond_to: tx })
            .await?;
        Ok(result)
    }

    pub async fn set_config(&self, config: &UserConfig) -> Result<(), Error> {
        self.send(Message::SetConfig {
            config: config.clone(),
        })?;
        Ok(())
    }

    pub async fn get_proposal(&self) -> Result<Proposal, Error> {
        let result = self
            .send_and_wait(|tx| Message::GetProposal { respond_to: tx })
            .await?;
        Ok(result)
    }

    pub async fn get_system(&self) -> Result<SystemInfo, Error> {
        let result = self
            .send_and_wait(|tx| Message::GetSystem { respond_to: tx })
            .await?;
        Ok(result)
    }

    pub async fn dispatch_action(&self, action: L10nAction) -> Result<(), Error> {
        self.send(Message::DispatchAction { action })?;
        Ok(())
    }
}

impl AgamaHandler for Handler {
    type Err = Error;
    type Message = Message;

    fn channel(&self) -> &mpsc::UnboundedSender<Self::Message> {
        &self.sender
    }
}
