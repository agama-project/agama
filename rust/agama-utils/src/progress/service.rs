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

use crate::actor::{self, Actor, MessageHandler};
use crate::progress::message;
use crate::types::progress::{self, Progress};
use crate::types::scope::Scope;
use crate::types::{Event, EventsSender};
use async_trait::async_trait;
use tokio::sync::broadcast;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Progress already exists for {0}")]
    DuplicatedProgress(Scope),
    #[error("Progress does not exist for {0}")]
    MissingProgress(Scope),
    #[error(transparent)]
    Progress(#[from] progress::Error),
    #[error(transparent)]
    Event(#[from] broadcast::error::SendError<Event>),
    #[error(transparent)]
    Actor(#[from] actor::Error),
}

pub struct Service {
    events: EventsSender,
    progresses: Vec<Progress>,
}

impl Service {
    pub fn new(events: EventsSender) -> Service {
        Self {
            events,
            progresses: Vec::new(),
        }
    }

    fn get_progress(&self, scope: Scope) -> Option<&Progress> {
        self.progresses.iter().find(|p| p.scope == scope)
    }

    fn get_mut_progress(&mut self, scope: Scope) -> Option<&mut Progress> {
        self.progresses.iter_mut().find(|p| p.scope == scope)
    }

    fn get_progress_index(&self, scope: Scope) -> Option<usize> {
        self.progresses.iter().position(|p| p.scope == scope)
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::Get> for Service {
    async fn handle(&mut self, _message: message::Get) -> Result<Vec<Progress>, Error> {
        Ok(self.progresses.clone())
    }
}

#[async_trait]
impl MessageHandler<message::Start> for Service {
    async fn handle(&mut self, message: message::Start) -> Result<(), Error> {
        if self.get_progress(message.scope).is_some() {
            return Err(Error::DuplicatedProgress(message.scope));
        }
        self.progresses
            .push(Progress::new(message.scope, message.size, message.step));
        self.events.send(Event::ProgressChanged {
            scope: message.scope,
        })?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::StartWithSteps> for Service {
    async fn handle(&mut self, message: message::StartWithSteps) -> Result<(), Error> {
        if self.get_progress(message.scope).is_some() {
            return Err(Error::DuplicatedProgress(message.scope));
        }
        self.progresses
            .push(Progress::new_with_steps(message.scope, message.steps));
        self.events.send(Event::ProgressChanged {
            scope: message.scope,
        })?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::Next> for Service {
    async fn handle(&mut self, message: message::Next) -> Result<(), Error> {
        let Some(progress) = self.get_mut_progress(message.scope) else {
            return Err(Error::MissingProgress(message.scope));
        };
        progress.next()?;
        self.events.send(Event::ProgressChanged {
            scope: message.scope,
        })?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::NextWithStep> for Service {
    async fn handle(&mut self, message: message::NextWithStep) -> Result<(), Error> {
        let Some(progress) = self.get_mut_progress(message.scope) else {
            return Err(Error::MissingProgress(message.scope));
        };
        progress.next_with_step(message.step)?;
        self.events.send(Event::ProgressChanged {
            scope: message.scope,
        })?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::Finish> for Service {
    async fn handle(&mut self, message: message::Finish) -> Result<(), Error> {
        let index = self
            .get_progress_index(message.scope)
            .ok_or(Error::MissingProgress(message.scope))?;
        self.progresses.remove(index);
        self.events.send(Event::ProgressChanged {
            scope: message.scope,
        })?;
        Ok(())
    }
}
