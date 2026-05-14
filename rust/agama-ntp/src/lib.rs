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
    use std::{
        path::Path,
        sync::{Arc, Mutex},
    };
    use test_context::{test_context, AsyncTestContext};
    use tokio::sync::broadcast;

    use crate::{message, model, Service};

    /// Helper function to setup dracut NTP sources file.
    ///
    /// # Arguments
    ///
    /// * `path` - the workdir path
    /// * `content` - The content to write to the file
    fn setup_dracut_sources(path: &Path, content: &str) {
        let dracut_sources_path = path.join("run/chrony/dracut.sources.d/dracut.sources");

        if let Some(parent) = dracut_sources_path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(dracut_sources_path, content).unwrap();
    }

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
                .unwrap();

            Context {
                handler,
                _events_rx,
                model,
            }
        }
    }

    struct DracutContext {
        handler: Handler<Service>,
        _events_rx: event::Receiver,
        _tempdir: tempfile::TempDir,
    }

    impl AsyncTestContext for DracutContext {
        async fn setup() -> DracutContext {
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

            // Set up tempdir with dracut sources
            let tempdir = tempfile::tempdir().unwrap();

            let dracut_content = r#"# Dracut NTP sources
pool 0.opensuse.pool.ntp.org iburst
server ntp.example.com offline
"#;
            setup_dracut_sources(tempdir.path(), dracut_content);

            // Create service with real chrony model
            let model = Box::new(model::chrony::Model::new().with_workdir(tempdir.path()));
            let handler = Service::starter(events_tx, software)
                .with_model(model)
                .start()
                .unwrap();

            DracutContext {
                handler,
                _events_rx,
                _tempdir: tempdir,
            }
        }
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_get_config_empty(ctx: &mut Context) {
        let config = ctx.handler.call(message::GetConfig).await.unwrap();
        assert!(config.is_some());
        assert!(config.unwrap().is_empty());
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_set_and_get_config(ctx: &mut Context) {
        let test_config = Config {
            sources: Some(vec![Source {
                source_type: SourceType::Pool,
                address: "ntp.example.com".to_string(),
                iburst: true,
                offline: false,
            }]),
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
            sources: Some(vec![Source {
                source_type: SourceType::Server,
                address: "ntp.server.com".to_string(),
                iburst: false,
                offline: true,
            }]),
        };

        ctx.handler
            .call(message::SetConfig::new(Some(test_config)))
            .await
            .unwrap();

        ctx.handler.call(message::Finish).await.unwrap();

        assert!(*ctx.model.install_called.lock().unwrap());
    }

    #[test_context(DracutContext)]
    #[tokio::test]
    async fn test_get_config_with_dracut_sources(ctx: &mut DracutContext) {
        // Get the configuration - should include dracut sources
        let config = ctx.handler.call(message::GetConfig).await.unwrap().unwrap();

        // Verify the dracut sources are present
        let sources = config.sources.as_ref().unwrap();
        assert_eq!(sources.len(), 2);

        assert_eq!(sources[0].source_type, SourceType::Pool);
        assert_eq!(sources[0].address, "0.opensuse.pool.ntp.org");
        assert_eq!(sources[0].iburst, true);
        assert_eq!(sources[0].offline, false);

        assert_eq!(sources[1].source_type, SourceType::Server);
        assert_eq!(sources[1].address, "ntp.example.com");
        assert_eq!(sources[1].iburst, false);
        assert_eq!(sources[1].offline, true);
    }

    #[tokio::test]
    async fn test_set_config_override_and_reset_to_dracut() {
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

        // Set up dracut sources file with original servers
        let tempdir = tempfile::tempdir().unwrap();

        let dracut_content = r#"# Dracut NTP sources
pool 0.opensuse.pool.ntp.org iburst
server time.example.com
"#;
        setup_dracut_sources(tempdir.path(), dracut_content);

        // Create service with real chrony model
        let model = Box::new(model::chrony::Model::new().with_workdir(tempdir.path()));
        let handler = Service::starter(events_tx, software)
            .with_model(model)
            .start()
            .unwrap();

        // Step 1: Verify initial state has dracut sources
        let initial_config = handler.call(message::GetConfig).await.unwrap().unwrap();
        assert_eq!(initial_config.sources.as_ref().unwrap().len(), 2);
        assert_eq!(
            initial_config.sources.as_ref().unwrap()[0].address,
            "0.opensuse.pool.ntp.org"
        );

        // Step 2: SetConfig with custom servers
        let custom_config = Config {
            sources: Some(vec![
                Source {
                    source_type: SourceType::Server,
                    address: "custom1.ntp.org".to_string(),
                    iburst: true,
                    offline: false,
                },
                Source {
                    source_type: SourceType::Server,
                    address: "custom2.ntp.org".to_string(),
                    iburst: false,
                    offline: true,
                },
            ]),
        };

        handler
            .call(message::SetConfig::new(Some(custom_config.clone())))
            .await
            .unwrap();

        // Step 3: GetConfig should return custom servers (not dracut)
        let config_after_set = handler.call(message::GetConfig).await.unwrap().unwrap();
        let sources_after_set = config_after_set.sources.as_ref().unwrap();
        assert_eq!(sources_after_set.len(), 2);
        assert_eq!(sources_after_set[0].address, "custom1.ntp.org");
        assert_eq!(sources_after_set[0].iburst, true);
        assert_eq!(sources_after_set[1].address, "custom2.ntp.org");
        assert_eq!(sources_after_set[1].offline, true);

        // Step 4: SetConfig with None to reset to defaults
        handler.call(message::SetConfig::new(None)).await.unwrap();

        // Step 5: GetConfig should return original dracut servers
        let config_after_reset = handler.call(message::GetConfig).await.unwrap().unwrap();
        let sources_after_reset = config_after_reset.sources.as_ref().unwrap();
        assert_eq!(sources_after_reset.len(), 2);
        assert_eq!(sources_after_reset[0].address, "0.opensuse.pool.ntp.org");
        assert_eq!(sources_after_reset[0].source_type, SourceType::Pool);
        assert_eq!(sources_after_reset[0].iburst, true);
        assert_eq!(sources_after_reset[1].address, "time.example.com");
        assert_eq!(sources_after_reset[1].source_type, SourceType::Server);
        assert_eq!(sources_after_reset[1].iburst, false);
    }
}
