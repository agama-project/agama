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

pub mod service;
pub use service::Service;

pub mod message;

pub use agama_l10n as l10n;
pub use agama_network as network;
pub use agama_software as software;
pub use agama_storage as storage;

#[cfg(test)]
mod test {
    use crate::{
        message,
        service::{Error, Service},
    };
    use agama_l10n::test_utils::build_service as build_l10n_service;
    use agama_network::test_utils::build_service as build_network_service;
    use agama_storage::test_utils::build_service as build_storage_service;
    use agama_utils::{
        actor::Handler,
        api::{
            l10n,
            software::{self, ProductConfig},
            Config, Event,
        },
        issue, progress, question, test,
    };
    use std::path::PathBuf;
    use test_context::{test_context, AsyncTestContext};
    use tokio::sync::broadcast;

    async fn select_product(handler: &Handler<Service>) -> Result<(), Error> {
        let software = software::Config {
            product: Some(ProductConfig {
                id: Some("SLES".to_string()),
                ..Default::default()
            }),
            ..Default::default()
        };

        let input_config = Config {
            software: Some(software),
            ..Default::default()
        };

        handler
            .call(message::SetConfig::new(input_config.clone()))
            .await?;
        Ok(())
    }

    struct Context {
        handler: Handler<Service>,
    }

    impl AsyncTestContext for Context {
        async fn setup() -> Context {
            let share_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share");
            std::env::set_var("AGAMA_SHARE_DIR", share_dir.display().to_string());

            let (events_sender, mut events_receiver) = broadcast::channel::<Event>(16);
            let dbus = test::dbus::connection().await.unwrap();

            tokio::spawn(async move {
                while let Ok(event) = events_receiver.recv().await {
                    println!("{:?}", event);
                }
            });

            let issues = issue::start(events_sender.clone(), dbus.clone())
                .await
                .unwrap();
            let questions = question::start(events_sender.clone()).await.unwrap();
            let progress = progress::Service::builder(events_sender.clone()).build();

            let handler = Service::builder(questions, events_sender.clone(), dbus.clone())
                .with_l10n(build_l10n_service(events_sender.clone(), issues.clone()).await)
                .with_storage(build_storage_service(events_sender, issues, progress, dbus).await)
                .with_network(build_network_service().await)
                .spawn()
                .await
                .unwrap();

            Context { handler }
        }
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_update_config(ctx: &mut Context) -> Result<(), Error> {
        let software = software::Config {
            product: Some(ProductConfig {
                id: Some("SLES".to_string()),
                ..Default::default()
            }),
            ..Default::default()
        };

        let input_config = Config {
            software: Some(software),
            l10n: Some(l10n::Config {
                locale: Some("es_ES.UTF-8".to_string()),
                keymap: Some("es".to_string()),
                timezone: Some("Atlantic/Canary".to_string()),
            }),
            ..Default::default()
        };

        ctx.handler
            .call(message::SetConfig::new(input_config.clone()))
            .await?;

        let config = ctx.handler.call(message::GetConfig).await?;
        assert_eq!(input_config.l10n.unwrap(), config.l10n.unwrap());

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_update_config_without_product(ctx: &mut Context) {
        let input_config = Config {
            l10n: Some(l10n::Config {
                locale: Some("es_ES.UTF-8".to_string()),
                keymap: Some("es".to_string()),
                timezone: Some("Atlantic/Canary".to_string()),
            }),
            ..Default::default()
        };

        let error = ctx
            .handler
            .call(message::SetConfig::new(input_config.clone()))
            .await;
        assert!(matches!(error, Err(crate::service::Error::MissingProduct)));
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_patch_config(ctx: &mut Context) -> Result<(), Error> {
        select_product(&ctx.handler).await?;

        let input_config = Config {
            l10n: Some(l10n::Config {
                keymap: Some("es".to_string()),
                ..Default::default()
            }),
            ..Default::default()
        };

        ctx.handler
            .call(message::UpdateConfig::new(input_config.clone()))
            .await?;

        let config = ctx.handler.call(message::GetConfig).await?;

        assert_eq!(input_config.l10n.unwrap(), config.l10n.unwrap());

        let extended_config = ctx.handler.call(message::GetExtendedConfig).await?;
        let l10n_config = extended_config.l10n.unwrap();

        assert!(l10n_config.locale.is_some());
        assert!(l10n_config.keymap.is_some());
        assert!(l10n_config.timezone.is_some());

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_patch_config_without_product(ctx: &mut Context) -> Result<(), Error> {
        let input_config = Config {
            l10n: Some(l10n::Config {
                keymap: Some("es".to_string()),
                ..Default::default()
            }),
            ..Default::default()
        };

        let result = ctx
            .handler
            .call(message::UpdateConfig::new(input_config.clone()))
            .await;
        assert!(matches!(result, Err(crate::service::Error::MissingProduct)));

        let extended_config = ctx.handler.call(message::GetExtendedConfig).await?;
        let l10n_config = extended_config.l10n.unwrap();
        assert_eq!(l10n_config.keymap, Some("us".to_string()));

        Ok(())
    }
}
