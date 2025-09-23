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

//! Implements the public API of an Agama service.

use core::future::Future;
use std::error;
use tokio::sync::{mpsc, oneshot};

#[derive(thiserror::Error, Debug)]
pub enum Error<T> {
    #[error("Could not send the message")]
    Send(#[from] mpsc::error::SendError<T>),
    #[error("Could not receive the message")]
    Recv(#[from] oneshot::error::RecvError),
}

/// Usually, an Agama service runs on a separate task. To communicate
/// with the service, you need to implement a [Handler]. This trait
/// offers a basic API to send and receive messages from a Service.
// Setting all the &self references as &mut self makes not needed to mark with Sync.
pub trait Handler: Send + Sync {
    type Err: From<Error<Self::Message>> + error::Error;
    type Message: Send;

    fn channel(&self) -> &mpsc::UnboundedSender<Self::Message>;

    /// Sends a message and waits for the response.
    ///
    /// * `func`: functio to build the message. It receives the channel
    ///   to send the answer.
    fn send_and_wait<T, F>(&self, func: F) -> impl Future<Output = Result<T, Self::Err>> + Send
    where
        T: Send,
        F: FnOnce(oneshot::Sender<T>) -> Self::Message + Send,
    {
        async {
            let (tx, rx) = oneshot::channel();
            let message = func(tx);
            self.channel().send(message).map_err(|e| Error::from(e))?;
            Ok(rx.await.map_err(|e| Error::from(e))?)
        }
    }

    /// Sends a message but does not wait for the answer.
    ///
    /// * `message`: message to send to the service.
    fn send(&self, message: Self::Message) -> Result<(), Self::Err> {
        self.channel().send(message).map_err(|e| Error::from(e))?;
        Ok(())
    }
}
