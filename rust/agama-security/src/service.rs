// Copyright (c) [2026] SUSE LLC
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
    actor::{self, Actor, Handler, MessageHandler},
    api::{self, security::SSLFingerprint},
    question,
};
use async_trait::async_trait;

use crate::message;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Actor(#[from] actor::Error),
}

pub struct Starter {
    questions: Handler<question::Service>,
}

impl Starter {
    pub fn new(questions: Handler<question::Service>) -> Starter {
        Self { questions }
    }

    pub fn start(self) -> Result<Handler<Service>, Error> {
        let service = Service {
            questions: self.questions,
            state: State::default(),
        };
        let handler = actor::spawn(service);
        Ok(handler)
    }
}

#[derive(Default)]
struct State {
    fingerprints: Vec<SSLFingerprint>,
}

pub struct Service {
    questions: Handler<question::Service>,
    state: State,
}

impl Service {
    pub fn starter(questions: Handler<question::Service>) -> Starter {
        Starter::new(questions)
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::SetConfig<api::security::Config>> for Service {
    async fn handle(
        &mut self,
        message: message::SetConfig<api::security::Config>,
    ) -> Result<(), Error> {
        match message.config {
            Some(config) => {
                self.state.fingerprints = config.ssl_certificates.unwrap_or_default();
            }
            None => {
                self.state = State::default();
            }
        }
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(
        &mut self,
        _message: message::GetConfig,
    ) -> Result<api::security::Config, Error> {
        Ok(api::security::Config {
            ssl_certificates: Some(self.state.fingerprints.clone()),
        })
    }
}
