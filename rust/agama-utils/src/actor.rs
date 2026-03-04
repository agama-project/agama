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

//! This module implements a tiny actors system to be used by Agama services.
//!
//! It is a minimal implementation which does not include supervision, links,
//! etc. It only includes:
//!
//! * An [Actor] trait to mark its implementors as potential actors.
//! * A [Message] trait to define actors messages, defining its return type.
//! * A [Handler] trait to implement the behavior of an particular actor (which
//!   implements [Actor]) when it receives a given message.
//! * A generic struct [ActorHandler] which allows sending messages to a given
//!   actor.
//! * A [spawn] function to run the actor on a separate thread. It returns
//!   an [ActorHandler] to interact with the actor.
//!
//! The approach ensures compile-time checks of the messages an actor can
//! handle.
//!
//! Let's have a look to an example implementing a simple counter.
//!
//! ```
//! use agama_utils::actor::{
//!     self, Actor, Error, Message, MessageHandler
//! };
//! use async_trait::async_trait;
//!
//! #[derive(Default)]
//! pub struct MyActor {
//!     counter: u32,
//! }
//!
//! #[derive(thiserror::Error, Debug)]
//! pub enum MyActorError {
//!     #[error("Actor system error")]
//!     Actor(#[from] Error),
//! }
//!
//! impl Actor for MyActor {
//!     type Error = MyActorError;
//! }
//!
//! pub struct Inc {
//!     amount: u32,
//! }
//!
//! pub struct Get;
//!
//! impl Message for Inc {
//!     type Reply = ();
//! }
//!
//! impl Message for Get {
//!     type Reply = u32;
//! }
//!
//! #[async_trait]
//! impl MessageHandler<Inc> for MyActor {
//!     async fn handle(&mut self, message: Inc) -> Result<(), MyActorError> {
//!         self.counter += message.amount;
//!         Ok(())
//!     }
//! }
//!
//! #[async_trait]
//! impl MessageHandler<Get> for MyActor {
//!     async fn handle(&mut self, _message: Get) -> Result<u32, MyActorError> {
//!         Ok(self.counter)
//!     }
//! }
//!
//! #[tokio::main]
//! async fn main() {
//!     let actor = MyActor::default();
//!     // Spawn a separate Tokio task to run the actor.
//!     let handle = actor::spawn(actor);
//!
//!     // Send some messages using the "call" function.
//!     _ = handle.call(Inc { amount: 5 }).await;
//!     let value = handle.call(Get).await.unwrap_or_default();
//!     assert_eq!(value, 5);
//!
//!     // If you prefer, you can send a message and forget about the answer using the "cast" function.
//!     _ = handle.cast(Inc { amount: 1 });
//! }
//! ```

use async_trait::async_trait;
use std::marker::PhantomData;
use tokio::sync::{mpsc, oneshot};

/// Internal actors errors, mostly communication issues.
#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Could not send a message to actor {0}")]
    Send(&'static str),
    #[error("Could not get a response from actor {0}")]
    Response(&'static str),
}

/// Marks its implementors as potential actors.
///
/// It enables those structs to handle actors messages.
pub trait Actor: 'static + Send {
    /// Actor error type. It should implement the conversion from the
    /// [ActorError] type, which represents communication-level problems.
    type Error: std::error::Error + From<Error> + Send + 'static;

    #[inline]
    fn name() -> &'static str {
        std::any::type_name::<Self>()
    }
}

/// Marker trait to indicate that a its implementor is a potential message.
pub trait Message: 'static + Send {
    /// Defines the return type of the message.
    type Reply: 'static + Send;
}

type ReplySender<A, M> = oneshot::Sender<Result<<M as Message>::Reply, <A as Actor>::Error>>;

/// Represents a message for a given actor.
///
/// It contains the message and the channel, if any, to send the reply.
struct Envelope<A: Actor, M: Message>
where
    A: MessageHandler<M>,
{
    message: Option<M>,
    _actor: PhantomData<A>,
    sender: Option<ReplySender<A, M>>,
}

impl<A: Actor, M: Message> Envelope<A, M>
where
    A: MessageHandler<M>,
{
    pub fn new(message: M, sender: Option<ReplySender<A, M>>) -> Self {
        Self {
            message: Some(message),
            _actor: PhantomData,
            sender,
        }
    }

    /// Processes the message using the given actor.
    ///
    /// The actor must implement [a handler](Handler) for this type of messages.
    /// It takes care of sending the response if a sender channel was given.
    pub async fn handle(&mut self, actor: &mut A) {
        // To avoid clonning, we need to be able to take the value
        // while keeping the &mut self reference valid.
        let Some(msg) = self.message.take() else {
            eprintln!("Did not find a message!");
            return;
        };
        let result = actor.handle(msg).await;
        if let Some(sender) = self.sender.take() {
            _ = sender.send(result);
        }
    }
}

/// Envelope handler.
///
/// The handling mechanisms consist on calling a `handle` method for the message
/// and the actor. It is implemented for any [Actor] that implements a [Handler]
/// for a given [Messge].
#[async_trait]
trait EnvelopeHandler<A: Actor>: 'static + Send {
    async fn handle(&mut self, actor: &mut A);
}

#[async_trait]
impl<A: Actor, M: Message> EnvelopeHandler<A> for Envelope<A, M>
where
    A: MessageHandler<M>,
{
    async fn handle(&mut self, actor: &mut A) {
        self.handle(actor).await;
    }
}

/// Implements an [Actor's](Actor) handler for a given [Message].
#[async_trait]
pub trait MessageHandler<M: Message>: Actor {
    async fn handle(&mut self, message: M) -> Result<M::Reply, Self::Error>;
}

/// Implements a mechanism to communicate with a given actor.
///
/// An actor handle contains a channel to communicate with an Actor and offers a
/// set of functions to communicate with it.
///
/// It is possible to clone a handler so you can interact with the actor from
/// different places.
pub struct Handler<A: Actor> {
    sender: mpsc::UnboundedSender<Box<dyn EnvelopeHandler<A>>>,
}

impl<A: Actor> Clone for Handler<A> {
    fn clone(&self) -> Self {
        let sender = self.sender.clone();
        Handler::<A> { sender }
    }
}

impl<A: Actor> Handler<A> {
    /// Sends a message and waits for the answer.
    ///
    /// * `msg`: message to send to the actor.
    pub async fn call<M: Message>(&self, msg: M) -> Result<M::Reply, A::Error>
    where
        A: MessageHandler<M>,
    {
        let (tx, rx) = oneshot::channel();
        let message = Envelope::new(msg, Some(tx));
        self.sender
            .send(Box::new(message))
            .map_err(|_| Error::Send(A::name()))?;
        rx.await.map_err(|_| Error::Response(A::name()))?
    }

    /// Sends a message and does not wait for the answer.
    ///
    /// * `msg`: message to send to the actor.
    pub fn cast<M: Message>(&self, msg: M) -> Result<(), A::Error>
    where
        A: MessageHandler<M>,
    {
        let message = Envelope::new(msg, None);
        self.sender
            .send(Box::new(message))
            .map_err(|_| Error::Send(A::name()))?;
        Ok(())
    }
}

/// Spawns a Tokio task and process the messages coming from the action handler.
///
/// * `actor`: actor to spawn.
pub fn spawn<A: Actor>(mut actor: A) -> Handler<A> {
    let (tx, mut rx) = mpsc::unbounded_channel();
    let handler = Handler::<A> { sender: tx };

    tokio::spawn(async move {
        while let Some(mut msg) = rx.recv().await {
            msg.handle(&mut actor).await;
        }
    });

    handler
}
