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
    use crate::{message, service::Service};
    use agama_utils::{
        actor::Handler,
        api::{l10n, Config, Event},
        question, test,
    };
    use std::path::PathBuf;
    use tokio::sync::broadcast;

    async fn start_service() -> Handler<Service> {
        let (events_sender, mut events_receiver) = broadcast::channel::<Event>(16);
        let dbus = test::dbus::connection().await.unwrap();

        tokio::spawn(async move {
            while let Ok(event) = events_receiver.recv().await {
                println!("{:?}", event);
            }
        });

        let questions = question::start(events_sender.clone()).await.unwrap();
        Service::builder(questions, events_sender, dbus)
            .spawn()
            .await
            .unwrap()
    }

    #[tokio::test]
    #[cfg(not(ci))]
    async fn test_update_config() -> Result<(), Box<dyn std::error::Error>> {
        let share_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share");
        std::env::set_var("AGAMA_SHARE_DIR", share_dir.display().to_string());

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
