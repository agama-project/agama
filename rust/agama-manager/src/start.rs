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

use crate::l10n;
use crate::service::Service;
use agama_utils::actor::{self, Handler};
use agama_utils::api::event;
use agama_utils::progress;
use agama_utils::{issue, question};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Progress(#[from] progress::start::Error),
    #[error(transparent)]
    L10n(#[from] l10n::start::Error),
    #[error(transparent)]
    Issues(#[from] issue::start::Error),
}

/// Starts the manager service.
///
/// It starts two Tokio tasks:
///
/// * The main service, called "Manager", which coordinates the rest of services
///   an entry point for the HTTP API.
/// * An events listener which retransmit the events from all the services.
///
/// It receives the following argument:
///
/// * `events`: channel to emit the [events](agama_utils::Event).
/// * `dbus`: connection to Agama's D-Bus server. If it is not given, those features
///           that require to connect to the Agama's D-Bus server won't work.
pub async fn start(
    questions: Handler<question::Service>,
    events: event::Sender,
    dbus: Option<zbus::Connection>,
) -> Result<Handler<Service>, Error> {
    let issues = issue::start(events.clone(), dbus).await?;
    let progress = progress::start(events.clone()).await?;
    let l10n = l10n::start(issues.clone(), events.clone()).await?;

    let service = Service::new(l10n, issues, progress, questions, events.clone());
    let handler = actor::spawn(service);
    Ok(handler)
}

#[cfg(test)]
mod test {
    use crate as manager;
    use crate::message;
    use crate::service::Service;
    use agama_utils::actor::Handler;
    use agama_utils::api::l10n;
    use agama_utils::api::{Config, Event};
    use agama_utils::question;
    use tokio::sync::broadcast;

    async fn start_service() -> Handler<Service> {
        let (events_sender, mut events_receiver) = broadcast::channel::<Event>(16);

        tokio::spawn(async move {
            while let Ok(event) = events_receiver.recv().await {
                println!("{:?}", event);
            }
        });

        let questions = question::start(events_sender.clone()).await.unwrap();
        manager::start(questions, events_sender, None)
            .await
            .unwrap()
    }

    #[tokio::test]
    #[cfg(not(ci))]
    async fn test_update_config() -> Result<(), Box<dyn std::error::Error>> {
        let handler = start_service().await;

        let input_config = Config {
            l10n: Some(l10n::Config {
                locale: Some("es_ES.UTF-8".to_string()),
                keymap: Some("es".to_string()),
                timezone: Some("Atlantic/Canary".to_string()),
            }),
            ..Default::default()
        };

        handler
            .call(message::SetConfig::new(input_config.clone()))
            .await?;

        let config = handler.call(message::GetConfig).await?;

        assert_eq!(input_config.l10n.unwrap(), config.l10n.unwrap());

        Ok(())
    }

    #[tokio::test]
    #[cfg(not(ci))]
    async fn test_patch_config() -> Result<(), Box<dyn std::error::Error>> {
        let handler = start_service().await;

        // Ensure the keymap is different to the system one.
        let config = handler.call(message::GetExtendedConfig).await?;
        let keymap = if config.l10n.unwrap().keymap.unwrap() == "es" {
            "en"
        } else {
            "es"
        };

        let input_config = Config {
            l10n: Some(l10n::Config {
                keymap: Some(keymap.to_string()),
                ..Default::default()
            }),
            ..Default::default()
        };

        handler
            .call(message::UpdateConfig::new(input_config.clone()))
            .await?;

        let config = handler.call(message::GetConfig).await?;

        assert_eq!(input_config.l10n.unwrap(), config.l10n.unwrap());

        let extended_config = handler.call(message::GetExtendedConfig).await?;
        let l10n_config = extended_config.l10n.unwrap();

        assert!(l10n_config.locale.is_some());
        assert!(l10n_config.keymap.is_some());
        assert!(l10n_config.timezone.is_some());

        Ok(())
    }
}
