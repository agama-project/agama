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

//! This module implements a tiny actors system to be used by services. Ideally,
//! each Agama service should be composed, at least, of:
//!
//! * An actor which implements the [Actor] trait. It should implement the
//!   [Handles] trait for each message it wants to handle.
//! * An actor handle which implements the [ActorHandle] trait.
//!
//! Let's have a look to an example implementing a simple counter.
//!
//! ```
//! use agama_utils::actors::{Actor, ActorHandle, Handles, MailboxMessage};
//! use tokio::sync::mpsc;
//!
//! struct Counter {
//!     value: u32,
//!     receiver: mpsc::UnboundedReceiver<Box<dyn MailboxMessage>>,
//! }
//!
//! impl Counter {
//!     pub fn new(receiver: mpsc::UnboundedReceiver<Box<dyn MailboxMessage>>) -> Self {
//!         Self { receiver, value: 0 }
//!     }
//! }
//!
//! impl Actor for Counter {
//!     fn channel(&mut self) -> &mut mpsc::UnboundedReceiver<Box<dyn MailboxMessage>> {
//!         &mut self.receiver
//!     }
//! }
//!
//! // Message to increment the counter
//! struct Inc { amount: u32 }
//!
//! impl Inc {
//!     pub fn new(amount: u32) -> Self {
//!         Self { amount }
//!     }
//! }
//!
//! impl Handles<Inc> for Counter {
//!     type Reply = ();
//!
//!     fn handle(&mut self, message: Inc) -> Self::Reply {
//!         self.value += message.amount;
//!     }
//! }
//!
//! // Message to get the value
//! struct Get {}
//!
//! impl Handles<Get> for Counter {
//!     type Reply = u32;
//!
//!    fn handle(&mut self, message: Get) -> Self::Reply {
//!        self.value
//!    }
//! }
//!
//! // Finally, the handle
//! struct MyActorHandle {
//!     sender: mpsc::UnboundedSender<Box<dyn MailboxMessage>>,
//! }
//!
//! impl ActorHandle<Counter> for MyActorHandle {
//!     fn channel(&mut self) -> &mut mpsc::UnboundedSender<Box<dyn MailboxMessage>> {
//!         &mut self.sender
//!     }
//! }
//!
//! #[tokio::main]
//! async fn main() {
//!     let (tx, rx) = mpsc::unbounded_channel();
//!     let actor = Counter::new(rx);
//!     tokio::spawn(async move {
//!         actor.run().await;
//!     });
//!
//!     let mut handle = MyActorHandle { sender: tx.clone() };
//!     for i in 0..100 {
//!         _ = handle.send(Inc::new(i));
//!     }
//!     let value = handle
//!         .request(Get {})
//!         .await
//!         .expect("Could not get the response from the actor");
//!     assert_eq!(value, 4950);
//! }
//! ```

use std::{any::Any, future::Future, marker::PhantomData};
use tokio::sync::{mpsc, oneshot};

/// Represents an actor which receives the messages using an unbounded channel
/// of MailboxMessage objects.
pub trait Actor: Send + Sized + 'static {
    /// Returns the service name used for logging and debugging purposes.
    ///
    /// An example might be "agama_l10n::l10n::L10n".
    fn name() -> &'static str {
        std::any::type_name::<Self>()
    }

    /// Returns the channel to receive the messages.
    fn channel(&mut self) -> &mut mpsc::UnboundedReceiver<Box<dyn MailboxMessage>>;

    /// Main loop of the service.
    ///
    /// It dispatches one message at a time.
    fn run(mut self) -> impl Future<Output = ()> + Send {
        async move {
            loop {
                let message = self.channel().recv().await;
                let Some(message) = message else {
                    eprintln!("channel closed for {}", Self::name());
                    break;
                };

                message.handle_message(&mut self);
                // if let Err(error) = &mut self.dispatch(message).await {
                //     eprintln!("error dispatching command: {error}");
                // }
            }
        }
    }
}

/// Wrapper around a message to make it possible to send it to an actor.
///
/// Check the MailboxMessage trait.
pub struct Envelope<M: Send + 'static, A: Handles<M>> {
    message: M,
    _actor: PhantomData<A>,
    reply_sender: Option<oneshot::Sender<<A as Handles<M>>::Reply>>,
}

/// Represents any message to be send over the actor channel.
///
/// These actors system uses type erasure to send any kind of message over the
/// channel. The messages are wrapped in an Envelope and this trait makes sure
/// that the original message can be extracted again when it is received. This
/// trait is automatically implemented for the Envelope struct.
pub trait MailboxMessage: Send {
    fn handle_message(self: Box<Self>, actor: &mut dyn Any);
}

impl<M, A> MailboxMessage for Envelope<M, A>
where
    M: Send + 'static,
    A: Handles<M> + Send + 'static,
    <A as Handles<M>>::Reply: Send + 'static,
{
    fn handle_message(self: Box<Self>, actor: &mut dyn Any) {
        if let Some(an_actor) = actor.downcast_mut::<A>() {
            let reply = an_actor.handle(self.message);
            if let Some(sender) = self.reply_sender {
                _ = sender.send(reply); //.unwrap();
            }
        } else {
            eprintln!("Unexpected actor type");
        }
    }
}

#[derive(thiserror::Error, Debug)]
pub enum ActorError {
    #[error("Could not send a message to actor {0}")]
    Send(&'static str),
    #[error("Could not get a response from actor {0}")]
    Response(&'static str),
}

/// Handling of a message.
///
/// Actors should implement this trait for each kind of message they want to handle.
pub trait Handles<M: Send + 'static>: Actor + Sized {
    type Reply: Send + 'static;

    fn handle(&mut self, message: M) -> Self::Reply;
}

/// Represents a handle to interact with an actor.
///
/// It offers methods to send messages to an actor.
pub trait ActorHandle<A: Actor> {
    fn channel(&mut self) -> &mut mpsc::UnboundedSender<Box<dyn MailboxMessage>>;

    /// Sends a message and does not wait for the reply.
    fn send<M>(&mut self, message: M) -> Result<(), ActorError>
    where
        M: Send + 'static,
        A: Handles<M> + Send + 'static,
        <A as Handles<M>>::Reply: Send + 'static,
    {
        let envelope = Envelope {
            message,
            _actor: PhantomData::<A>,
            reply_sender: None,
        };
        self.channel()
            .send(Box::new(envelope))
            .map_err(|_| ActorError::Send(A::name()))?;
        Ok(())
    }

    /// Sends a message and returns the reply.
    fn request<M>(
        &mut self,
        message: M,
    ) -> impl Future<Output = Result<<A as Handles<M>>::Reply, ActorError>>
    where
        M: Send + 'static,
        A: Handles<M> + Send + 'static,
        <A as Handles<M>>::Reply: Send + 'static,
    {
        async {
            let (reply_tx, reply_rx) = oneshot::channel();
            let envelope = Envelope {
                message,
                _actor: PhantomData::<A>,
                reply_sender: Some(reply_tx),
            };
            self.channel()
                .send(Box::new(envelope))
                .map_err(|_| ActorError::Send(A::name()))?;
            let value = reply_rx
                .await
                .map_err(|_| ActorError::Response(A::name()))?;
            Ok(value)
        }
    }
}
