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

use std::collections::HashMap;
use zbus::zvariant::OwnedValue;

use crate::{message, service::Service};
use agama_locale_data::{KeymapId, LocaleId};
use agama_utils::{
    actor::Handler,
    dbus::{get_property, PropertiesMonitor},
};

/// Handles changed D-Bus properties and updates the localization service accordingly.
pub async fn handle_changes(handler: &Handler<Service>, changes: HashMap<String, OwnedValue>) {
    if let Ok(locales) = get_property::<Vec<String>>(&changes, "Locale") {
        if let Some(locale) = locales.first() {
            let locale_id = locale
                .strip_prefix("LANG=")
                .and_then(|l| l.parse::<LocaleId>().ok());

            if let Some(locale_id) = locale_id {
                _ = handler
                    .call(message::UpdateLocale { locale: locale_id })
                    .await;
            }
        }
    }
    if let Ok(keymap) = get_property::<String>(&changes, "VConsoleKeymap") {
        if let Ok(keymap) = keymap.parse::<KeymapId>() {
            _ = handler.call(message::UpdateKeymap { keymap }).await;
        }
    }
}

/// Starts monitoring the D-Bus locale service for locale and keymap changes.
pub async fn start(handler: Handler<Service>) -> Result<tokio::task::JoinHandle<()>, zbus::Error> {
    let mut monitor =
        PropertiesMonitor::new("org.freedesktop.locale1", "/org/freedesktop/locale1").await?;

    Ok(tokio::spawn(async move {
        while let Some(changes) = monitor.next().await {
            handle_changes(&handler, changes).await;
        }
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::start_service;
    use agama_utils::{
        api::{event::Event, scope::Scope},
        issue,
    };
    use tokio::sync::broadcast;
    use zbus::zvariant::{Str, Value};

    #[tokio::test]
    async fn test_handle_locale_change() {
        let (events_tx, mut events_rx) = broadcast::channel::<Event>(16);
        let issues = issue::Service::starter(events_tx.clone()).start();
        let handler = start_service(events_tx, issues).await;

        let changes = HashMap::from([(
            "Locale".to_string(),
            Value::from(vec![Str::from_static("LANG=es_ES.UTF-8")])
                .try_into()
                .unwrap(),
        )]);

        handle_changes(&handler, changes).await;

        let locale = handler.call(message::GetLocale).await.unwrap();
        assert_eq!(locale, "es_ES.UTF-8".parse::<LocaleId>().unwrap());

        let event = events_rx.recv().await.unwrap();
        assert!(matches!(event, Event::SystemChanged { scope: Scope::L10n }));
    }

    #[tokio::test]
    async fn test_handle_keymap_change() {
        let (events_tx, mut events_rx) = broadcast::channel::<Event>(16);
        let issues = issue::Service::starter(events_tx.clone()).start();
        let handler = start_service(events_tx, issues).await;

        let changes = HashMap::from([(
            "VConsoleKeymap".to_string(),
            OwnedValue::from(Str::from_static("es")),
        )]);

        handle_changes(&handler, changes).await;

        let system = handler.call(message::GetSystem).await.unwrap();
        assert_eq!(system.keymap, "es".parse::<KeymapId>().unwrap());

        let event = events_rx.recv().await.unwrap();
        assert!(matches!(event, Event::SystemChanged { scope: Scope::L10n }));
    }
}
