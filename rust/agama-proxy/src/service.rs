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

use crate::model;
use std::{
    path::{Path, PathBuf},
    process,
};

use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        self,
        event::{self},
    },
};
use async_trait::async_trait;

use crate::{message, model::ProxyConfig};

const PROXY_PATH: &str = "etc/sysconfig/proxy";
const DEFAULT_WORKDIR: &str = "/";
const DEFAULT_INSTALL_DIR: &str = "/mnt";

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    Model(#[from] model::Error),
    #[error(transparent)]
    IO(#[from] std::io::Error),
}

pub struct Starter {
    events: event::Sender,
    workdir: PathBuf,
    install_dir: PathBuf,
}

impl Starter {
    /// Creates a new starter.
    /// * `events`: channel to emit the [proxy-specific events](crate::Event).
    pub fn new(events: event::Sender) -> Starter {
        Self {
            events,
            workdir: PathBuf::from(DEFAULT_WORKDIR),
            install_dir: PathBuf::from(DEFAULT_INSTALL_DIR),
        }
    }

    pub fn with_install_dir<P: AsRef<Path>>(mut self, install_dir: P) -> Self {
        self.install_dir = PathBuf::from(install_dir.as_ref());
        self
    }

    pub fn with_workdir(mut self, workdir: &Path) -> Self {
        self.workdir = workdir.to_path_buf();
        self
    }

    pub fn start(self) -> Result<Handler<Service>, Error> {
        let service = Service {
            events: self.events,
            state: State::new(self.workdir.join(PROXY_PATH)),
            install_dir: self.install_dir,
        };

        let handler = actor::spawn(service);
        Ok(handler)
    }
}

#[derive(Default)]
struct State {
    system: Option<ProxyConfig>,
    config: Option<ProxyConfig>,
    config_path: PathBuf,
}

impl State {
    pub fn new(config_path: PathBuf) -> Self {
        let mut object = Self {
            config_path,
            ..Default::default()
        };
        let replace = ProxyConfig::from_cmdline().is_some();
        object.load(replace);
        object
    }

    pub fn load(&mut self, replace_config: bool) {
        let mut config = None;
        match ProxyConfig::read_from(&self.config_path) {
            Ok(system) => {
                if replace_config {
                    config = Some(system.clone());
                }
                self.system = Some(system)
            }
            Err(e) => {
                tracing::error!("Failed to read proxy configuration: {}", e);
                self.system = None
            }
        };
        self.config = config;
    }

    pub fn to_config(&self, config: Option<ProxyConfig>) -> Option<api::proxy::Config> {
        if let Some(proxy_config) = config {
            let mut config = api::proxy::Config {
                enabled: proxy_config.enabled,
                no_proxy: proxy_config.no_proxy.clone(),
                ..Default::default()
            };

            for proxy in &proxy_config.proxies {
                let value = match &proxy.protocol {
                    model::Protocol::FTP => &mut config.ftp,
                    model::Protocol::HTTP => &mut config.http,
                    model::Protocol::HTTPS => &mut config.https,
                    model::Protocol::GOPHER => &mut config.gopher,
                    model::Protocol::SOCKS => &mut config.socks,
                    model::Protocol::SOCKS5 => &mut config.socks5,
                };

                *value = Some(proxy.url.clone());
            }

            return Some(config);
        }

        None
    }

    pub fn update_config(&mut self, config: api::proxy::Config) -> Result<(), model::Error> {
        let mut proxies = Vec::new();

        if let Some(url) = config.ftp {
            proxies.push(model::Proxy::new(url, model::Protocol::FTP));
        }
        if let Some(url) = config.http {
            proxies.push(model::Proxy::new(url, model::Protocol::HTTP));
        }
        if let Some(url) = config.https {
            proxies.push(model::Proxy::new(url, model::Protocol::HTTPS));
        }
        if let Some(url) = config.gopher {
            proxies.push(model::Proxy::new(url, model::Protocol::GOPHER));
        }
        if let Some(url) = config.socks {
            proxies.push(model::Proxy::new(url, model::Protocol::SOCKS));
        }
        if let Some(url) = config.socks5 {
            proxies.push(model::Proxy::new(url, model::Protocol::SOCKS5));
        }

        let proxy_config = ProxyConfig {
            proxies,
            enabled: config.enabled,
            no_proxy: config.no_proxy,
        };

        let path = &self.config_path;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        proxy_config.write_to(&path)?;
        self.load(true);
        Ok(())
    }
}

pub struct Service {
    events: event::Sender,
    state: State,
    install_dir: PathBuf,
}

impl Service {
    pub fn starter(events: event::Sender) -> Starter {
        Starter::new(events)
    }

    pub fn config_path(&self) -> PathBuf {
        self.install_dir.join(PROXY_PATH)
    }
    pub fn enable_services(&self) -> Result<(), Error> {
        self.enable_service("setup-systemd-proxy-env.service")?;
        self.enable_service("setup-systemd-proxy-env.path")?;
        Ok(())
    }

    pub fn enable_service(&self, name: &str) -> Result<(), Error> {
        let mut command = process::Command::new("chroot");
        let path = self.install_dir.to_str().unwrap();
        command.args([path, "systemctl", "enable", name]);

        match command.output() {
            Ok(output) => {
                if !output.status.success() {
                    tracing::error!("Failed to enable the {name} service: {output:?}")
                }
            }
            Err(error) => {
                tracing::error!(
                    "Failed to run the command to enable the {name} service command: {error}"
                );
            }
        }

        Ok(())
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::SetConfig<api::proxy::Config>> for Service {
    async fn handle(
        &mut self,
        message: message::SetConfig<api::proxy::Config>,
    ) -> Result<(), Error> {
        if let Some(config) = message.config {
            self.state.update_config(config)?;
        }
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(
        &mut self,
        _message: message::GetConfig,
    ) -> Result<Option<api::proxy::Config>, Error> {
        Ok(self.state.to_config(self.state.config.clone()))
    }
}

#[async_trait]
impl MessageHandler<message::GetSystem> for Service {
    async fn handle(
        &mut self,
        _message: message::GetSystem,
    ) -> Result<Option<api::proxy::Config>, Error> {
        Ok(self.state.to_config(self.state.system.clone()))
    }
}

#[async_trait]
impl MessageHandler<message::Finish> for Service {
    async fn handle(&mut self, _message: message::Finish) -> Result<(), Error> {
        if let Some(config) = &self.state.config {
            let path = self.config_path();
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            config.write_to(&path)?;
            self.enable_services()?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    #[test]

    fn test_state_update_and_to_config() {
        // Setup paths
        let temp_dir = std::env::temp_dir().join("agama-proxy-state-test");
        let _ = fs::remove_dir_all(&temp_dir);

        fs::create_dir_all(&temp_dir).unwrap();
        let config_path = temp_dir.join("proxy");
        // Create State
        let mut state = State::new(config_path.clone());
        // Test update_config
        let config = api::proxy::Config {
            http: Some("http://proxy.example.com".to_string()),
            enabled: Some(true),
            socks5: Some("socks.example.com".to_string()),
            ..Default::default()
        };

        state.update_config(config.clone()).unwrap();
        // Verify file written
        assert!(config_path.exists());
        let content = fs::read_to_string(&config_path).unwrap();
        assert!(content.contains("HTTP_PROXY=\"http://proxy.example.com\""));
        assert!(content.contains("SOCKS5_SERVER=\"socks.example.com\""));
        assert!(content.contains("PROXY_ENABLED=\"yes\""));

        // Test to_config
        let retrieved_config = state.to_config(state.config.clone()).unwrap();

        assert_eq!(
            retrieved_config.http,
            Some("http://proxy.example.com".to_string())
        );
        assert_eq!(
            retrieved_config.socks5,
            Some("socks.example.com".to_string())
        );
        assert_eq!(retrieved_config.enabled, Some(true));

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
