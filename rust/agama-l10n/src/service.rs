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

use crate::{
    config::Config,
    event::Event,
    messages,
    model::{Model, ModelAdapter},
    proposal::Proposal,
    system_info::SystemInfo,
    user_config::UserConfig,
};
use agama_locale_data::{InvalidKeymapId, InvalidLocaleId, InvalidTimezoneId, KeymapId, LocaleId};
use agama_utils::{
    actors::{Actor, Handles, MailboxReceiver},
    Service as AgamaService,
};
use tokio::sync::{mpsc, oneshot};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Unknown locale: {0}")]
    UnknownLocale(LocaleId),
    #[error("Unknown keymap: {0}")]
    UnknownKeymap(KeymapId),
    #[error("Unknown timezone: {0}")]
    UnknownTimezone(String),
    #[error("Invalid locale: {0}")]
    InvalidLocale(#[from] InvalidLocaleId),
    #[error("Invalid keymap: {0}")]
    InvalidKeymap(#[from] InvalidKeymapId),
    #[error("Invalid timezone")]
    InvalidTimezone(#[from] InvalidTimezoneId),
    #[error("l10n service could not send the message")]
    SendResponse,
    #[error("l10n service could not send the event")]
    Event,
    #[error(transparent)]
    IO(#[from] std::io::Error),
    #[error(transparent)]
    Generic(#[from] anyhow::Error),
}

#[derive(Debug)]
pub enum Message {
    GetSystem {
        respond_to: oneshot::Sender<SystemInfo>,
    },
    SetSystem {
        config: SystemConfig,
    },
    GetConfig {
        respond_to: oneshot::Sender<UserConfig>,
    },
    SetConfig {
        config: UserConfig,
    },
    GetProposal {
        respond_to: oneshot::Sender<Proposal>,
    },
    UpdateKeymap {
        keymap: KeymapId,
    },
    UpdateLocale {
        locale: LocaleId,
    },
    Install,
}

#[derive(Clone, Debug)]
pub struct SystemConfig {
    pub language: Option<String>,
    pub keyboard: Option<String>,
}

pub struct Service<T>
where
    T: ModelAdapter,
{
    state: State,
    model: T,
    messages: MailboxReceiver,
    events: mpsc::UnboundedSender<Event>,
}

struct State {
    system: SystemInfo,
    config: Config,
}

impl<T> Service<T>
where
    T: ModelAdapter,
{
    pub fn new(
        mut model: T,
        messages: MailboxReceiver,
        events: mpsc::UnboundedSender<Event>,
    ) -> Service<T> {
        let system = SystemInfo::read_from(&mut model);
        let config = Config::new_from(&system);
        let state = State { system, config };

        Self {
            state,
            model,
            messages,
            events,
        }
    }
}

impl<T: ModelAdapter + 'static> Actor for Service<T> {
    fn channel(&mut self) -> &mut agama_utils::actors::MailboxReceiver {
        &mut self.messages
    }
}

impl<T: ModelAdapter + 'static> Handles<messages::GetSystem> for Service<T> {
    type Reply = SystemInfo;

    fn handle(&mut self, _message: messages::GetSystem) -> Self::Reply {
        self.state.system.clone()
    }
}

impl<T: ModelAdapter + 'static> Handles<messages::SetSystem<SystemConfig>> for Service<T> {
    type Reply = ();

    fn handle(&mut self, message: messages::SetSystem<SystemConfig>) -> Self::Reply {
        let config = &message.config;
        if let Some(language) = &config.language {
            // self.model.set_locale(language.parse()?)?;
            self.model.set_locale(language.parse().unwrap()).unwrap();
        }

        if let Some(keyboard) = &config.keyboard {
            self.model.set_keymap(keyboard.parse().unwrap()).unwrap()
        };
    }
}

impl<T: ModelAdapter + 'static> Handles<messages::GetConfig> for Service<T> {
    type Reply = UserConfig;

    fn handle(&mut self, _message: messages::GetConfig) -> Self::Reply {
        (&self.state.config).into()
    }
}

impl<T: ModelAdapter + 'static> Handles<messages::SetConfig<UserConfig>> for Service<T> {
    type Reply = ();

    fn handle(&mut self, message: messages::SetConfig<UserConfig>) -> Self::Reply {
        let merged = self.state.config.merge(&message.config).unwrap();
        if merged != self.state.config {
            self.state.config = merged;
            _ = self.events.send(Event::ProposalChanged);
        }
        ()
    }
}

impl<T: ModelAdapter + 'static> Handles<messages::GetProposal> for Service<T> {
    type Reply = Proposal;

    fn handle(&mut self, _message: messages::GetProposal) -> Self::Reply {
        (&self.state.config).into()
    }
}

impl<T: ModelAdapter + 'static> Handles<messages::Install> for Service<T> {
    type Reply = ();

    fn handle(&mut self, _message: messages::Install) -> Self::Reply {
        let proposal: Proposal = (&self.state.config).into();
        self.model
            .install(proposal.locale, proposal.keymap, proposal.timezone)
            .unwrap();
    }
}
