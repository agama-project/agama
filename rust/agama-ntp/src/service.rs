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

use crate::{message, model};
use std::path::Path;

use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{self, event},
};
use async_trait::async_trait;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    Model(#[from] model::Error),
}

pub struct Starter {
    _events: event::Sender,
    model: Box<dyn model::ModelAdapter>,
}

impl Starter {
    pub fn new(events: event::Sender) -> Starter {
        Self {
            _events: events,
            model: Box::new(model::Model::new()),
        }
    }

    pub fn with_model(mut self, model: Box<dyn model::ModelAdapter>) -> Self {
        self.model = model;
        self
    }

    pub fn with_install_dir<P: AsRef<Path>>(mut self, install_dir: P) -> Self {
        self.model = Box::new(model::Model::new().with_install_dir(install_dir));
        self
    }

    pub fn start(self) -> Result<Handler<Service>, Error> {
        let service = Service {
            config: None,
            model: self.model,
        };

        let handler = actor::spawn(service);
        Ok(handler)
    }
}

pub struct Service {
    config: Option<api::ntp::Config>,
    model: Box<dyn model::ModelAdapter>,
}

impl Service {
    pub fn starter(events: event::Sender) -> Starter {
        Starter::new(events)
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(
        &mut self,
        _message: message::GetConfig,
    ) -> Result<Option<api::ntp::Config>, Error> {
        Ok(self.config.clone())
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig<api::ntp::Config>> for Service {
    async fn handle(&mut self, message: message::SetConfig<api::ntp::Config>) -> Result<(), Error> {
        if let Some(config) = &message.config {
            if let Err(e) = self.model.write_config(config) {
                tracing::error!("Failed to write NTP configuration: {}", e);
            }
            self.config = Some(config.clone());
        }
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::Finish> for Service {
    async fn handle(&mut self, _message: message::Finish) -> Result<(), Error> {
        if let Some(config) = &self.config {
            if let Err(e) = self.model.install(config) {
                tracing::error!("Failed to install NTP configuration: {}", e);
            }
        }
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::SetLocale> for Service {
    async fn handle(&mut self, _message: message::SetLocale) -> Result<(), Error> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agama_utils::api::ntp::{Config, Source, SourceType};
    use std::sync::{Arc, Mutex};

    #[derive(Clone)]
    struct MockModel {
        write_called: Arc<Mutex<bool>>,
        install_called: Arc<Mutex<bool>>,
        last_config: Arc<Mutex<Option<Config>>>,
    }

    impl MockModel {
        fn new() -> Self {
            Self {
                write_called: Arc::new(Mutex::new(false)),
                install_called: Arc::new(Mutex::new(false)),
                last_config: Arc::new(Mutex::new(None)),
            }
        }
    }

    impl model::ModelAdapter for MockModel {
        fn write_config(&self, config: &Config) -> Result<(), model::Error> {
            *self.write_called.lock().unwrap() = true;
            *self.last_config.lock().unwrap() = Some(config.clone());
            Ok(())
        }

        fn install(&self, config: &Config) -> Result<(), model::Error> {
            *self.install_called.lock().unwrap() = true;
            *self.last_config.lock().unwrap() = Some(config.clone());
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_get_config_empty() {
        let (sender, _receiver) = tokio::sync::broadcast::channel(100);
        let handler = Service::starter(sender).start().unwrap();

        let config = handler.call(message::GetConfig).await.unwrap();
        assert!(config.is_none());
    }

    #[tokio::test]
    async fn test_set_and_get_config() {
        let (sender, _receiver) = tokio::sync::broadcast::channel(100);
        let mock_model = MockModel::new();
        let mock_clone = mock_model.clone();

        let handler = Service::starter(sender)
            .with_model(Box::new(mock_model))
            .start()
            .unwrap();

        let test_config = Config {
            sources: vec![Source {
                source_type: SourceType::Pool,
                address: "ntp.example.com".to_string(),
                iburst: true,
                offline: false,
            }],
        };

        handler
            .call(message::SetConfig::new(Some(test_config.clone())))
            .await
            .unwrap();

        assert!(*mock_clone.write_called.lock().unwrap());

        let retrieved = handler.call(message::GetConfig).await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap(), test_config);
    }

    #[tokio::test]
    async fn test_finish() {
        let (sender, _receiver) = tokio::sync::broadcast::channel(100);
        let mock_model = MockModel::new();
        let mock_clone = mock_model.clone();

        let handler = Service::starter(sender)
            .with_model(Box::new(mock_model))
            .start()
            .unwrap();

        let test_config = Config {
            sources: vec![Source {
                source_type: SourceType::Server,
                address: "ntp.server.com".to_string(),
                iburst: false,
                offline: true,
            }],
        };

        handler
            .call(message::SetConfig::new(Some(test_config)))
            .await
            .unwrap();

        handler.call(message::Finish).await.unwrap();

        assert!(*mock_clone.install_called.lock().unwrap());
    }
}
