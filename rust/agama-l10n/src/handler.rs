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

use crate::service::Message;
use agama_utils::handler;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Handler(#[from] handler::Error<Message>),
}

// pub struct Handler<T: ModelAdapter + 'static> {
// pub struct Handler {
//     sender: MailboxSender,
// }

// impl<T: ModelAdapter + 'static> Handler<T> {
// impl Handler {
//     pub fn new(sender: MailboxSender) -> Self {
//         Self {
//             sender,
//             // _model: PhantomData::<T>,
//         }
//     }
// }

// impl ActorHandle<Service<Model>> for Handler {
//     type Error = crate::service::Error;

//     fn channel(&mut self) -> &mut agama_utils::actors::MailboxSender {
//         &mut self.sender
//     }
// }
