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

use crate::model::ModelAdapter;
use crate::monitor::Monitor;
use crate::{config::Config, Model};
use crate::{message, monitor};
use agama_locale_data::{InvalidKeymapId, InvalidLocaleId, InvalidTimezoneId, KeymapId, LocaleId};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        self,
        event::{self, Event},
        l10n::{Proposal, SystemConfig, SystemInfo},
        Issue, IssueSeverity, IssueSource, Scope,
    },
    issue,
};
use async_trait::async_trait;
use tokio::sync::broadcast;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Unknown locale: {0}")]
    UnknownLocale(LocaleId),
    #[error("Unknown keymap: {0}")]
    UnknownKeymap(KeymapId),
    #[error("Unknown timezone: {0}")]
    UnknownTimezone(String),
    #[error(transparent)]
    InvalidLocale(#[from] InvalidLocaleId),
    #[error(transparent)]
    InvalidKeymap(#[from] InvalidKeymapId),
    #[error(transparent)]
    InvalidTimezone(#[from] InvalidTimezoneId),
    #[error(transparent)]
    Event(#[from] broadcast::error::SendError<Event>),
    #[error(transparent)]
    Issue(#[from] api::issue::Error),
    #[error(transparent)]
    IssueService(#[from] issue::service::Error),
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    IO(#[from] std::io::Error),
    #[error(transparent)]
    Generic(#[from] anyhow::Error),
    #[error("There is no proposal for localization")]
    MissingProposal,
}

/// Builds and spawns the l10n service.
///
/// This struct allows to build a l10n service. It allows replacing
/// the "model" for a custom one.
///
/// It spawns two Tokio tasks:
///
/// - The main service, which is reponsible for holding and applying the configuration.
/// - A monitor which checks for changes in the underlying system (e.g., changing the keymap)
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
            // FIXME: rename to "adapter"
            model: None,
            events,
            issues,
        }
    }

    /// Uses the given model.
    ///
    /// By default, the l10n service relies on systemd. However, it might be useful
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
            None => Box::new(Model::from_system()?),
        };

        let system = model.read_system_info();
        let config = Config::new_from(&system);

        let service = Service {
            system,
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
                "Could not launch the l10n monitor, therefore changes from systemd will be ignored. \
                 The original error was {error}"
            );
            }
        }
    }
}

/// Localization service.
///
/// It is responsible for handling the localization part of the installation:
///
/// * Reads the list of known locales, keymaps and timezones.
/// * Keeps track of the localization settings of the underlying system (the installer).
/// * Holds the user configuration.
/// * Applies the user configuration at the end of the installation.
pub struct Service {
    system: SystemInfo,
    config: Config,
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
            keymap: self.config.keymap.clone(),
            locale: self.config.locale.clone(),
            timezone: self.config.timezone.clone(),
        })
    }

    /// Returns configuration issues.
    ///
    /// It returns an issue for each unknown element (locale, keymap and timezone).
    fn find_issues(&self) -> Vec<Issue> {
        let config = &self.config;
        let mut issues = vec![];
        if !self.model.locales_db().exists(&config.locale) {
            issues.push(Issue {
                description: format!("Locale '{}' is unknown", &config.locale),
                details: None,
                source: IssueSource::Config,
                severity: IssueSeverity::Error,
                class: "unknown_locale".to_string(),
            });
        }

        if !self.model.keymaps_db().exists(&config.keymap) {
            issues.push(Issue {
                description: format!("Keymap '{}' is unknown", &config.keymap),
                details: None,
                source: IssueSource::Config,
                severity: IssueSeverity::Error,
                class: "unknown_keymap".to_string(),
            });
        }

        if !self.model.timezones_db().exists(&config.timezone) {
            issues.push(Issue {
                description: format!("Timezone '{}' is unknown", &config.timezone),
                details: None,
                source: IssueSource::Config,
                severity: IssueSeverity::Error,
                class: "unknown_timezone".to_string(),
            });
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

#[async_trait]
impl MessageHandler<message::SetSystem<SystemConfig>> for Service {
    async fn handle(&mut self, message: message::SetSystem<SystemConfig>) -> Result<(), Error> {
        let config = &message.config;
        if let Some(locale) = &config.locale {
            self.model.set_locale(locale.parse()?)?;
        }

        if let Some(keymap) = &config.keymap {
            self.model.set_keymap(keymap.parse()?)?;
        };

        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(&mut self, _message: message::GetConfig) -> Result<api::l10n::Config, Error> {
        Ok(api::l10n::Config {
            locale: Some(self.config.locale.to_string()),
            keymap: Some(self.config.keymap.to_string()),
            timezone: Some(self.config.timezone.to_string()),
        })
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig<api::l10n::Config>> for Service {
    async fn handle(
        &mut self,
        message: message::SetConfig<api::l10n::Config>,
    ) -> Result<(), Error> {
        let base_config = Config::new_from(&self.system);

        let config = if let Some(config) = &message.config {
            base_config.merge(config)?
        } else {
            base_config
        };

        if config == self.config {
            return Ok(());
        }

        self.config = config;
        let issues = self.find_issues();
        self.issues
            .cast(issue::message::Set::new(Scope::L10n, issues))?;
        self.events
            .send(Event::ProposalChanged { scope: Scope::L10n })?;
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
impl MessageHandler<message::Install> for Service {
    async fn handle(&mut self, _message: message::Install) -> Result<(), Error> {
        let Some(proposal) = self.get_proposal() else {
            return Err(Error::MissingProposal);
        };

        self.model
            .install(&proposal.locale, &proposal.keymap, &proposal.timezone)?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::UpdateLocale> for Service {
    async fn handle(&mut self, message: message::UpdateLocale) -> Result<(), Error> {
        self.system.locale = message.locale;
        _ = self
            .events
            .send(Event::SystemChanged { scope: Scope::L10n });
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::UpdateKeymap> for Service {
    async fn handle(&mut self, message: message::UpdateKeymap) -> Result<(), Error> {
        self.system.keymap = message.keymap;
        _ = self
            .events
            .send(Event::SystemChanged { scope: Scope::L10n });
        Ok(())
    }
}
