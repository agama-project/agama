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

use crate::message;
use crate::model::ModelAdapter;
use crate::{config::Config, Model};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        self,
        event::{self, Event},
        users::{user_info::UserInfo, SystemInfo},
        Issue,
    },
    issue,
};
use async_trait::async_trait;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    IO(#[from] std::io::Error),
    #[error(transparent)]
    Actor(#[from] actor::Error),
}

/// Builds and spawns the users service.
pub struct Starter {
    model: Option<Box<dyn ModelAdapter + Send + 'static>>,
    issues: Handler<issue::Service>,
    events: event::Sender,
}

impl Starter {
    pub fn new(events: event::Sender, issues: Handler<issue::Service>) -> Self {
        Self {
            model: None,
            events,
            issues,
        }
    }

    /// Uses the given model.
    ///
    /// * `model`: model to use. It must implement the [ModelAdapter] trait.
    pub fn with_model<T: ModelAdapter + Send + 'static>(mut self, model: T) -> Self {
        self.model = Some(Box::new(model));
        self
    }

    /// Starts the service and returns a handler to communicate with it.
    pub async fn start(self) -> Result<Handler<Service>, Error> {
        tracing::info!("Starting users service");

        let model = match self.model {
            Some(model) => model,
            None => Box::new(Model::from_system()?),
        };
        let system = model.read_system_info();
        let service = Service {
            // just mockup of non-existent system model
            system: system.clone(),
            full_config: Config::new_from(&system),
            model: model,
            issues: self.issues,
            events: self.events,
        };
        let handler = actor::spawn(service);

        Ok(handler)
    }
}

/// Users service.
pub struct Service {
    // holds system state
    system: SystemInfo,
    // complete users config
    full_config: Config,
    // service's backend which gets data from real world
    model: Box<dyn ModelAdapter + Send + 'static>,
    // infrastructure stuff
    issues: Handler<issue::Service>,
    events: event::Sender,
}

impl Service {
    pub fn starter(events: event::Sender, issues: Handler<issue::Service>) -> Starter {
        Starter::new(events, issues)
    }

    fn get_proposal(&self) -> Option<api::users::Config> {
        if self.find_issues().is_empty() {
            return self.full_config.to_api();
        }

        None
    }

    fn find_issues(&self) -> Vec<Issue> {
        let mut issues = vec![];

        // At least one user is mandatory
        // - typicaly root or
        // - first user which will operate throught sudo
        if self.full_config.users.is_empty() {
            issues.push(Issue::new(
                "No user defined",
                "At least one user has to be defined",
            ));
        }

        issues
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::GetSystem> for Service {
    async fn handle(&mut self, _message: message::GetSystem) -> Result<SystemInfo, Error> {
        Ok(self.system.clone())
    }
}

// Small inconsistency here:
// - in top level manager service is Config used just for what was
//   entered by user, manager service is responsible for caching those
// - in all "sub" services like l10n, or this users, Config is full
//   service configuration. So GetConfig in those sub services does
//   what GetExtendedConfig in manager
// - GetExtendedConfig doesn't make sense for sub services thought
#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(&mut self, _message: message::GetConfig) -> Result<api::users::Config, Error> {
        Ok(api::users::Config {
            users: self.full_config.users.clone(),
        })
    }
}

// TODO:
#[async_trait]
impl MessageHandler<message::SetConfig<api::users::Config>> for Service {
    async fn handle(
        &mut self,
        message: message::SetConfig<api::users::Config>,
    ) -> Result<(), Error> {
        Ok(())
    }
}

// Basically same thing as GetConfig (in case of this service).
// Only difference is that GetProposal checks for an issues.
#[async_trait]
impl MessageHandler<message::GetProposal> for Service {
    async fn handle(
        &mut self,
        _message: message::GetProposal,
    ) -> Result<Option<api::users::Config>, Error> {
        Ok(self.get_proposal())
    }
}
