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
//! alter for the target system.
//! * The [Proposal] struct that describes how the system will look like after
//! the installation.
//! * The [SystemInfo] which includes information about the system
//! where Agama is running.
//! * An [specific event type](Event) for localization-related events.
//!
//! The service can be started by calling the [start_service] function, which
//! returns a [Handler] to interact with the system.

pub mod messages;

mod error;
pub use error::Error;

pub mod handler;

mod service;
use monitor::Monitor;
pub use service::SystemConfig;

mod system_info;
pub use system_info::SystemInfo;

mod user_config;
pub use user_config::UserConfig;

mod proposal;
pub use proposal::Proposal;

pub mod event;
pub use event::Event;

pub mod helpers;

mod config;
mod dbus;
mod model;
mod monitor;

use agama_utils::actors::ActorHandle;
use model::Model;
use service::Service;

/// Starts the localization service.
///
/// It starts two Tokio tasks:
///
/// - The main service, which is reponsible for holding and applying the configuration.
/// - A monitor which checks for changes in the underlying system (e.g., changing the keymap)
///   and signals the main service accordingly.
///
/// ## Example
///
/// ```no_run
/// # use tokio_test;
/// # use tokio::sync::mpsc;
/// use agama_l10n as l10n;
/// # tokio_test::block_on(async {
///
/// let (events_sender, events_receiver) = mpsc::unbounded_channel::<l10n::Event>();
/// let service = l10n::start_service(events_sender).await.unwrap();
/// // let config = service.get_config().await.unwrap();
/// # })
/// ```
///
/// * `events`: channel to emit the [localization-specific events](crate::Event).
pub async fn start_service(events: event::Sender) -> Result<ActorHandle<Service<Model>>, Error> {
    let model = Model::from_system()?;
    let service = Service::new(model, events);
    let handler = agama_utils::actors::spawn_actor(service);

    let mut monitor = Monitor::new(handler.clone()).await?;
    tokio::spawn(async move {
        monitor.run().await;
    });

    Ok(handler)
}

#[cfg(test)]
mod tests {
    use crate::{
        event::Receiver,
        messages,
        model::{
            Keymap, KeymapsDatabase, LocaleEntry, LocalesDatabase, ModelAdapter, TimezoneEntry,
            TimezonesDatabase,
        },
        service, Event, Service, UserConfig,
    };
    use agama_locale_data::{KeymapId, LocaleId};
    use agama_utils::actors::{spawn_actor, ActorHandle};
    use tokio::sync::mpsc;

    pub struct TestModel {
        pub locales: LocalesDatabase,
        pub keymaps: KeymapsDatabase,
        pub timezones: TimezonesDatabase,
    }

    impl ModelAdapter for TestModel {
        fn locales_db(&mut self) -> &mut LocalesDatabase {
            &mut self.locales
        }

        fn keymaps_db(&mut self) -> &mut KeymapsDatabase {
            &mut self.keymaps
        }

        fn timezones_db(&mut self) -> &mut TimezonesDatabase {
            &mut self.timezones
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
                    code: "Europe/Berlin".to_string(),
                    parts: vec!["Europe".to_string(), "Berlin".to_string()],
                    country: Some("Germany".to_string()),
                },
                TimezoneEntry {
                    code: "Atlantic/Canary".to_string(),
                    parts: vec!["Atlantic".to_string(), "Canary".to_string()],
                    country: Some("Spain".to_string()),
                },
            ]),
        }
    }

    fn start_testing_service(//) -> Result<(Receiver, Handler<TestModel>), Box<dyn std::error::Error>> {
    ) -> (Receiver, ActorHandle<Service<TestModel>>) {
        let (events_tx, events_rx) = mpsc::unbounded_channel::<Event>();
        let model = build_adapter();
        let service = Service::new(model, events_tx);

        let handler = spawn_actor(service);
        (events_rx, handler)
    }

    #[tokio::test]
    async fn test_get_and_set_config() -> Result<(), Box<dyn std::error::Error>> {
        let (mut events_rx, handler) = start_testing_service();

        let config = handler.call(messages::GetConfig {}).await.unwrap();
        assert_eq!(config.language, Some("en_US.UTF-8".to_string()));

        let user_config = UserConfig {
            language: Some("es_ES.UTF-8".to_string()),
            keyboard: Some("es".to_string()),
            timezone: Some("Atlantic/Canary".to_string()),
        };
        handler
            .call(messages::SetConfig::new(user_config.clone()))
            .await?;

        let updated = handler.call(messages::GetConfig {}).await?;
        assert_eq!(&updated, &user_config);

        let event = events_rx.recv().await.expect("Did not receive the event");
        assert!(matches!(event, Event::ProposalChanged));
        Ok(())
    }

    #[tokio::test]
    async fn test_set_invalid_config() -> Result<(), Box<dyn std::error::Error>> {
        let (_events_rx, handler) = start_testing_service();

        let user_config = UserConfig {
            language: Some("es-ES.UTF-8".to_string()),
            ..Default::default()
        };

        let result = handler
            .call(messages::SetConfig::new(user_config.clone()))
            .await;
        assert!(matches!(
            result,
            Err(crate::service::Error::InvalidLocale(_))
        ));
        Ok(())
    }

    #[tokio::test]
    async fn test_set_config_without_changes() -> Result<(), Box<dyn std::error::Error>> {
        let (mut events_rx, handler) = start_testing_service();

        // let config = handler.get_config().await?;
        let config = handler.call(messages::GetConfig {}).await?;
        assert_eq!(config.language, Some("en_US.UTF-8".to_string()));
        let message = messages::SetConfig::new(config.clone());
        handler.call(message).await?;
        // Wait until the action is dispatched.
        // _ = handler.get_config().await?;
        let _ = handler.call(messages::GetConfig {}).await?;

        let event = events_rx.try_recv();
        assert!(matches!(event, Err(mpsc::error::TryRecvError::Empty)));
        Ok(())
    }

    #[tokio::test]
    async fn test_get_system() -> Result<(), Box<dyn std::error::Error>> {
        let (_events_rx, handler) = start_testing_service();

        let system = handler.call(messages::GetSystem {}).await?;
        assert_eq!(system.keymaps.len(), 2);

        Ok(())
    }

    #[tokio::test]
    async fn test_get_proposal() -> Result<(), Box<dyn std::error::Error>> {
        let (_events_rx, handler) = start_testing_service();

        let user_config = UserConfig {
            language: Some("es_ES.UTF-8".to_string()),
            keyboard: Some("es".to_string()),
            timezone: Some("Atlantic/Canary".to_string()),
        };
        let message = messages::SetConfig::new(user_config.clone());
        handler.call(message).await?;

        let proposal = handler.call(messages::GetProposal {}).await?;
        assert_eq!(proposal.locale.to_string(), user_config.language.unwrap());
        assert_eq!(proposal.keymap.to_string(), user_config.keyboard.unwrap());
        assert_eq!(proposal.timezone.to_string(), user_config.timezone.unwrap());
        Ok(())
    }
}
