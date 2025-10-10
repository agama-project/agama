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

use super::{message, Issue};
use crate::{
    actor::{self, Actor, MessageHandler},
    types::{Event, EventsSender},
};
use async_trait::async_trait;
use std::collections::HashMap;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    Model(#[from] super::model::Error),
}

pub struct Service {
    issues: HashMap<String, Vec<Issue>>,
    events: EventsSender,
}

impl Service {
    pub fn new(events: EventsSender) -> Self {
        Self {
            issues: HashMap::new(),
            events,
        }
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::Get> for Service {
    async fn handle(
        &mut self,
        _message: message::Get,
    ) -> Result<HashMap<String, Vec<Issue>>, Error> {
        Ok(self.issues.clone())
    }
}

#[async_trait]
impl MessageHandler<message::Update> for Service {
    async fn handle(&mut self, message: message::Update) -> Result<(), Error> {
        if message.issues.is_empty() {
            _ = self.issues.remove(&message.list);
        } else {
            self.issues.insert(message.list, message.issues);
        }

        if message.notify {
            _ = self.events.send(Event::IssuesChanged);
        }
        Ok(())
    }
}
