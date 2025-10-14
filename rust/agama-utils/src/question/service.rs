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

use async_trait::async_trait;
use tokio::sync::broadcast;

use super::{message, model::Question};
use crate::{
    actor::{self, Actor, MessageHandler},
    api::{event, Event},
};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Event(#[from] broadcast::error::SendError<Event>),
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    Model(#[from] super::model::Error),
    #[error("Unknown question: {0}")]
    UnknownQuestion(u32),
}

pub struct Service {
    questions: Vec<Question>,
    current_id: u32,
    events: event::Sender,
}

impl Service {
    pub fn new(events: event::Sender) -> Self {
        Self {
            questions: vec![],
            current_id: 0,
            events,
        }
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::Get> for Service {
    async fn handle(&mut self, _message: message::Get) -> Result<Vec<Question>, Error> {
        Ok(self.questions.clone())
    }
}

#[async_trait]
impl MessageHandler<message::Ask> for Service {
    async fn handle(&mut self, message: message::Ask) -> Result<u32, Error> {
        self.current_id += 1;
        let question = Question::new(self.current_id, message.question);
        self.questions.push(question);
        self.events.send(Event::QuestionAdded {
            id: self.current_id,
        })?;
        Ok(self.current_id)
    }
}

#[async_trait]
impl MessageHandler<message::Answer> for Service {
    async fn handle(&mut self, message: message::Answer) -> Result<(), Error> {
        let found = self.questions.iter_mut().find(|q| q.id == message.id);
        match found {
            Some(question) => {
                question.set_answer(message.answer)?;
                self.events
                    .send(Event::QuestionAnswered { id: message.id })?;
                Ok(())
            }
            None => Err(Error::UnknownQuestion(message.id)),
        }
    }
}
