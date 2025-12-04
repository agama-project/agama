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

use agama_utils::{
    actor::{self, Actor, Handler },
    api::{self, event::{self, Event}},
    issue,
};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Actor(#[from] actor::Error),
}

/// Builds and spawns the users service.
pub struct Starter {
    issues: Handler<issue::Service>,
    events: event::Sender,
}

impl Starter {
    pub fn new(events: event::Sender, issues: Handler<issue::Service>) -> Self {
        Self {
            events,
            issues,
        }
    }

    /// Starts the service and returns a handler to communicate with it.
    pub async fn start(self) -> Result<Handler<Service>, Error> {
        let service = Service {
            issues: self.issues,
            events: self.events,
        };
        let handler = actor::spawn(service);

        Ok(handler)
    }
}

/// Users service.
pub struct Service {
    issues: Handler<issue::Service>,
    events: event::Sender,
}

impl Service {
    pub fn starter(events: event::Sender, issues: Handler<issue::Service>) -> Starter {
        Starter::new(events, issues)
    }
}

impl Actor for Service {
    type Error = Error;
}
