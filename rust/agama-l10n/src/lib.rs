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

//! This crate implements the support for localization handling in Agama.
//! It takes care of setting the locale, keymap and timezone for Agama itself
//! and the target system.
//!
//! From a technical point of view, it includes:
//!
//! * The [UserConfig] struct that defines the settings the user can
//!   alter for the target system.
//! * The [Proposal] struct that describes how the system will look like after
//!   the installation.
//! * The [SystemInfo] which includes information about the system
//!   where Agama is running.
//! * An [specific event type](Event) for localization-related events.
//!
//! The service can be started by calling the [start_service] function, which
//! returns a [agama_utils::actors::ActorHandler] to interact with the system.

pub mod service;
pub use service::{Builder, Service};

mod model;
pub use model::{Model, ModelAdapter};

mod config;
mod dbus;
pub mod helpers;
pub mod message;
mod monitor;

#[cfg(test)]
mod tests {
    use crate::{
        message,
        model::{KeymapsDatabase, LocalesDatabase, ModelAdapter, TimezonesDatabase},
        service::{self, Service},
    };
    use agama_locale_data::{KeymapId, LocaleId};
    use agama_utils::{
        actor::Handler,
        api::{
            self,
            event::Event,
            l10n::{Keymap, LocaleEntry, TimezoneEntry},
            scope::Scope,
        },
        issue, test,
    };
    use test_context::{test_context, AsyncTestContext};
    use tokio::sync::broadcast;

    pub struct TestModel {
        pub locales: LocalesDatabase,
        pub keymaps: KeymapsDatabase,
        pub timezones: TimezonesDatabase,
    }

    impl ModelAdapter for TestModel {
        fn locales_db(&self) -> &LocalesDatabase {
            &self.locales
        }

        fn keymaps_db(&self) -> &KeymapsDatabase {
            &self.keymaps
        }

        fn timezones_db(&self) -> &TimezonesDatabase {
            &self.timezones
        }

        fn locale(&self) -> LocaleId {
            LocaleId::default()
        }

        fn keymap(&self) -> Result<KeymapId, service::Error> {
            Ok(KeymapId::default())
        }
    }

    fn build_adapter() -> TestModel {
        TestModel {
            locales: LocalesDatabase::with_entries(&[
                LocaleEntry {
                    id: "en_US.UTF-8".parse().unwrap(),
                    language: "English".to_string(),
                    territory: "United States".to_string(),
                    consolefont: None,
                },
                LocaleEntry {
                    id: "es_ES.UTF-8".parse().unwrap(),
                    language: "Spanish".to_string(),
                    territory: "Spain".to_string(),
                    consolefont: None,
                },
            ]),
            keymaps: KeymapsDatabase::with_entries(&[
                Keymap::new("us".parse().unwrap(), "English"),
                Keymap::new("es".parse().unwrap(), "Spanish"),
            ]),
            timezones: TimezonesDatabase::with_entries(&[
                TimezoneEntry {
                    id: "Europe/Berlin".parse().unwrap(),
                    parts: vec!["Europe".to_string(), "Berlin".to_string()],
                    country: Some("Germany".to_string()),
                },
                TimezoneEntry {
                    id: "Atlantic/Canary".parse().unwrap(),
                    parts: vec!["Atlantic".to_string(), "Canary".to_string()],
                    country: Some("Spain".to_string()),
                },
            ]),
        }
    }

    struct Context {
        events_rx: broadcast::Receiver<Event>,
        handler: Handler<Service>,
        issues: Handler<issue::Service>,
    }

