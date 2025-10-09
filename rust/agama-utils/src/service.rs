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

//! Offers a trait to implement an Agama service.
//!
//! An Agama service is composed of, at least, two parts:
//!
//! * The service itself, which holds the configuration and takes care of
//!   performing the changes at installation time. It is private to each
//!   Agama module (agama-l10n, agama-network, etc.). It should implement
//!   the [Service trait].
//! * The handler, which offers an API to talk to the service. It should
//!   implement the [Handler](crate::Handler) trait.

use core::future::Future;
use std::{any, error};
use tokio::sync::mpsc;

/// Implements the basic behavior for an Agama service.
///
/// It is responsible for:
///
/// * Holding the configuration.
/// * Making an installation proposal for one aspect of the system
///   (localization, partitioning, etc.).
/// * Performing the changes a installation time.
/// * Optionally, making changes to the system running Agama
///   (e.g., changing the keyboard layout).
///
/// Usually, a service runs on a separate task and receives the actions to
/// perform through a [mpsc::UnboundedReceiver
/// channel](tokio::sync::mpsc::UnboundedReceiver).
pub trait Service: Send {
    type Err: error::Error;
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
