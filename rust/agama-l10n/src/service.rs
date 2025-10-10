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

use crate::config::Config;
use crate::extended_config::ExtendedConfig;
use crate::message;
use crate::model::ModelAdapter;
use crate::proposal::Proposal;
use crate::system_info::SystemInfo;
use agama_locale_data::{InvalidKeymapId, InvalidLocaleId, InvalidTimezoneId, KeymapId, LocaleId};
use agama_utils::actor::{self, Actor, Handler, MessageHandler};
use agama_utils::issue::{self, Issue};
use agama_utils::types::event::{self, Event};
use async_trait::async_trait;

pub(crate) const SCOPE: &str = "localization";

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
    #[error("l10n service could not send the event")]
    Event,
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    IO(#[from] std::io::Error),
    #[error(transparent)]
    Generic(#[from] anyhow::Error),
    #[error("There is no proposal for localization")]
    MissingProposal,
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
    state: State,
    model: Box<dyn ModelAdapter + Send + 'static>,
    issues: Handler<issue::Service>,
    events: event::Sender,
}

struct State {
    system: SystemInfo,
    config: ExtendedConfig,
    proposal: Option<Proposal>,
}

impl Service {
    pub fn new<T: ModelAdapter + Send + 'static>(
        model: T,
        issues: Handler<issue::Service>,
        events: event::Sender,
    ) -> Service {
        let system = SystemInfo::read_from(&model);
        let config = ExtendedConfig::new_from(&system);
        let proposal = (&config).into();
        let state = State {
            system,
            config,
            proposal: Some(proposal),
        };

        Self {
            state,
            model: Box::new(model),
            issues,
            events,
        }
    }

    /// Returns configuration issues.
    ///
    /// It returns an issue for each unknown element (locale, keymap and timezone).
    fn find_issues(&self) -> Vec<Issue> {
        let config = &self.state.config;
        let mut issues = vec![];
        if !self.model.locales_db().exists(&config.locale) {
            issues.push(Issue {
                description: format!("Locale '{}' is unknown", &config.locale),
                details: None,
                source: issue::IssueSource::Config,
                severity: issue::IssueSeverity::Error,
                kind: "unknown_locale".to_string(),
            });
        }

        if !self.model.keymaps_db().exists(&config.keymap) {
            issues.push(Issue {
                description: format!("Keymap '{}' is unknown", &config.keymap),
                details: None,
                source: issue::IssueSource::Config,
                severity: issue::IssueSeverity::Error,
                kind: "unknown_keymap".to_string(),
            });
        }

        if !self.model.timezones_db().exists(&config.timezone) {
            issues.push(Issue {
                description: format!("Timezone '{}' is unknown", &config.timezone),
                details: None,
                source: issue::IssueSource::Config,
                severity: issue::IssueSeverity::Error,
                kind: "unknown_timezone".to_string(),
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
        Ok(self.state.system.clone())
    }
}

#[async_trait]
impl MessageHandler<message::SetSystem<message::SystemConfig>> for Service {
    async fn handle(
        &mut self,
        message: message::SetSystem<message::SystemConfig>,
    ) -> Result<(), Error> {
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
    async fn handle(&mut self, _message: message::GetConfig) -> Result<Config, Error> {
        Ok((&self.state.config).into())
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig<Config>> for Service {
    async fn handle(&mut self, message: message::SetConfig<Config>) -> Result<(), Error> {
        let merged = self.state.config.merge(&message.config)?;
        if merged == self.state.config {
            return Ok(());
        }

        self.state.config = merged;
        let issues = self.find_issues();

        self.state.proposal = if issues.is_empty() {
            Some((&self.state.config).into())
        } else {
            None
        };

        _ = self.issues.cast(issue::message::Update::new(SCOPE, issues));
        _ = self.events.send(Event::ProposalChanged {
            scope: SCOPE.to_string(),
        });
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::GetProposal> for Service {
    async fn handle(&mut self, _message: message::GetProposal) -> Result<Option<Proposal>, Error> {
        Ok(self.state.proposal.clone())
    }
}

#[async_trait]
impl MessageHandler<message::Install> for Service {
    async fn handle(&mut self, _message: message::Install) -> Result<(), Error> {
        let Some(proposal) = &self.state.proposal else {
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
        self.state.system.locale = message.locale;
        _ = self.events.send(Event::SystemChanged {
            scope: SCOPE.to_string(),
        });
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::UpdateKeymap> for Service {
    async fn handle(&mut self, message: message::UpdateKeymap) -> Result<(), Error> {
        self.state.system.keymap = message.keymap;
        _ = self.events.send(Event::SystemChanged {
            scope: SCOPE.to_string(),
        });
        Ok(())
    }
}
