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

use crate::l10n;
use crate::message;
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        event, status::State, Action, Config, Event, IssueMap, Proposal, Scope, Status, SystemInfo,
    },
    issue, progress, question,
};
use async_trait::async_trait;
use merge_struct::merge;
use tokio::sync::broadcast;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Cannot merge the configuration")]
    MergeConfig,
    #[error(transparent)]
    Event(#[from] broadcast::error::SendError<Event>),
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    Progress(#[from] progress::service::Error),
    #[error(transparent)]
    L10n(#[from] l10n::service::Error),
    #[error(transparent)]
    Issues(#[from] issue::service::Error),
    #[error(transparent)]
    Questions(#[from] question::service::Error),
}

pub struct Service {
    l10n: Handler<l10n::service::Service>,
    issues: Handler<issue::Service>,
    progress: Handler<progress::Service>,
    questions: Handler<question::Service>,
    state: State,
    config: Config,
    events: event::Sender,
}

impl Service {
    pub fn new(
        l10n: Handler<l10n::Service>,
        issues: Handler<issue::Service>,
        progress: Handler<progress::Service>,
        questions: Handler<question::Service>,
        events: event::Sender,
    ) -> Self {
        Self {
            l10n,
            issues,
            progress,
            questions,
            events,
            state: State::Configuring,
            config: Config::default(),
        }
    }

    async fn install(&mut self) -> Result<(), Error> {
        self.state = State::Installing;
        self.events.send(Event::StateChanged)?;
        // TODO: translate progress steps.
        self.progress
            .call(progress::message::StartWithSteps::new(
                Scope::Manager,
                &["Installing l10n"],
            ))
            .await?;
        self.l10n.call(l10n::message::Install).await?;
        self.progress
            .call(progress::message::Finish::new(Scope::Manager))
            .await?;
        self.state = State::Finished;
        self.events.send(Event::StateChanged)?;
        Ok(())
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::GetStatus> for Service {
    /// It returns the status of the installation.
    async fn handle(&mut self, _message: message::GetStatus) -> Result<Status, Error> {
        let progresses = self.progress.call(progress::message::Get).await?;
        Ok(Status {
            state: self.state.clone(),
            progresses,
        })
    }
}

#[async_trait]
impl MessageHandler<message::GetSystem> for Service {
    /// It returns the information of the underlying system.
    async fn handle(&mut self, _message: message::GetSystem) -> Result<SystemInfo, Error> {
        let l10n = self.l10n.call(l10n::message::GetSystem).await?;
        Ok(SystemInfo { l10n })
    }
}

#[async_trait]
impl MessageHandler<message::GetExtendedConfig> for Service {
    /// Gets the current configuration.
    ///
    /// It includes user and default values.
    async fn handle(&mut self, _message: message::GetExtendedConfig) -> Result<Config, Error> {
        let l10n = self.l10n.call(l10n::message::GetConfig).await?;
        let questions = self.questions.call(question::message::GetConfig).await?;
        Ok(Config {
            l10n: Some(l10n),
            questions: Some(questions),
        })
    }
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    /// Gets the current configuration set by the user.
    ///
    /// It includes only the values that were set by the user.
    async fn handle(&mut self, _message: message::GetConfig) -> Result<Config, Error> {
        Ok(self.config.clone())
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig> for Service {
    /// Sets the user configuration with the given values.
    ///
    /// It merges the values in the top-level. Therefore, if the configuration
    /// for a scope is not given, it keeps the previous one.
    ///
    /// FIXME: We should replace not given sections with the default ones.
    /// After all, now we have config/user/:scope URLs.
    async fn handle(&mut self, message: message::SetConfig) -> Result<(), Error> {
        if let Some(l10n) = &message.config.l10n {
            self.l10n
                .call(l10n::message::SetConfig::new(l10n.clone()))
                .await?;
        }

        if let Some(questions) = &message.config.questions {
            self.questions
                .call(question::message::SetConfig::new(questions.clone()))
                .await?;
        }
        self.config = message.config;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::UpdateConfig> for Service {
    /// Patches the user configuration with the given values.
    ///
    /// It merges the current configuration with the given one.
    async fn handle(&mut self, message: message::UpdateConfig) -> Result<(), Error> {
        let config = merge(&self.config, &message.config).map_err(|_| Error::MergeConfig)?;
        self.handle(message::SetConfig::new(config)).await
    }
}

#[async_trait]
impl MessageHandler<message::GetProposal> for Service {
    /// It returns the current proposal, if any.
    async fn handle(&mut self, _message: message::GetProposal) -> Result<Option<Proposal>, Error> {
        let l10n = self.l10n.call(l10n::message::GetProposal).await?;
        Ok(Some(Proposal { l10n }))
    }
}

#[async_trait]
impl MessageHandler<message::GetIssues> for Service {
    /// It returns the current proposal, if any.
    async fn handle(&mut self, _message: message::GetIssues) -> Result<IssueMap, Error> {
        Ok(self.issues.call(issue::message::Get).await?)
    }
}

#[async_trait]
impl MessageHandler<message::RunAction> for Service {
    /// It runs the given action.
    async fn handle(&mut self, message: message::RunAction) -> Result<(), Error> {
        match message.action {
            Action::ConfigureL10n(config) => {
                let l10n_message = l10n::message::SetSystem::new(config);
                self.l10n.call(l10n_message).await?;
            }
            Action::Install => {
                self.install().await?;
            }
        }
        Ok(())
    }
}
