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
use crate::Model;
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        self,
        event::{self, Event},
        users::Config,
        Issue, Scope,
    },
    issue,
};
use async_trait::async_trait;
use gettextrs::gettext;
use tokio::sync::broadcast;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Missing required data for first user.")]
    MissingUserData,
    #[error("Missing required data for root.")]
    MissingRootData,
    #[error("System command failed: {0}")]
    CommandFailed(String),
    #[error(transparent)]
    Event(#[from] broadcast::error::SendError<Event>),
    #[error(transparent)]
    IssueService(#[from] issue::service::Error),
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
        let model = match self.model {
            Some(model) => model,
            None => Box::new(Model::new("/mnt")),
        };
        let service = Service {
            full_config: Config::new(),
            model: model,
            issues: self.issues,
            events: self.events,
        };
        service.setup()?;
        let handler = actor::spawn(service);

        Ok(handler)
    }
}

/// Users service.
pub struct Service {
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

    pub fn setup(&self) -> Result<(), Error> {
        self.update_issues()
    }

    fn get_proposal(&self) -> Option<api::users::Config> {
        if !self.full_config.is_empty() {
            return self.full_config.to_api();
        }

        None
    }

    /// Updates the service issues.
    ///
    /// At least one user is mandatory
    /// - typicaly root or
    /// - first user which will operate throught sudo
    fn update_issues(&self) -> Result<(), Error> {
        let mut issues = vec![];
        if self.full_config.is_empty() {
            issues.push(Issue::new(
                "users.no_auth",
                &gettext(
                    "Defining a user, setting the root password or a SSH public key is required",
                ),
            ));
        }

        if self
            .full_config
            .first_user
            .as_ref()
            .is_some_and(|u| !u.is_valid())
        {
            issues.push(Issue::new(
                "users.invalid_user",
                &gettext("First user information is incomplete"),
            ));
        }

        self.issues
            .cast(issue::message::Set::new(Scope::Users, issues))?;
        Ok(())
    }
}

impl Actor for Service {
    type Error = Error;
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
        Ok(self.full_config.clone())
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig<api::users::Config>> for Service {
    async fn handle(
        &mut self,
        message: message::SetConfig<api::users::Config>,
    ) -> Result<(), Error> {
        let mut base_config = Config::new();

        let config = if let Some(config) = &message.config {
            base_config = config.clone();
            base_config
        } else {
            base_config
        };

        if config == self.full_config {
            return Ok(());
        }

        self.full_config = config;

        self.events.send(Event::ProposalChanged {
            scope: Scope::Users,
        })?;

        self.update_issues()?;
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

#[async_trait]
impl MessageHandler<message::Install> for Service {
    async fn handle(&mut self, _message: message::Install) -> Result<(), Error> {
        if let Some(proposal) = self.get_proposal() {
            if let Err(error) = self.model.install(&proposal) {
                tracing::error!("Failed to write users configuration: {error}");
            }
        } else {
            tracing::error!("Missing authentication configuration");
        };

        Ok(())
    }
}
