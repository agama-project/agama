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

use crate::monitor::Monitor;
use crate::{message, monitor};
use crate::{Model, ModelAdapter};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        self,
        event::{self, Event},
        hostname::{Proposal, SystemInfo},
        Issue, Scope,
    },
    issue,
};
use async_trait::async_trait;
use tokio::sync::broadcast;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Invalid hostname")]
    InvalidHostname,
    #[error(transparent)]
    Event(#[from] broadcast::error::SendError<Event>),
    #[error(transparent)]
    IssueService(#[from] issue::service::Error),
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    IO(#[from] std::io::Error),
    #[error(transparent)]
    Generic(#[from] anyhow::Error),
    #[error("There is no proposal for hostname")]
    MissingProposal,
}

/// Builds and spawns the hostname service.
///
/// This struct allows to build a hostname service. It allows replacing
/// the "model" for a custom one.
///
/// It spawns two Tokio tasks:
///
/// - The main service, which is reponsible for holding and applying the configuration.
/// - A monitor which checks for changes in the underlying system (e.g., changing the hostname)
///   and signals the main service accordingly.
/// - It depends on the issues service to keep the installation issues.
pub struct Starter {
    model: Option<Box<dyn ModelAdapter + Send + 'static>>,
    issues: Handler<issue::Service>,
    events: event::Sender,
}

impl Starter {
    /// Creates a new starter.
    ///
    /// * `events`: channel to emit the [localization-specific events](crate::Event).
    /// * `issues`: handler to the issues service.
    pub fn new(events: event::Sender, issues: Handler<issue::Service>) -> Self {
        Self {
            model: None,
            events,
            issues,
        }
    }

    /// Uses the given model.
    ///
    /// By default, the hostname service relies on systemd. However, it might be useful
    /// to replace it in some scenarios (e.g., when testing).
    ///
    /// * `model`: model to use. It must implement the [ModelAdapter] trait.
    pub fn with_model<T: ModelAdapter + Send + 'static>(mut self, model: T) -> Self {
        self.model = Some(Box::new(model));
        self
    }

    /// Starts the service and returns a handler to communicate with it.
    ///
    /// The service uses a separate monitor to listen to system configuration
    /// changes.
    pub async fn start(self) -> Result<Handler<Service>, Error> {
        let model = match self.model {
            Some(model) => model,
            None => Box::new(Model),
        };

        let config = model.system_info();

        let service = Service {
            config,
            model,
            issues: self.issues,
            events: self.events,
        };
        let handler = actor::spawn(service);
        Self::start_monitor(handler.clone()).await;
        Ok(handler)
    }

    pub async fn start_monitor(handler: Handler<Service>) {
        match Monitor::new(handler.clone()).await {
            Ok(monitor) => monitor::spawn(monitor),
            Err(error) => {
                tracing::error!(
                "Could not launch the hostname monitor, therefore changes from systemd will be ignored. \
                 The original error was {error}"
            );
            }
        }
    }
}

/// Hostname service.
///
/// It is responsible for handling the hostname part of the installation:
///
/// * Reads the static and transient hostname
/// * Keeps track of the hostname settings of the underlying system (the installer).
/// * Persist the static hostname at the end of the installation.
pub struct Service {
    config: SystemInfo,
    model: Box<dyn ModelAdapter + Send + 'static>,
    issues: Handler<issue::Service>,
    events: event::Sender,
}

impl Service {
    pub fn starter(events: event::Sender, issues: Handler<issue::Service>) -> Starter {
        Starter::new(events, issues)
    }

    fn get_proposal(&self) -> Option<Proposal> {
        if !self.find_issues().is_empty() {
            return None;
        }

        Some(Proposal {
            hostname: self.config.hostname.clone(),
            r#static: self.config.r#static.clone(),
        })
    }

    /// Returns configuration issues.
    ///
    /// It returns issues if the hostname are too long
    fn find_issues(&self) -> Vec<Issue> {
        // TODO: add length checks
        vec![]
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::GetSystem> for Service {
    async fn handle(&mut self, _message: message::GetSystem) -> Result<SystemInfo, Error> {
        Ok(self.config.clone())
    }
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(
        &mut self,
        _message: message::GetConfig,
    ) -> Result<api::hostname::Config, Error> {
        Ok(api::hostname::Config {
            r#static: Some(self.config.r#static.clone()),
            hostname: Some(self.config.hostname.clone()),
        })
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig<api::hostname::Config>> for Service {
    async fn handle(
        &mut self,
        message: message::SetConfig<api::hostname::Config>,
    ) -> Result<(), Error> {
        let current = self.config.clone();

        if let Some(config) = &message.config {
            if let Some(name) = &config.r#static {
                self.config.r#static = name.clone();
                self.config.hostname = name.clone();
                self.model.set_static_hostname(name.clone())?
            }

            if let Some(name) = &config.hostname {
                // If static hostname is set the transient is basically the same
                if self.config.r#static.is_empty() {
                    self.config.hostname = name.clone();
                    self.model.set_hostname(name.clone())?
                }
            }
        } else {
            return Ok(());
        }

        if current == self.config {
            return Ok(());
        }

        let issues = self.find_issues();
        self.issues
            .cast(issue::message::Set::new(Scope::Hostname, issues))?;
        self.events.send(Event::ProposalChanged {
            scope: Scope::Hostname,
        })?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::GetProposal> for Service {
    async fn handle(&mut self, _message: message::GetProposal) -> Result<Option<Proposal>, Error> {
        Ok(self.get_proposal())
    }
}

#[async_trait]
impl MessageHandler<message::UpdateHostname> for Service {
    async fn handle(&mut self, message: message::UpdateHostname) -> Result<(), Error> {
        self.config.hostname = message.name;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::UpdateStaticHostname> for Service {
    async fn handle(&mut self, message: message::UpdateStaticHostname) -> Result<(), Error> {
        // If static hostname is set the transient is basically the same
        self.config.r#static = message.name.clone();
        self.config.hostname = message.name;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::Install> for Service {
    async fn handle(&mut self, _message: message::Install) -> Result<(), Error> {
        Ok(())
    }
}
