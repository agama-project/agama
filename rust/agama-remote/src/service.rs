// Copyright (c) [2026] SUSE LLC
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

use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

use agama_software::Resolvable;
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        self, event,
        remote_access::{Config, ExtendedConfig},
        Event, Scope,
    },
    command::{open_firewall, try_enable_service},
};
use async_trait::async_trait;
use tokio::sync::broadcast::Sender;

use crate::message;

const DEFAULT_INSTALL_DIR: &str = "/mnt";

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error("Failed to enable service: {0}")]
    ServiceFailed(String),
    #[error("Failed to open firewall port: {0}")]
    FirewallFailed(String),
    #[error(transparent)]
    IO(#[from] std::io::Error),
    #[error(transparent)]
    ServiceError(#[from] agama_utils::command::ServiceError),
    #[error(transparent)]
    FirewallError(#[from] agama_utils::command::FirewallError),
}

pub struct Starter {
    software: Handler<agama_software::Service>,
    install_dir: PathBuf,
    events: event::Sender,
}

impl Starter {
    pub fn new(software: Handler<agama_software::Service>, events: event::Sender) -> Starter {
        Self {
            software,
            install_dir: PathBuf::from(DEFAULT_INSTALL_DIR),
            events,
        }
    }

    pub fn with_install_dir<P: AsRef<Path>>(mut self, install_dir: P) -> Self {
        self.install_dir = PathBuf::from(install_dir.as_ref());
        self
    }

    pub fn start(self) -> Result<Handler<Service>, Error> {
        let service = Service {
            state: State::new(self.software.clone(), self.events),
            install_dir: self.install_dir.clone(),
        };
        let handler = actor::spawn(service);
        Ok(handler)
    }
}

struct State {
    /// config specified by user
    user_config: Config,
    /// configs to request remote access from other parts of agama
    agama_config: HashMap<String, Config>,
    software: Handler<agama_software::Service>,
    events: Sender<Event>,
}

impl State {
    pub fn new(software: Handler<agama_software::Service>, events: Sender<Event>) -> Self {
        Self {
            user_config: Config::default(),
            agama_config: HashMap::new(),
            software,
            events,
        }
    }

    fn is_ssh_enabled(&self) -> bool {
        if let Some(config) = &self.user_config.ssh {
            return config == &api::remote_access::AccessEnum::Enabled;
        };

        // no user explicit selection, so compute it from agama requirements
        self.agama_config
            .values()
            .any(|config| config.ssh == Some(api::remote_access::AccessEnum::Enabled))
    }

    fn is_cockpit_enabled(&self) -> bool {
        if let Some(config) = &self.user_config.cockpit {
            return config == &api::remote_access::AccessEnum::Enabled;
        };

        // no user explicit selection, so compute it from agama requirements
        self.agama_config
            .values()
            .any(|config| config.cockpit == Some(api::remote_access::AccessEnum::Enabled))
    }

    pub fn extended_config(&self) -> ExtendedConfig {
        let ssh = if self.is_ssh_enabled() {
            api::remote_access::AccessEnum::Enabled
        } else {
            api::remote_access::AccessEnum::Default
        };

        let cockpit = if self.is_cockpit_enabled() {
            api::remote_access::AccessEnum::Enabled
        } else {
            api::remote_access::AccessEnum::Default
        };

        ExtendedConfig { ssh, cockpit }
    }

    pub async fn write<P: AsRef<Path>>(&self, install_dir: P) -> Result<(), Error> {
        if self.is_ssh_enabled() {
            // TODO: when we can report install issues, we should report
            // it here which individual remote access enablement failed
            let res = Self::enable_ssh(&install_dir).await;
            if let Err(error) = res {
                tracing::error!("Failed to enable ssh: {}", error);
            }
        }
        if self.is_cockpit_enabled() {
            // TODO: when we can report install issues, we should report
            // it here which individual remote access enablement failed
            let res = Self::enable_cockpit(&install_dir).await;
            if let Err(error) = res {
                tracing::error!("Failed to enable cockpit: {}", error);
            }
        }
        Ok(())
    }

    async fn enable_ssh<P: AsRef<Path>>(install_dir: P) -> Result<(), Error> {
        try_enable_service(&install_dir, "sshd.service").await?;

        open_firewall(&install_dir, "ssh").await?;

        Ok(())
    }

    async fn enable_cockpit<P: AsRef<Path>>(install_dir: P) -> Result<(), Error> {
        try_enable_service(&install_dir, "cockpit.socket").await?;
        open_firewall(&install_dir, "cockpit").await?;

        Ok(())
    }

    pub fn set_user_config(&mut self, config: Config) {
        self.user_config = config;
        self.update_resolvables();
        // ignoring error here is ok as it means just dismissed event
        let _ = self.events.send(Event::ProposalChanged {
            scope: Scope::RemoteAccess,
        });
    }

    pub fn set_module_config(&mut self, id: String, config: Config) {
        self.agama_config.insert(id, config);
        self.update_resolvables();
        // ignoring error here is ok as it means just dismissed event
        let _ = self.events.send(Event::ProposalChanged {
            scope: Scope::RemoteAccess,
        });
    }

    fn update_resolvables(&mut self) {
        let mut resolvables = vec![];
        if self.is_cockpit_enabled() {
            resolvables.push(Resolvable {
                name: "cockpit".to_string(),
                r#type: agama_software::ResolvableType::Pattern,
            });
        }
        if self.is_ssh_enabled() {
            resolvables.push(Resolvable {
                name: "openssh-server".to_string(),
                r#type: agama_software::ResolvableType::Package,
            });
        }
        let res = self.software.cast(agama_software::message::SetResolvables {
            id: "remote_access".to_string(),
            resolvables,
        });
        if let Err(error) = res {
            tracing::error!(
                "Failed to call set resolvables for remote Access: {:?}",
                error
            );
        }
    }
}

pub struct Service {
    state: State,
    install_dir: PathBuf,
}

impl Service {
    pub fn starter(software: Handler<agama_software::Service>, events: Sender<Event>) -> Starter {
        Starter::new(software, events)
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::SetConfig<api::remote_access::Config>> for Service {
    async fn handle(
        &mut self,
        message: message::SetConfig<api::remote_access::Config>,
    ) -> Result<(), Error> {
        self.state
            .set_user_config(message.config.unwrap_or_default());
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(
        &mut self,
        _message: message::GetConfig,
    ) -> Result<api::remote_access::Config, Error> {
        // FIXME: remember what is set and what not
        Ok(self.state.user_config.clone())
    }
}

#[async_trait]
impl MessageHandler<message::SetAccess> for Service {
    async fn handle(&mut self, message: message::SetAccess) -> Result<(), Error> {
        self.state.set_module_config(message.id, message.config);
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::GetProposal> for Service {
    async fn handle(&mut self, _message: message::GetProposal) -> Result<ExtendedConfig, Error> {
        Ok(self.state.extended_config())
    }
}

#[async_trait]
impl MessageHandler<message::Finish> for Service {
    async fn handle(&mut self, _message: message::Finish) -> Result<(), Error> {
        self.state.write(&self.install_dir).await
    }
}
