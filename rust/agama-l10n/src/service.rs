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

use crate::{actions, model::L10nAdapter, Config, Event, Model, Proposal, SystemInfo, UserConfig};
use agama_locale_data::{InvalidKeymapId, InvalidLocaleId, InvalidTimezoneId, KeymapId, LocaleId};
use agama_utils::{service, Service as AgamaService};
use serde::Deserialize;
use tokio::sync::{mpsc, oneshot};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Unknown locale code: {0}")]
    UnknownLocale(LocaleId),
    #[error("Invalid locale: {0}")]
    InvalidLocale(#[from] InvalidLocaleId),
    #[error("Unknown timezone: {0}")]
    UnknownTimezone(String),
    #[error("Invalid timezone")]
    InvalidTimezone(#[from] InvalidTimezoneId),
    #[error("Unknown keymap: {0}")]
    UnknownKeymap(KeymapId),
    #[error("Invalid keymap: {0}")]
    InvalidKeymap(#[from] InvalidKeymapId),
    #[error("Could not apply the l10n settings: {0}")]
    Commit(#[from] std::io::Error),
    #[error(transparent)]
    Service(#[from] service::Error),
    #[error(transparent)]
    Generic(#[from] anyhow::Error),
}

#[derive(Debug, Deserialize)]
pub enum L10nAction {
    #[serde(rename = "configureL10n")]
    ConfigureSystem(actions::ConfigureSystemAction),
}

#[derive(Debug)]
pub enum Message {
    GetConfig {
        respond_to: oneshot::Sender<UserConfig>,
    },
    SetConfig {
        config: UserConfig,
    },
    GetProposal {
        respond_to: oneshot::Sender<Proposal>,
    },
    GetSystem {
        respond_to: oneshot::Sender<SystemInfo>,
    },
    DispatchAction {
        action: L10nAction,
    },
    UpdateKeymap {
        keymap: KeymapId,
    },
    UpdateLocale {
        locale: LocaleId,
    },
}

pub struct Service<T>
where
    T: L10nAdapter,
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
    T: L10nAdapter,
{
    pub fn new(
        model: T,
        messages: mpsc::UnboundedReceiver<Message>,
        events: mpsc::UnboundedSender<Event>,
    ) -> Service<T> {
        let system = SystemInfo::read_from(&model);
        let config = Config::new_from(&system);

        let state = State { system, config };

        Self {
            state,
            model,
            messages,
            events,
        }
    }

    fn get_config(&self) -> UserConfig {
        (&self.state.config).into()
    }

    fn set_config(&mut self, user_config: &UserConfig) -> Result<(), Error> {
        self.state.config.merge(user_config)
    }

    fn get_proposal(&self) -> Proposal {
        (&self.state.config).into()
    }

    fn get_system(&self) -> &SystemInfo {
        &self.state.system
    }

    fn dispatch(&mut self, action: L10nAction) -> anyhow::Result<()> {
        match action {
            L10nAction::ConfigureSystem(action) => action.run(self),
        }
    }
}

impl<T> AgamaService for Service<T>
where
    T: L10nAdapter,
{
    type Err = service::Error;
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
            Message::DispatchAction { action } => {
                self.dispatch(action).unwrap();
            }
            Message::UpdateLocale { locale } => {
                self.state.system.locale = locale.clone();
                _ = self.events.send(Event::LocaleChanged { locale });
            }
            Message::UpdateKeymap { keymap } => {
                self.state.system.keymap = keymap.clone();
                _ = self.events.send(Event::KeymapChanged { keymap });
            }
        };

        Ok(())
    }
}
