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
use crate::api::{
    event::{self, Event},
    issue::IssueMap,
};
use crate::issue::message;
use async_trait::async_trait;
use std::collections::HashSet;
use tokio::sync::broadcast;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Event(#[from] broadcast::error::SendError<Event>),
    #[error(transparent)]
    Actor(#[from] actor::Error),
}

pub struct Service {
    issues: IssueMap,
    events: event::Sender,
}

impl Service {
    pub fn new(events: event::Sender) -> Self {
        Self {
            issues: IssueMap::new(),
            events,
        }
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::Get> for Service {
    async fn handle(&mut self, _message: message::Get) -> Result<IssueMap, Error> {
        Ok(self.issues.clone())
    }
}

#[async_trait]
impl MessageHandler<message::Set> for Service {
    async fn handle(&mut self, message: message::Set) -> Result<(), Error> {
        // Compare whether the issues has changed.
        let old_issues_hash: HashSet<_> = self
            .issues
            .get(&message.scope)
            .map(|v| v.iter().cloned().collect())
            .unwrap_or_default();
        let new_issues_hash: HashSet<_> = message.issues.iter().cloned().collect();
        if old_issues_hash == new_issues_hash {
            return Ok(());
        }

        if message.issues.is_empty() {
            _ = self.issues.remove(&message.scope);
        } else {
            self.issues.insert(message.scope, message.issues);
        }

        if message.notify {
            self.events.send(Event::IssuesChanged {
                scope: message.scope,
            })?;
        }
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::Clear> for Service {
    async fn handle(&mut self, message: message::Clear) -> Result<(), Error> {
        _ = self.issues.remove(&message.scope);
        Ok(())
    }
}
