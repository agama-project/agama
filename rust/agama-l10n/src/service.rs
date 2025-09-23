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

use crate::{model::ModelAdapter, Config, Event, Proposal, SystemInfo, UserConfig};
use agama_locale_data::{InvalidKeymapId, InvalidLocaleId, InvalidTimezoneId, KeymapId, LocaleId};
use agama_utils::Service as AgamaService;
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

#[derive(Debug)]
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
    messages: mpsc::UnboundedReceiver<Message>,
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
        messages: mpsc::UnboundedReceiver<Message>,
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

    fn get_system(&self) -> &SystemInfo {
        &self.state.system
    }

    // The system state is automatically updated by the monitor.
    fn set_system(&mut self, config: SystemConfig) -> Result<(), Error> {
        if let Some(language) = &config.language {
            self.model.set_locale(language.parse()?)?;
        }

        if let Some(keyboard) = &config.keyboard {
            self.model.set_keymap(keyboard.parse()?)?;
        };

        Ok(())
    }

    fn get_config(&self) -> UserConfig {
        (&self.state.config).into()
    }

    fn set_config(&mut self, user_config: &UserConfig) -> Result<(), Error> {
        let merged = self.state.config.merge(user_config)?;
        if merged != self.state.config {
            self.state.config = merged;
            _ = self.events.send(Event::ProposalChanged {
                proposal: self.get_proposal(),
            });
        }
        Ok(())
    }

    fn get_proposal(&self) -> Proposal {
        (&self.state.config).into()
    }

    fn install(&self) -> Result<(), Error> {
        let proposal = self.get_proposal();
        self.model
            .install(proposal.locale, proposal.keymap, proposal.timezone)
    }
}

impl<T> AgamaService for Service<T>
where
    T: ModelAdapter,
{
    type Err = Error;
    type Message = Message;

    fn channel(&mut self) -> &mut mpsc::UnboundedReceiver<Self::Message> {
        &mut self.messages
    }

    async fn dispatch(&mut self, message: Self::Message) -> Result<(), Self::Err> {
        match message {
            Message::GetConfig { respond_to } => {
                respond_to.send(self.get_config()).unwrap();
            }
            Message::SetConfig { config } => {
                self.set_config(&config).unwrap();
            }
            Message::GetProposal { respond_to } => {
                respond_to.send(self.get_proposal()).unwrap();
            }
            Message::GetSystem { respond_to } => {
                respond_to.send(self.get_system().clone()).unwrap();
            }
            Message::UpdateLocale { locale } => {
                self.state.system.locale = locale.clone();
                _ = self.events.send(Event::LocaleChanged { locale });
                _ = self.events.send(Event::SystemChanged);
            }
            Message::UpdateKeymap { keymap } => {
                self.state.system.keymap = keymap;
                _ = self.events.send(Event::SystemChanged);
            }
            Message::SetSystem { config } => {
                self.set_system(config).unwrap();
            }
            Message::Install => {
                self.install().unwrap();
            }
        };

        Ok(())
    }
}
