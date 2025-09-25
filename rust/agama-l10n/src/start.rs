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

use crate::{
    event,
    handler::Handler,
    model::Model,
    monitor::{self, Monitor},
    service::{self, Service},
};
use agama_utils::Service as _;
use tokio::sync::mpsc;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("L10n service error")]
    Service(#[from] service::Error),
    #[error("L10n monitor error")]
    Monitor(#[from] monitor::Error),
}

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
/// let config = service.get_config().await.unwrap();
/// # })
/// ```
///
/// * `events`: channel to emit the [localization-specific events](crate::Event).
pub async fn start(events: event::Sender) -> Result<Handler, Error> {
    let (sender, receiver) = mpsc::unbounded_channel();
    let model = Model::from_system()?;
    let mut service = Service::new(model, receiver, events);
    tokio::spawn(async move {
        service.run().await;
    });
    let mut monitor = Monitor::new(sender.clone()).await?;
    tokio::spawn(async move {
        monitor.run().await;
    });

    Ok(Handler::new(sender))
}

#[cfg(test)]
mod tests {
    use crate::{
        event::Event,
        event::Receiver,
        handler::Handler,
        model::{
            Keymap, KeymapsDatabase, LocaleEntry, LocalesDatabase, ModelAdapter, TimezoneEntry,
            TimezonesDatabase,
        },
        service::{self, Service},
        user_config::UserConfig,
    };
    use agama_locale_data::{KeymapId, LocaleId};
    use agama_utils::Service as _;
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

    async fn start_testing_service() -> Result<(Receiver, Handler), Box<dyn std::error::Error>> {
        let (events_tx, events_rx) = mpsc::unbounded_channel::<Event>();
        let (messages_tx, messages_rx) = mpsc::unbounded_channel();
        let model = build_adapter();
        let mut service = Service::new(model, messages_rx, events_tx);
        tokio::spawn(async move {
            service.run().await;
        });
        Ok((events_rx, Handler::new(messages_tx)))
    }

    #[tokio::test]
    async fn test_get_and_set_config() -> Result<(), Box<dyn std::error::Error>> {
        let (mut events_rx, handler) = start_testing_service()
            .await
            .expect("Could not start the testing service");

        let config = handler.get_config().await?;
        assert_eq!(config.language, Some("en_US.UTF-8".to_string()));

        let user_config = UserConfig {
            language: Some("es_ES.UTF-8".to_string()),
            keyboard: Some("es".to_string()),
            timezone: Some("Atlantic/Canary".to_string()),
        };
        handler.set_config(&user_config).await?;

        let updated = handler.get_config().await?;
        assert_eq!(&updated, &user_config);

        let event = events_rx.recv().await.expect("Did not receive the event");
        assert!(matches!(event, Event::ProposalChanged));
        Ok(())
    }

    #[tokio::test]
    async fn test_set_config_without_changes() -> Result<(), Box<dyn std::error::Error>> {
        let (mut events_rx, handler) = start_testing_service()
            .await
            .expect("Could not start the testing service");

        let config = handler.get_config().await?;
        assert_eq!(config.language, Some("en_US.UTF-8".to_string()));
        handler.set_config(&config).await?;
        // Wait until the action is dispatched.
        _ = handler.get_config().await?;

        let event = events_rx.try_recv();
        assert!(matches!(event, Err(mpsc::error::TryRecvError::Empty)));
        Ok(())
    }

    #[tokio::test]
    async fn test_get_system() -> Result<(), Box<dyn std::error::Error>> {
        let (_events_rx, handler) = start_testing_service()
            .await
            .expect("Could not start the testing service");

        let system = handler.get_system().await?;
        assert_eq!(system.keymaps.len(), 2);

        Ok(())
    }

    #[tokio::test]
    async fn test_get_proposal() -> Result<(), Box<dyn std::error::Error>> {
        let (_events_rx, handler) = start_testing_service()
            .await
            .expect("Could not start the testing service");

        let user_config = UserConfig {
            language: Some("es_ES.UTF-8".to_string()),
            keyboard: Some("es".to_string()),
            timezone: Some("Atlantic/Canary".to_string()),
        };
        handler.set_config(&user_config).await?;

        let proposal = handler.get_proposal().await?;
        assert_eq!(proposal.locale.to_string(), user_config.language.unwrap());
        assert_eq!(proposal.keymap.to_string(), user_config.keyboard.unwrap());
        assert_eq!(proposal.timezone.to_string(), user_config.timezone.unwrap());
        Ok(())
    }
}
