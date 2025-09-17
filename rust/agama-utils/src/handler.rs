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
use std::error::Error;
use tokio::sync::{mpsc, oneshot};
use crate::ServiceError;

/// Setting all the &self references as &mut self makes not needed to mark with Sync.
pub trait Handler: Send + Sync {
    type Err: From<ServiceError<Self::Message>> + Error;
    type Message: Send;

    fn channel(&self) -> &mpsc::UnboundedSender<Self::Message>;

    fn send_and_wait<T, F>(&self, func: F) -> impl Future<Output = Result<T, Self::Err>> + Send
    where
        T: Send,
        F: FnOnce(oneshot::Sender<T>) -> Self::Message + Send,
    {
        async {
            let (tx, rx) = oneshot::channel();
            let message = func(tx);
            self.channel()
                .send(message)
                .map_err(|e| ServiceError::from(e))?;
            Ok(rx.await.unwrap())
        }
    }

    fn send(&self, message: Self::Message) -> Result<(), Self::Err> {
        self.channel()
            .send(message)
            .map_err(|_| ServiceError::SendResponse)?;
        Ok(())
    }
}
