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
    l10n,
    listener::{self, EventsListener},
    service::Service,
};
use agama_lib::http;
use agama_utils::{
    actor::{self, Handler},
    issue, progress,
};
use tokio::sync::mpsc;

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
/// * `events`: channel to emit the [events](agama_lib::http::Event).
/// * `dbus`: connection to Agama's D-Bus server. If it is not given, those features
///           that require to connect to the Agama's D-Bus server won't work.
pub async fn start(
    events: http::event::Sender,
    dbus: Option<zbus::Connection>,
) -> Result<Handler<Service>, Error> {
    let mut listener = EventsListener::new(events);

    let (events_sender, events_receiver) = mpsc::unbounded_channel::<issue::Event>();
    let issues = issue::start(events_sender, dbus).await?;
    listener.add_channel("issues", events_receiver);

    let (events_sender, events_receiver) = mpsc::unbounded_channel::<progress::Event>();
    let progress = progress::start(events_sender).await?;
    listener.add_channel("progress", events_receiver);

    let (events_sender, events_receiver) = mpsc::unbounded_channel::<l10n::Event>();
    let l10n = l10n::start(issues.clone(), events_sender).await?;
    listener.add_channel("l10n", events_receiver);

    let service = Service::new(l10n, issues, progress);
    let handler = actor::spawn(service);

    listener::spawn(listener);

    Ok(handler)
}

#[cfg(test)]
mod test {
    use crate::{self as manager, l10n, message, service::Service};
    use agama_lib::{http, install_settings::InstallSettings};
    use agama_utils::actor::Handler;
    use tokio::sync::broadcast;

    async fn start_service() -> Handler<Service> {
        let (events_sender, _events_receiver) = broadcast::channel::<http::Event>(16);
        manager::start(events_sender, None).await.unwrap()
    }

    #[tokio::test]
    #[cfg(not(ci))]
    async fn test_update_config() -> Result<(), Box<dyn std::error::Error>> {
        let handler = start_service().await;

        let input_config = InstallSettings {
            localization: Some(l10n::Config {
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

        assert_eq!(
            input_config.localization.unwrap(),
            config.localization.unwrap()
        );

        Ok(())
    }

    #[tokio::test]
    #[cfg(not(ci))]
    async fn test_patch_config() -> Result<(), Box<dyn std::error::Error>> {
        let handler = start_service().await;

        let input_config = InstallSettings {
            localization: Some(l10n::Config {
                keymap: Some("es".to_string()),
                ..Default::default()
            }),
            ..Default::default()
        };

        handler
            .call(message::UpdateConfig::new(input_config.clone()))
            .await?;

        let config = handler.call(message::GetConfig).await?;

        assert_eq!(
            input_config.localization.unwrap(),
            config.localization.unwrap()
        );

        let extended_config = handler.call(message::GetExtendedConfig).await?;
        let l10n_config = extended_config.localization.unwrap();

        assert!(l10n_config.locale.is_some());
        assert!(l10n_config.keymap.is_some());
        assert!(l10n_config.timezone.is_some());

        Ok(())
    }
}