    impl AsyncTestContext for Context {
        async fn setup() -> Context {
            let (events_tx, events_rx) = broadcast::channel::<Event>(16);
            let dbus = test::dbus::connection().await.unwrap();
            let issues = issue::start(events_tx.clone(), dbus).await.unwrap();

            let model = build_adapter();
            let handler = Service::builder(events_tx, issues.clone())
                .with_model(model)
                .spawn()
                .await
                .expect("Could not start the l10n service");

            Self {
                events_rx,
                handler,
                issues,
            }
        }
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_get_and_set_config(ctx: &mut Context) -> Result<(), Box<dyn std::error::Error>> {
        let config = ctx.handler.call(message::GetConfig).await.unwrap();
        assert_eq!(config.locale, Some("en_US.UTF-8".to_string()));

        let input_config = api::l10n::Config {
            locale: Some("es_ES.UTF-8".to_string()),
            keymap: Some("es".to_string()),
            timezone: Some("Atlantic/Canary".to_string()),
        };
        ctx.handler
            .call(message::SetConfig::with(input_config.clone()))
            .await?;

        let updated = ctx.handler.call(message::GetConfig).await?;
        assert_eq!(&updated, &input_config);

        let proposal = ctx.handler.call(message::GetProposal).await?;
        assert!(proposal.is_some());

        let event = ctx
            .events_rx
            .recv()
            .await
            .expect("Did not receive the event");
        assert!(matches!(
            event,
            Event::ProposalChanged { scope: Scope::L10n }
        ));

        let input_config = api::l10n::Config {
            locale: None,
            keymap: Some("es".to_string()),
            timezone: None,
        };

        // Use system info for missing values.
        ctx.handler
            .call(message::SetConfig::with(input_config.clone()))
            .await?;

        let updated = ctx.handler.call(message::GetConfig).await?;
        assert_eq!(
            updated,
            api::l10n::Config {
                locale: Some("en_US.UTF-8".to_string()),
                keymap: Some("es".to_string()),
                timezone: Some("Europe/Berlin".to_string()),
            }
        );

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_reset_config(ctx: &mut Context) -> Result<(), Box<dyn std::error::Error>> {
        ctx.handler.call(message::SetConfig::new(None)).await?;

        let config = ctx.handler.call(message::GetConfig).await?;
        assert_eq!(
            config,
            api::l10n::Config {
                locale: Some("en_US.UTF-8".to_string()),
                keymap: Some("us".to_string()),
                timezone: Some("Europe/Berlin".to_string()),
            }
        );

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_set_invalid_config(ctx: &mut Context) -> Result<(), Box<dyn std::error::Error>> {
        let input_config = api::l10n::Config {
            locale: Some("es-ES.UTF-8".to_string()),
            ..Default::default()
        };

        let result = ctx
            .handler
            .call(message::SetConfig::with(input_config.clone()))
            .await;
        assert!(matches!(result, Err(service::Error::InvalidLocale(_))));
        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_set_config_without_changes(
        ctx: &mut Context,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let config = ctx.handler.call(message::GetConfig).await?;
        assert_eq!(config.locale, Some("en_US.UTF-8".to_string()));
        let message = message::SetConfig::with(config.clone());
        ctx.handler.call(message).await?;
        // Wait until the action is dispatched.
        let _ = ctx.handler.call(message::GetConfig).await?;

        let event = ctx.events_rx.try_recv();
        assert!(matches!(event, Err(broadcast::error::TryRecvError::Empty)));
        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_set_config_unknown_values(
        ctx: &mut Context,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let config = api::l10n::Config {
            keymap: Some("jk".to_string()),
            locale: Some("xx_XX.UTF-8".to_string()),
            timezone: Some("Unknown/Unknown".to_string()),
        };
        let _ = ctx.handler.call(message::SetConfig::with(config)).await?;

        let found_issues = ctx.issues.call(issue::message::Get).await?;
        let l10n_issues = found_issues.get(&Scope::L10n).unwrap();
        assert_eq!(l10n_issues.len(), 3);

        let proposal = ctx.handler.call(message::GetProposal).await?;
        assert!(proposal.is_none());
        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_get_system(ctx: &mut Context) -> Result<(), Box<dyn std::error::Error>> {
        let system = ctx.handler.call(message::GetSystem).await?;
        assert_eq!(system.keymaps.len(), 2);

        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_get_proposal(ctx: &mut Context) -> Result<(), Box<dyn std::error::Error>> {
        let input_config = api::l10n::Config {
            locale: Some("es_ES.UTF-8".to_string()),
            keymap: Some("es".to_string()),
            timezone: Some("Atlantic/Canary".to_string()),
        };
        let message = message::SetConfig::with(input_config.clone());
        ctx.handler.call(message).await?;

        let proposal = ctx
            .handler
            .call(message::GetProposal)
            .await?
            .expect("Could not get the proposal");
        assert_eq!(proposal.locale.to_string(), input_config.locale.unwrap());
        assert_eq!(proposal.keymap.to_string(), input_config.keymap.unwrap());
        assert_eq!(
            proposal.timezone.to_string(),
            input_config.timezone.unwrap()
        );
        Ok(())
    }
}
