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

use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        self,
        access::{Config, ExtendedConfig},
        event, Event, Scope,
    },
    command::{open_firewall, try_enable_service},
    message::GetResolvables,
    Resolvable,
};
use async_trait::async_trait;
use tokio::sync::broadcast::Sender;

use crate::message;

const DEFAULT_INSTALL_DIR: &str = "/mnt";

/// Errors that can occur in the remote access service.
#[derive(thiserror::Error, Debug)]
pub enum Error {
    /// Error originating from the actor system.
    #[error(transparent)]
    Actor(#[from] actor::Error),
    /// Underlying systemctl service command error.
    #[error(transparent)]
    ServiceError(#[from] agama_utils::command::ServiceError),
    /// Underlying firewall command error.
    #[error(transparent)]
    FirewallError(#[from] agama_utils::command::FirewallError),
}

/// Builds and spawns the remote access service.
pub struct Starter {
    /// Directory where the system is being installed.
    install_dir: PathBuf,
    /// Channel to emit remote access events.
    events: event::Sender,
}

impl Starter {
    /// Creates a new starter.
    ///
    /// * `events`: channel to emit events.
    pub fn new(events: event::Sender) -> Starter {
        Self {
            install_dir: PathBuf::from(DEFAULT_INSTALL_DIR),
            events,
        }
    }

    /// Sets the installation directory.
    ///
    /// * `install_dir`: path to the installation directory.
    pub fn with_install_dir<P: AsRef<Path>>(mut self, install_dir: P) -> Self {
        self.install_dir = PathBuf::from(install_dir.as_ref());
        self
    }

    /// Starts the service and returns a handler to communicate with it.
    pub fn start(self) -> Result<Handler<Service>, Error> {
        let service = Service {
            state: State::new(self.events),
            install_dir: self.install_dir.clone(),
        };
        let handler = actor::spawn(service);
        Ok(handler)
    }
}

/// Holds the internal state of the remote access service.
struct State {
    /// Configuration specified by the user.
    user_config: Config,
    /// Configurations requested by other Agama modules.
    agama_config: HashMap<String, Config>,
    /// Channel to emit events.
    events: Sender<Event>,
}

impl State {
    /// Creates a new state instance.
    pub fn new(events: Sender<Event>) -> Self {
        Self {
            user_config: Config::default(),
            agama_config: HashMap::new(),
            events,
        }
    }

    /// Checks if SSH access is enabled either by user configuration or service requests.
    fn is_ssh_enabled(&self) -> bool {
        if let Some(config) = &self.user_config.ssh {
            return config == &api::access::AccessValue::Enabled;
        };

        // no user explicit selection, so compute it from agama requirements
        self.agama_config
            .values()
            .any(|config| config.ssh == Some(api::access::AccessValue::Enabled))
    }

    /// Checks if Web Console access is enabled either by user configuration or module requests.
    fn is_web_console_enabled(&self) -> bool {
        if let Some(config) = &self.user_config.web_console {
            return config == &api::access::AccessValue::Enabled;
        };

        // no user explicit selection, so compute it from agama requirements
        self.agama_config
            .values()
            .any(|config| config.web_console == Some(api::access::AccessValue::Enabled))
    }

    /// Returns the resolved extended configuration for remote access.
    pub fn extended_config(&self) -> ExtendedConfig {
        let ssh = if self.is_ssh_enabled() {
            api::access::AccessValue::Enabled
        } else {
            api::access::AccessValue::Default
        };

        let web_console = if self.is_web_console_enabled() {
            api::access::AccessValue::Enabled
        } else {
            api::access::AccessValue::Default
        };

        ExtendedConfig { ssh, web_console }
    }

    /// Applies the remote access configuration to the target system.
    ///
    /// * `install_dir`: path to the installation directory.
    pub async fn write<P: AsRef<Path>>(&self, install_dir: P) -> Result<(), Error> {
        if self.is_ssh_enabled() {
            // TODO: when we can report install issues, we should report
            // it here which individual remote access enablement failed
            let res = Self::enable_ssh(&install_dir).await;
            if let Err(error) = res {
                tracing::error!("Failed to enable ssh: {}", error);
            }
        }
        if self.is_web_console_enabled() {
            // TODO: when we can report install issues, we should report
            // it here which individual remote access enablement failed
            let res = Self::enable_web_console(&install_dir).await;
            if let Err(error) = res {
                tracing::error!("Failed to enable web_console: {}", error);
            }
        }
        Ok(())
    }

    /// Enables the SSH service and opens the corresponding firewall port.
    async fn enable_ssh<P: AsRef<Path>>(install_dir: P) -> Result<(), Error> {
        try_enable_service(&install_dir, "sshd.service").await?;

        open_firewall(&install_dir, "ssh").await?;

        Ok(())
    }

    /// Enables the Web Console service and opens the corresponding firewall port.
    async fn enable_web_console<P: AsRef<Path>>(install_dir: P) -> Result<(), Error> {
        try_enable_service(&install_dir, "cockpit.socket").await?;
        open_firewall(&install_dir, "cockpit").await?;

        Ok(())
    }

    /// Sets the user-provided configuration and updates software resolvables.
    pub fn set_user_config(&mut self, config: Config) {
        self.user_config = config;
        // ignoring error here is ok as it means just dismissed event
        let _ = self.events.send(Event::ProposalChanged {
            scope: Scope::Access,
        });
    }

    /// Sets the configuration requested by a specific module.
    pub fn set_module_config(&mut self, id: String, config: Config) {
        self.agama_config.insert(id, config);
        // ignoring error here is ok as it means just dismissed event
        let _ = self.events.send(Event::ProposalChanged {
            scope: Scope::Access,
        });
    }
}

/// Remote access service.
///
/// Manages the remote access configuration (like SSH and Web Console) for the target system.
pub struct Service {
    /// Internal state of the service.
    state: State,
    /// Directory where the system is being installed.
    install_dir: PathBuf,
}

impl Service {
    /// Returns a starter to build and spawn the service.
    pub fn starter(events: Sender<Event>) -> Starter {
        Starter::new(events)
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::SetConfig<api::access::Config>> for Service {
    async fn handle(
        &mut self,
        message: message::SetConfig<api::access::Config>,
    ) -> Result<(), Error> {
        self.state
            .set_user_config(message.config.unwrap_or_default());
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(&mut self, _message: message::GetConfig) -> Result<api::access::Config, Error> {
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

#[async_trait]
impl MessageHandler<GetResolvables> for Service {
    async fn handle(&mut self, _message: GetResolvables) -> Result<Vec<Resolvable>, Error> {
        let mut resolvables = vec![];

        if self.state.is_web_console_enabled() {
            resolvables.push(Resolvable::pattern("cockpit"));
        }
        if self.state.is_ssh_enabled() {
            resolvables.push(Resolvable::package("openssh-server"));
        }

        Ok(resolvables)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agama_utils::api::access::AccessValue;
    use tokio::sync::broadcast;

    fn create_test_state() -> State {
        let (tx, _rx) = broadcast::channel(16);
        State {
            user_config: Config::default(),
            agama_config: HashMap::new(),
            events: tx,
        }
    }

    #[test]
    fn test_is_ssh_enabled_no_user_config() {
        let mut state = create_test_state();

        // Without user config or module config, it should be false
        assert!(!state.is_ssh_enabled());

        // Add a module requesting SSH
        let mut module_config = Config::default();
        module_config.ssh = Some(AccessValue::Enabled);
        state
            .agama_config
            .insert("users".to_string(), module_config);

        // Now it should be enabled due to the module's request
        assert!(state.is_ssh_enabled());
    }

    #[test]
    fn test_is_ssh_enabled_with_user_config() {
        let mut state = create_test_state();

        // User explicitly enables SSH
        state.user_config.ssh = Some(AccessValue::Enabled);
        assert!(state.is_ssh_enabled());

        // Module config asks for it, but user already enabled it
        let mut module_config = Config::default();
        module_config.ssh = Some(AccessValue::Enabled);
        state
            .agama_config
            .insert("users".to_string(), module_config.clone());
        assert!(state.is_ssh_enabled());

        // User explicitly disables SSH (sets to Default)
        state.user_config.ssh = Some(AccessValue::Default);
        // User config overrides module config
        assert!(!state.is_ssh_enabled());
    }

    #[test]
    fn test_is_web_console_enabled() {
        let mut state = create_test_state();

        assert!(!state.is_web_console_enabled());

        let mut module_config = Config::default();
        module_config.web_console = Some(AccessValue::Enabled);
        state
            .agama_config
            .insert("storage".to_string(), module_config);

        assert!(state.is_web_console_enabled());

        state.user_config.web_console = Some(AccessValue::Default);
        assert!(!state.is_web_console_enabled());
    }

    #[test]
    fn test_extended_config() {
        let mut state = create_test_state();

        // Initially both are Default
        let ext_config = state.extended_config();
        assert_eq!(ext_config.ssh, AccessValue::Default);
        assert_eq!(ext_config.web_console, AccessValue::Default);

        // Enable SSH via module config
        let mut module_config = Config::default();
        module_config.ssh = Some(AccessValue::Enabled);
        state
            .agama_config
            .insert("users".to_string(), module_config);

        // Enable Web Console via user config
        state.user_config.web_console = Some(AccessValue::Enabled);

        let ext_config = state.extended_config();
        assert_eq!(ext_config.ssh, AccessValue::Enabled);
        assert_eq!(ext_config.web_console, AccessValue::Enabled);
    }
}
