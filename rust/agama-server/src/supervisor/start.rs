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
    supervisor::{l10n, listener::EventsListener, service::Service},
    web::EventsSender,
};
use agama_utils::actor::{self, Handler};
use tokio::sync::mpsc;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Could not start the l10n service")]
    L10n(#[from] l10n::start::Error),
}

/// Starts the supervisor service.
///
/// It starts two Tokio tasks:
///
/// * The main service, called "Supervisor", which coordinates the rest of services
///   an entry point for the HTTP API.
/// * An events listener which retransmit the events from all the services.
///
/// It receives the following argument:
///
/// * `events`: channel to emit the [events](agama_lib::http::Event).
pub async fn start(events: EventsSender) -> Result<Handler<Service<l10n::Model>>, Error> {
    let mut listener = EventsListener::new(events);
    let (events_sender, events_receiver) = mpsc::unbounded_channel::<l10n::Event>();
    let l10n = l10n::start(events_sender).await?;
    listener.add_channel("l10n", events_receiver);
    tokio::spawn(async move {
        listener.run().await;
    });

    let service = Service::new(l10n);
    let handler = actor::spawn(service);
    Ok(handler)
}

#[cfg(test)]
mod test {
    use crate::supervisor::{self, l10n, message, service::Service};
    use agama_lib::{http::Event, install_settings::InstallSettings};
    use agama_utils::actor::Handler;
    use tokio::sync::broadcast;

    async fn start_service() -> Handler<Service<l10n::Model>> {
        let (events_tx, _events_rx) = broadcast::channel::<Event>(16);
        supervisor::start(events_tx).await.unwrap()
    }

    #[tokio::test]
    #[cfg(not(ci))]
    async fn test_update_config() -> Result<(), Box<dyn std::error::Error>> {
        let handler = start_service().await;

        let localization = l10n::UserConfig {
            language: Some("es_ES.UTF-8".to_string()),
            keyboard: Some("es".to_string()),
            timezone: Some("Atlantic/Canary".to_string()),
        };

        let config = InstallSettings {
            localization: Some(localization.clone()),
            ..Default::default()
        };

        let message = message::SetConfig::new(config);
        assert!(handler.call(message).await.is_ok());

        let config = handler.call(message::GetFullConfig).await?;
        assert_eq!(config.localization, Some(localization));

        Ok(())
    }

    #[tokio::test]
    #[cfg(not(ci))]
    async fn test_patch_config() -> Result<(), Box<dyn std::error::Error>> {
        let handler = start_service().await;
        let original = handler.call(message::GetFullConfig).await?;

        let l10n_patch = l10n::UserConfig {
            keyboard: Some("en".to_string()),
            ..Default::default()
        };

        let config = InstallSettings {
            localization: Some(l10n_patch.clone()),
            ..Default::default()
        };
        let message = message::UpdateConfig::new(config);
        assert!(handler.call(message).await.is_ok());

        let config = handler.call(message::GetConfig).await?;
        let l10n = config.localization.unwrap();
        let l10n_original = original.localization.unwrap();

        assert_eq!(l10n.keyboard, l10n_patch.keyboard);
        assert_eq!(l10n.language, l10n_original.language);
        assert_eq!(l10n.timezone, l10n_original.timezone);

        Ok(())
    }
}
