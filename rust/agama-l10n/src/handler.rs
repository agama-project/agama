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
    event::EventsSender, monitor, service, L10nAction, Message, Monitor, Proposal, Service,
    SystemInfo, UserConfig,
};
use agama_utils::{handler, Handler as AgamaHandler, Service as _};
use tokio::sync::mpsc;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Handler(#[from] handler::Error<Message>),
    #[error(transparent)]
    Service(#[from] service::Error),
    #[error(transparent)]
    Monitor(#[from] monitor::Error),
}

#[derive(Clone)]
pub struct Handler {
    sender: mpsc::UnboundedSender<Message>,
}

impl Handler {
    pub async fn start(events: EventsSender) -> Result<Self, Error> {
        let (sender, receiver) = mpsc::unbounded_channel();
        let mut service = Service::from_system(receiver, events)?;
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

#[cfg(test)]
mod tests {
    use crate::UserConfig;

    use super::Handler;

    #[tokio::test]
    async fn test_handle_config() -> Result<(), Box<dyn std::error::Error>> {
        let (events_sender, mut events_receiver) = tokio::sync::mpsc::unbounded_channel();
        let handler = Handler::start(events_sender).await?;

        let config = handler.get_config().await?;
        assert_eq!(config.language, Some("en_US.UTF-8".to_string()));

        let user_config = UserConfig {
            language: Some("es_ES.UTF-8".to_string()),
            keyboard: Some("es".to_string()),
            timezone: Some("Atlantic/Canary".to_string()),
        };
        handler.set_config(&user_config).await?;

        let updated = handler.get_config().await?;
        assert_eq!(&updated, &user_config);

        // let event = events_receiver
        //     .recv()
        //     .await
        //     .expect("Did not receive the event");
        Ok(())
    }
}
