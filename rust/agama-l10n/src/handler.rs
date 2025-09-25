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

//! Defines the handler to interact with the localization service.

use std::marker::PhantomData;

use crate::{
    model::{Model, ModelAdapter},
    proposal::Proposal,
    service::{Message, Service, SystemConfig},
    system_info::SystemInfo,
    user_config::UserConfig,
};
use agama_utils::{
    actors::{ActorHandle, MailboxSender},
    handler, Handler as AgamaHandler,
};
use tokio::sync::mpsc;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Handler(#[from] handler::Error<Message>),
}

/// Handler to interact with the service.
///
/// It offers a set of functions that allow interacting with the localization
/// service, which runs in a different Tokio task.
#[derive(Clone)]
// pub struct Handler<T: ModelAdapter + 'static> {
pub struct Handler {
    sender: MailboxSender,
}

// impl<T: ModelAdapter + 'static> Handler<T> {
impl Handler {
    pub fn new(sender: MailboxSender) -> Self {
        Self {
            sender,
            // _model: PhantomData::<T>,
        }
    }

    // pub async fn get_system(&self) -> Result<SystemInfo, Error> {
    //     let system = self
    //         .send_and_wait(|tx| Message::GetSystem { respond_to: tx })
    //         .await?;
    //     Ok(system)
    // }

    //     pub async fn set_system(&self, config: SystemConfig) -> Result<(), Error> {
    //         self.send(Message::SetSystem { config })
    //     }

    //     pub async fn get_config(&self) -> Result<UserConfig, Error> {
    //         let config = self
    //             .send_and_wait(|tx| Message::GetConfig { respond_to: tx })
    //             .await?;
    //         Ok(config)
    //     }

    //     pub async fn set_config(&self, config: &UserConfig) -> Result<(), Error> {
    //         self.send(Message::SetConfig {
    //             config: config.clone(),
    //         })
    //     }

    //     pub async fn get_proposal(&self) -> Result<Proposal, Error> {
    //         let proposal = self
    //             .send_and_wait(|tx| Message::GetProposal { respond_to: tx })
    //             .await?;
    //         Ok(proposal)
    //     }

    //     pub async fn install(&self) -> Result<(), Error> {
    //         self.send(Message::Install)
    //     }
}

impl ActorHandle<Service<Model>> for Handler {
    fn channel(&mut self) -> &mut agama_utils::actors::MailboxSender {
        &mut self.sender
    }
}

// impl AgamaHandler for Handler {
//     type Err = Error;
//     type Message = Message;

//     fn channel(&self) -> &mpsc::UnboundedSender<Self::Message> {
//         &self.sender
//     }
// }
