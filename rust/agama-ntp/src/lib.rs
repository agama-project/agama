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

pub mod message;
pub mod model;
pub mod service;
pub use service::{Service, Starter};

#[cfg(test)]
mod tests {
    use agama_l10n::test_utils::start_service as start_l10n_service;
    use agama_software::{test_utils::start_service as start_software_service, Resolvable};

    use agama_utils::{
        actor::Handler,
        api::{
            event,
            ntp::{Config, Source, SourceType},
            Event,
        },
        issue, progress, question,
    };
    use async_trait::async_trait;
    use std::sync::{Arc, Mutex};
    use test_context::{test_context, AsyncTestContext};
    use tokio::sync::broadcast;

    use crate::{message, model, Service};

    #[derive(Clone)]
    struct MockModel {
        write_config_called: Arc<Mutex<bool>>,
        install_called: Arc<Mutex<bool>>,
        last_config: Arc<Mutex<Option<Config>>>,
    }

    impl MockModel {
        fn new() -> Self {
            Self {
                write_config_called: Arc::new(Mutex::new(false)),
                install_called: Arc::new(Mutex::new(false)),
                last_config: Arc::new(Mutex::new(None)),
            }
        }
    }

    #[async_trait]
    impl model::ModelAdapter for MockModel {
        async fn write_config(&self, config: &Config) -> Result<(), model::Error> {
            *self.write_config_called.lock().unwrap() = true;
            *self.last_config.lock().unwrap() = Some(config.clone());
            Ok(())
        }

        async fn install(&self, config: &Config) -> Result<(), model::Error> {
            *self.install_called.lock().unwrap() = true;
            *self.last_config.lock().unwrap() = Some(config.clone());
            Ok(())
        }

        fn resolvables(&self) -> Vec<Resolvable> {
            vec![]
        }

        async fn sync(&self) -> Result<(), model::Error> {
            Ok(())
        }

        async fn remove_config(&self) -> Result<(), model::Error> {
            Ok(())
        }
    }

    struct Context {
        handler: Handler<Service>,
        _events_rx: event::Receiver,
        model: MockModel,
    }

    impl AsyncTestContext for Context {
        async fn setup() -> Context {
            let (events_tx, _events_rx) = broadcast::channel::<Event>(16);
            let issues = issue::Service::starter(events_tx.clone()).start();
            let progress = progress::Service::starter(events_tx.clone()).start();
            let questions = question::start(events_tx.clone()).await.unwrap();
            let l10n = start_l10n_service(events_tx.clone(), issues.clone()).await;

            let software = start_software_service(
                events_tx.clone(),
                issues,
                l10n,
                progress.clone(),
                questions.clone(),
            )
            .await;

            let model = MockModel::new();
            let handler = Service::starter(events_tx, software)
                .with_model(Box::new(model.clone()))
                .start()
                .await
                .unwrap();

            Context {
                handler,
                _events_rx,
                model,
            }
        }
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_get_config_empty(ctx: &mut Context) {
        let config = ctx.handler.call(message::GetConfig).await.unwrap();
        assert!(config.is_none());
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_set_and_get_config(ctx: &mut Context) {
        let test_config = Config {
            sources: vec![Source {
                source_type: SourceType::Pool,
                address: "ntp.example.com".to_string(),
                iburst: true,
                offline: false,
            }],
        };

        ctx.handler
            .call(message::SetConfig::new(Some(test_config.clone())))
            .await
            .unwrap();

        assert!(*ctx.model.write_config_called.lock().unwrap());

        let retrieved = ctx.handler.call(message::GetConfig).await.unwrap();
        assert_eq!(retrieved.unwrap(), test_config);
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_finish(ctx: &mut Context) {
        let test_config = Config {
            sources: vec![Source {
                source_type: SourceType::Server,
                address: "ntp.server.com".to_string(),
                iburst: false,
                offline: true,
            }],
        };

        ctx.handler
            .call(message::SetConfig::new(Some(test_config)))
            .await
            .unwrap();

        ctx.handler.call(message::Finish).await.unwrap();

        assert!(*ctx.model.install_called.lock().unwrap());
    }
}
