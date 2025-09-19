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

//! Implements utilities to build Agama services.

use core::future::Future;
use std::{any, error::Error};
use tokio::sync::{mpsc, oneshot};

#[derive(thiserror::Error, Debug)]
pub enum ServiceError<T> {
    #[error("Could not send the message to the service")]
    SendError(#[from] mpsc::error::SendError<T>),
    #[error("Could not receive the response")]
    RecvError(#[from] oneshot::error::RecvError),
    #[error("Could not send the response")]
    SendResponse,
}

// Implements the basic behavior for an Agama service.
pub trait Service: Send {
    type Err: From<ServiceError<Self::Message>> + Error;
    type Message: Send;

    /// Returns the service name used for logging and debugging purposes.
    ///
    /// An example might be "agama_l10n::l10n::L10n".
    fn name() -> &'static str {
        any::type_name::<Self>()
    }

    /// Main loop of the service.
    ///
    /// It dispatches one message at a time.
    fn run(&mut self) -> impl Future<Output = ()> + Send {
        async {
            loop {
                let message = self.channel().recv().await;
                let Some(message) = message else {
                    eprintln!("channel closed for {}", Self::name());
                    break;
                };

                if let Err(error) = &mut self.dispatch(message).await {
                    eprintln!("error dispatching command: {error}");
                }
            }
        }
    }

    /// Returns the channel to read the messages from.
    fn channel(&mut self) -> &mut mpsc::UnboundedReceiver<Self::Message>;

    /// Dispatches a message.
    fn dispatch(
        &mut self,
        command: Self::Message,
    ) -> impl Future<Output = Result<(), Self::Err>> + Send;
}
