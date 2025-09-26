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

//! This module implements a tiny actors system to be used by the services.
//!
//! Ideally, each Agama service should be composed, at least, of:
//!
//! * An actor which implements the [Actor] trait. It should implement the
//!   [Handler] trait for each message it wants to handle.
//! * An actor handle, represented by the [ActorHandle] generic struct.
//!
//! Let's have a look to an example implementing a simple counter.
//!
//!
//! #[tokio::main]
//! async fn main() {
//!     println!("TODO");
//! }
//! ```

use async_trait::async_trait;
use std::marker::PhantomData;
use tokio::sync::{mpsc, oneshot};

#[derive(thiserror::Error, Debug)]
pub enum ActorError {
    #[error("Could not send a message to actor {0}")]
    Send(&'static str),
    #[error("Could not get a response from actor {0}")]
    Response(&'static str),
}

/// Marker trait to indicate that a struct works as an actor.
pub trait Actor: 'static + Send + Sized {}

/// Marker trait to indicate that a struct is a message.
// FIXME: remove the clone
pub trait Message: 'static + Send + Sized + Clone {
    type Reply: 'static + Send;
}

/// Represents a message for a given actor.
pub struct Envelope<A: Actor, M: Message>
where
    A: Handler<M>,
{
    message: M,
    _actor: PhantomData<A>,
    sender: Option<tokio::sync::oneshot::Sender<M::Reply>>,
}

impl<A: Actor, M: Message> Envelope<A, M>
where
    A: Handler<M>,
{
    pub fn new(message: M, sender: Option<tokio::sync::oneshot::Sender<M::Reply>>) -> Self {
        Self {
            message,
            _actor: PhantomData,
            sender,
        }
    }

    /// Process the message using the given actor.
    ///
    /// The actor must implement a handler for this type of messages. It takes
    /// care of sending the response if a sender channel was given.
    pub async fn handle(&mut self, actor: &mut A) {
        let result = actor.handle(self.message.clone()).await;
        if let Some(sender) = self.sender.take() {
            _ = sender.send(result);
        }
    }
}

/// Generic message handling.
///
/// The handling mechanisms consist on calling a handle method for the message
/// and the actor.
#[async_trait]
pub trait EnvelopeHandler<A: Actor>: 'static + Send {
    async fn handle(&mut self, actor: &mut A);
}

/// Implementation of the generic message handling mechanism for each actor and
/// message type.
///
/// The actor has to implement Handler<M> to handle a given message M.
#[async_trait]
impl<A: Actor, M: Message> EnvelopeHandler<A> for Envelope<A, M>
where
    A: Handler<M>,
{
    async fn handle(&mut self, actor: &mut A) {
        self.handle(actor).await;
    }
}

/// Message handling for a given message type.
#[async_trait]
pub trait Handler<M: Message>
where
    Self: Actor,
{
    async fn handle(&mut self, message: M) -> M::Reply;
}

pub struct ActorHandle<A: Actor> {
    sender: mpsc::UnboundedSender<Box<dyn EnvelopeHandler<A>>>,
}

impl<A: Actor> ActorHandle<A> {
    pub async fn call<M: Message>(&self, msg: M) -> M::Reply
    where
        A: Handler<M>,
    {
        let (tx, rx) = oneshot::channel();
        let message = Envelope::new(msg, Some(tx));
        self.sender.send(Box::new(message)).unwrap();
        rx.await.unwrap()
    }
}

pub fn spawn_actor<A: Actor>(mut actor: A) -> ActorHandle<A> {
    let (tx, mut rx) = mpsc::unbounded_channel();
    let handler = ActorHandle::<A> { sender: tx };

    tokio::spawn(async move {
        while let Some(mut msg) = rx.recv().await {
            msg.handle(&mut actor).await;
        }
    });

    handler
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Default)]
    pub struct MyActor {
        counter: u32,
    }

    impl Actor for MyActor {}

    #[derive(Clone)]
    pub struct Inc {
        amount: u32,
    }

    #[derive(Clone)]
    pub struct Dec {
        amount: u32,
    }

    #[derive(Clone)]
    pub struct Get {}

    impl Message for Inc {
        type Reply = ();
    }

    impl Message for Dec {
        type Reply = ();
    }

    impl Message for Get {
        type Reply = u32;
    }

    #[async_trait]
    impl Handler<Inc> for MyActor {
        async fn handle(&mut self, message: Inc) {
            self.counter += message.amount;
        }
    }

    #[async_trait]
    impl Handler<Dec> for MyActor {
        async fn handle(&mut self, message: Dec) {
            self.counter -= message.amount;
        }
    }

    #[async_trait]
    impl Handler<Get> for MyActor {
        async fn handle(&mut self, _message: Get) -> u32 {
            self.counter
        }
    }

    // pub struct AnotherActor<T> {}

    #[tokio::test]
    async fn test_name() {
        let actor = MyActor::default();
        let handle = spawn_actor(actor);
        handle.call(Inc { amount: 30 }).await;
        let value = handle.call(Get {}).await;
        assert_eq!(value, 30);
    }
}
