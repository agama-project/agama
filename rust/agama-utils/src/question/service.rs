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

use super::message;
use crate::{
    actor::{self, Actor, MessageHandler},
    api::{
        self, event,
        question::{Answer, Config, Policy, Question, QuestionSpec},
        Event,
    },
};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Event(#[from] broadcast::error::SendError<Event>),
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    Model(#[from] api::question::Error),
    #[error("Unknown question: {0}")]
    UnknownQuestion(u32),
}

pub struct Service {
    config: Option<Config>,
    questions: Vec<Question>,
    current_id: u32,
    events: event::Sender,
}

impl Service {
    pub fn new(events: event::Sender) -> Self {
        Self {
            config: Default::default(),
            questions: vec![],
            current_id: 0,
            events,
        }
    }

    pub fn find_answer(&self, spec: &QuestionSpec) -> Option<Answer> {
        let answer = self.config.as_ref().and_then(|config| {
            config.answers.as_ref().and_then(|answers_vec| {
                answers_vec
                    .iter()
                    .find(|a| a.answers_to(&spec))
                    .map(|r| r.answer.clone())
            })
        });

        if answer.is_some() {
            return answer;
        }

        self.config.as_ref().and_then(|config| {
            if let Some(Policy::Auto) = config.policy {
                spec.default_action.clone().map(|action| Answer {
                    action,
                    value: None,
                })
            } else {
                None
            }
        })
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(&mut self, _message: message::GetConfig) -> Result<Option<Config>, Error> {
        Ok(self.config.clone())
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig> for Service {
    async fn handle(&mut self, message: message::SetConfig) -> Result<(), Error> {
        self.config = message.config;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::Get> for Service {
    async fn handle(
        &mut self,
        _message: message::Get,
    ) -> Result<Vec<api::question::Question>, Error> {
        Ok(self.questions.clone())
    }
}

#[async_trait]
impl MessageHandler<message::Ask> for Service {
    async fn handle(&mut self, message: message::Ask) -> Result<Question, Error> {
        self.current_id += 1;

        let mut question = Question::new(self.current_id, message.question);
        if let Some(answer) = self.find_answer(&question.spec) {
            _ = question.set_answer(answer);
        }
        self.questions.push(question.clone());

        self.events.send(Event::QuestionAdded {
            id: self.current_id,
        })?;

        if question.answer.is_some() {
            self.events.send(Event::QuestionAnswered {
                id: self.current_id,
            })?;
        }
        Ok(question)
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

#[async_trait]
impl MessageHandler<message::Delete> for Service {
    async fn handle(&mut self, message: message::Delete) -> Result<(), Error> {
        self.questions.retain(|q| q.id != message.id);
        Ok(())
    }
}
