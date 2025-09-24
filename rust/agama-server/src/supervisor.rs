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

mod error;
pub use error::Error;

pub mod handler;
pub use handler::Handler;

mod service;
pub use service::Action;

mod scope;
pub use scope::{ConfigScope, Scope};

mod system_info;
pub use system_info::SystemInfo;

mod event;
mod proposal;

use agama_l10n as l10n;

use crate::web::EventsSender;
use agama_utils::Service as _;
use service::Service;
use tokio::sync::mpsc;

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
pub async fn start_service(events: EventsSender) -> Result<Handler, Error> {
    let mut listener = event::Listener::new(events);
    let (events_sender, events_receiver) = mpsc::unbounded_channel::<l10n::Event>();
    let l10n = l10n::start_service(events_sender).await?;
    listener.add_channel("l10n", events_receiver);
    tokio::spawn(async move {
        listener.run().await;
    });

    let (sender, receiver) = mpsc::unbounded_channel();
    let mut service = Service::new(l10n, receiver);
    tokio::spawn(async move {
        service.run().await;
    });

    Ok(Handler::new(sender))
}

#[cfg(test)]
mod test {
    use crate::supervisor::Handler;
    use agama_l10n::UserConfig;
    use agama_lib::{http::Event, install_settings::InstallSettings};
    use tokio::sync::broadcast;

    async fn start_service() -> Handler {
        let (events_tx, _events_rx) = broadcast::channel::<Event>(16);
        crate::supervisor::start_service(events_tx).await.unwrap()
    }

    #[tokio::test]
    #[cfg(not(ci))]
    async fn test_update_config() -> Result<(), Box<dyn std::error::Error>> {
        let handler = start_service().await;

        let localization = UserConfig {
            language: Some("es_ES.UTF-8".to_string()),
            keyboard: Some("es".to_string()),
            timezone: Some("Atlantic/Canary".to_string()),
        };

        let config = InstallSettings {
            localization: Some(localization.clone()),
            ..Default::default()
        };

        assert!(handler.update_config(&config).is_ok());

        let config = handler.get_full_config().await?;
        assert_eq!(config.localization, Some(localization));

        Ok(())
    }

    #[tokio::test]
    #[cfg(not(ci))]
    async fn test_patch_config() -> Result<(), Box<dyn std::error::Error>> {
        let handler = start_service().await;
        let original = handler.get_full_config().await?;

        let l10n_patch = UserConfig {
            keyboard: Some("en".to_string()),
            ..Default::default()
        };

        let config = InstallSettings {
            localization: Some(l10n_patch.clone()),
            ..Default::default()
        };
        assert!(handler.patch_config(&config).is_ok());

        let config = handler.get_full_config().await?;
        let l10n = config.localization.unwrap();
        let l10n_original = original.localization.unwrap();

        assert_eq!(l10n.keyboard, l10n_patch.keyboard);
        assert_eq!(l10n.language, l10n_original.language);
        assert_eq!(l10n.timezone, l10n_original.timezone);

        Ok(())
    }
}
