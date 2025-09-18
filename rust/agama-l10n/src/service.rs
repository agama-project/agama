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

use crate::{actions, Error, Model, Proposal, SystemInfo, UserConfig};
use agama_locale_data::{KeymapId, LocaleId, TimezoneId};
use agama_utils::Service as AgamaService;
use serde::Deserialize;
use tokio::sync::{mpsc, oneshot};

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
}

pub struct Service {
    state: State,
    model: Model,
    receiver: mpsc::UnboundedReceiver<Message>,
}

struct State {
    system: SystemInfo,
    config: Config,
}

impl Service {
    pub fn new(receiver: mpsc::UnboundedReceiver<Message>) -> Self {
        let model = Model::new_with_locale(&LocaleId::default()).unwrap();
        let system = SystemInfo::read_from(&model);
        let config = Config::new_from(&system);

        let state = State { system, config };

        Self {
            state,
            model,
            receiver,
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

impl AgamaService for Service {
    type Err = Error;
    type Message = Message;

    fn channel(&mut self) -> &mut mpsc::UnboundedReceiver<Self::Message> {
        &mut self.receiver
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
        };

        Ok(())
    }
}

struct Config {
    locale: LocaleId,
    keymap: KeymapId,
    timezone: TimezoneId,
}

impl Config {
    fn new_from(system: &SystemInfo) -> Self {
        Self {
            locale: system.locale.clone(),
            keymap: system.keymap.clone(),
            timezone: system.timezone.clone(),
        }
    }

    fn merge(&mut self, config: &UserConfig) -> Result<(), Error> {
        if let Some(language) = &config.language {
            self.locale = language.parse().map_err(Error::InvalidLocale)?
        }

        if let Some(keyboard) = &config.keyboard {
            self.keymap = keyboard.parse().map_err(Error::InvalidKeymap)?
        }

        if let Some(timezone) = &config.timezone {
            self.timezone = timezone.parse().map_err(Error::InvalidTimezone)?;
        }

        Ok(())
    }
}

impl From<&Config> for UserConfig {
    fn from(config: &Config) -> Self {
        UserConfig {
            language: Some(config.locale.to_string()),
            keyboard: Some(config.keymap.to_string()),
            timezone: Some(config.timezone.to_string()),
        }
    }
}

impl From<&Config> for Proposal {
    fn from(config: &Config) -> Self {
        Proposal {
            keymap: config.keymap.clone(),
            locale: config.locale.clone(),
            timezone: config.timezone.clone(),
        }
    }
}
