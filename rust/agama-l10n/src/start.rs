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

use crate::model::Model;
use crate::monitor::{self, Monitor};
use crate::service::{self, Service};
use agama_utils::{
    actor::{self, Handler},
    api::event,
    issue,
};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Service(#[from] service::Error),
}

/// Starts the localization service.
///
/// It starts two Tokio tasks:
///
/// - The main service, which is reponsible for holding and applying the configuration.
/// - A monitor which checks for changes in the underlying system (e.g., changing the keymap)
///   and signals the main service accordingly.
/// - It depends on the issues service to keep the installation issues.
///
/// * `events`: channel to emit the [localization-specific events](crate::Event).
/// * `issues`: handler to the issues service.
pub async fn start(
    issues: Handler<issue::Service>,
    events: event::Sender,
) -> Result<Handler<Service>, Error> {
    let model = Model::from_system()?;
    let service = Service::new(model, issues, events);
    let handler = actor::spawn(service);

    match Monitor::new(handler.clone()).await {
        Ok(monitor) => monitor::spawn(monitor),
        Err(error) => {
            tracing::error!(
                "Could not launch the l10n monitor, therefore changes from systemd will be ignored. \
                 The original error was {error}"
            );
        }
    }

    Ok(handler)
}

#[cfg(test)]
mod tests {
    use crate::message;
    use crate::model::{KeymapsDatabase, LocalesDatabase, ModelAdapter, TimezonesDatabase};
    use crate::service::{self, Service};
    use agama_locale_data::{KeymapId, LocaleId};
    use agama_utils::{
        actor::{self, Handler},
        api::{
            self,
            event::{self, Event},
            l10n::{Keymap, LocaleEntry, TimezoneEntry},
            scope::Scope,
        },
        issue, test,
    };
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

    async fn start_testing_service() -> (event::Receiver, Handler<Service>, Handler<issue::Service>)
    {
        let (events_tx, events_rx) = broadcast::channel::<Event>(16);
        let dbus = test::dbus::connection().await.unwrap();
        let issues = issue::start(events_tx.clone(), dbus).await.unwrap();

        let model = build_adapter();
        let service = Service::new(model, issues.clone(), events_tx);

        let handler = actor::spawn(service);
        (events_rx, handler, issues)
    }

    #[tokio::test]
    async fn test_get_and_set_config() -> Result<(), Box<dyn std::error::Error>> {
        let (mut events_rx, handler, _issues) = start_testing_service().await;

        let config = handler.call(message::GetConfig).await.unwrap();
        assert_eq!(config.locale, Some("en_US.UTF-8".to_string()));

        let input_config = api::l10n::Config {
            locale: Some("es_ES.UTF-8".to_string()),
            keymap: Some("es".to_string()),
            timezone: Some("Atlantic/Canary".to_string()),
        };
        handler
            .call(message::SetConfig::new(input_config.clone()))
            .await?;

        let updated = handler.call(message::GetConfig).await?;
        assert_eq!(&updated, &input_config);

        let proposal = handler.call(message::GetProposal).await?;
        assert!(proposal.is_some());

        let event = events_rx.recv().await.expect("Did not receive the event");
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
        handler
            .call(message::SetConfig::new(input_config.clone()))
            .await?;

        let updated = handler.call(message::GetConfig).await?;
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

    #[tokio::test]
    async fn test_set_invalid_config() -> Result<(), Box<dyn std::error::Error>> {
        let (_events_rx, handler, _issues) = start_testing_service().await;

        let input_config = api::l10n::Config {
            locale: Some("es-ES.UTF-8".to_string()),
            ..Default::default()
        };

        let result = handler
            .call(message::SetConfig::new(input_config.clone()))
            .await;
        assert!(matches!(result, Err(service::Error::InvalidLocale(_))));
        Ok(())
    }

    #[tokio::test]
    async fn test_set_config_without_changes() -> Result<(), Box<dyn std::error::Error>> {
        let (mut events_rx, handler, _issues) = start_testing_service().await;

        let config = handler.call(message::GetConfig).await?;
        assert_eq!(config.locale, Some("en_US.UTF-8".to_string()));
        let message = message::SetConfig::new(config.clone());
        handler.call(message).await?;
        // Wait until the action is dispatched.
        let _ = handler.call(message::GetConfig).await?;

        let event = events_rx.try_recv();
        assert!(matches!(event, Err(broadcast::error::TryRecvError::Empty)));
        Ok(())
    }

    #[tokio::test]
    async fn test_set_config_unknown_values() -> Result<(), Box<dyn std::error::Error>> {
        let (mut _events_rx, handler, issues) = start_testing_service().await;

        let config = api::l10n::Config {
            keymap: Some("jk".to_string()),
            locale: Some("xx_XX.UTF-8".to_string()),
            timezone: Some("Unknown/Unknown".to_string()),
        };
        let _ = handler.call(message::SetConfig::new(config)).await?;

        let found_issues = issues.call(issue::message::Get).await?;
        let l10n_issues = found_issues.get(&Scope::L10n).unwrap();
        assert_eq!(l10n_issues.len(), 3);

        let proposal = handler.call(message::GetProposal).await?;
        assert!(proposal.is_none());
        Ok(())
    }

    #[tokio::test]
    async fn test_get_system() -> Result<(), Box<dyn std::error::Error>> {
        let (_events_rx, handler, _issues) = start_testing_service().await;

        let system = handler.call(message::GetSystem).await?;
        assert_eq!(system.keymaps.len(), 2);

        Ok(())
    }

    #[tokio::test]
    async fn test_get_proposal() -> Result<(), Box<dyn std::error::Error>> {
        let (_events_rx, handler, _issues) = start_testing_service().await;

        let input_config = api::l10n::Config {
            locale: Some("es_ES.UTF-8".to_string()),
            keymap: Some("es".to_string()),
            timezone: Some("Atlantic/Canary".to_string()),
        };
        let message = message::SetConfig::new(input_config.clone());
        handler.call(message).await?;

        let proposal = handler
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
