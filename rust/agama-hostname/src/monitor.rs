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
use agama_utils::{
    actor::Handler,
    dbus::{get_property, PropertiesMonitor},
};

/// Handles changed D-Bus properties and updates the hostname service accordingly.
pub async fn handle_changes(handler: &Handler<Service>, changes: HashMap<String, OwnedValue>) {
    if let Ok(name) = get_property::<String>(&changes, "Hostname") {
        let _ = handler.call(message::UpdateHostname { name }).await;
    }
    if let Ok(name) = get_property::<String>(&changes, "StaticHostname") {
        let _ = handler.call(message::UpdateStaticHostname { name }).await;
    }
}

/// Starts monitoring the D-Bus hostname service notifying static or transient hostname changes.
pub async fn start(handler: Handler<Service>) -> Result<tokio::task::JoinHandle<()>, zbus::Error> {
    let mut monitor =
        PropertiesMonitor::new("org.freedesktop.hostname1", "/org/freedesktop/hostname1").await?;

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
    use zbus::zvariant::Str;

    #[tokio::test]
    async fn test_handle_hostname_change() {
        let (events_tx, mut events_rx) = broadcast::channel::<Event>(16);
        let issues = issue::Service::starter(events_tx.clone()).start();
        let handler = start_service(events_tx, issues).await;

        let changes = HashMap::from([(
            "Hostname".to_string(),
            OwnedValue::from(Str::from_static("new-transient")),
        )]);

        handle_changes(&handler, changes).await;

        let config = handler.call(message::GetConfig).await.unwrap();
        assert_eq!(config.hostname, Some("new-transient".to_string()));

        let event = events_rx.recv().await.unwrap();
        assert!(matches!(
            event,
            Event::ProposalChanged {
                scope: Scope::Hostname,
            }
        ));
    }

    #[tokio::test]
    async fn test_handle_static_hostname_change() {
        let (events_tx, _events_rx) = broadcast::channel::<Event>(16);
        let issues = issue::Service::starter(events_tx.clone()).start();
        let handler = start_service(events_tx, issues).await;

        let changes = HashMap::from([(
            "StaticHostname".to_string(),
            OwnedValue::from(Str::from_static("new-static")),
        )]);

        handle_changes(&handler, changes).await;

        let config = handler.call(message::GetConfig).await.unwrap();
        assert_eq!(config.r#static, Some("new-static".to_string()));
        assert_eq!(config.hostname, Some("new-static".to_string()));
    }
}
