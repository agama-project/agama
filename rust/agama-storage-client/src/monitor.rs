// Copyright (c) [2026] SUSE LLC
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

//! Common monitor helpers for storage client proxies.

use agama_utils::{
    actor::Handler,
    api::{
        event::{self, Event},
        Scope,
    },
    progress,
};
use tokio::sync::broadcast;
use tokio_stream::StreamExt;
use zbus::fdo::PropertiesChanged;

use crate::progress::ProgressData;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Progress(#[from] progress::service::Error),
    #[error(transparent)]
    Event(#[from] broadcast::error::SendError<Event>),
    #[error(transparent)]
    DBus(#[from] zbus::Error),
    #[error(transparent)]
    DBusConversion(#[from] zbus::zvariant::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
}

/// Helper that handles common progress and system property signals from storage proxies.
pub struct StorageMonitor {
    pub progress: Handler<progress::Service>,
    pub events: event::Sender,
    pub scope: Scope,
}

impl StorageMonitor {
    pub fn new(progress: Handler<progress::Service>, events: event::Sender, scope: Scope) -> Self {
        Self {
            progress,
            events,
            scope,
        }
    }

    /// Handles a PropertiesChanged signal, emitting `Event::SystemChanged` if the "System" property changed.
    pub fn handle_properties_changed(&self, signal: &PropertiesChanged) -> Result<(), Error> {
        let args = signal.args()?;
        if args.changed_properties().get("System").is_some() {
            self.events
                .send(Event::SystemChanged { scope: self.scope })?;
        }
        Ok(())
    }

    /// Deserializes JSON progress and calls `progress::message::SetProgress`.
    pub async fn handle_progress_changed(&self, raw: &str) -> Result<(), Error> {
        let progress = ProgressData::parse(raw, self.scope)?;
        self.progress
            .call(progress::message::SetProgress::new(progress))
            .await?;
        Ok(())
    }

    /// Calls `progress::message::Finish` for this scope.
    pub async fn handle_progress_finished(&self) -> Result<(), Error> {
        self.progress
            .call(progress::message::Finish::new(self.scope))
            .await?;
        Ok(())
    }

    /// Dispatches a D-Bus message. Returns `Ok(true)` if the message was a recognized storage signal
    /// (PropertiesChanged with "System", ProgressChanged, or ProgressFinished) and was handled.
    pub async fn handle_message(&self, message: &zbus::message::Message) -> Result<bool, Error> {
        if message.header().message_type() != zbus::message::Type::Signal {
            return Ok(false);
        }

        if let Some(signal) = PropertiesChanged::from_message(message.clone()) {
            self.handle_properties_changed(&signal)?;
            return Ok(true);
        }

        if let Some(member) = message.header().member() {
            match member.as_str() {
                "ProgressChanged" => {
                    let (raw,): (String,) = message.body().deserialize()?;
                    self.handle_progress_changed(&raw).await?;
                    return Ok(true);
                }
                "ProgressFinished" => {
                    self.handle_progress_finished().await?;
                    return Ok(true);
                }
                _ => {}
            }
        }

        Ok(false)
    }

    /// Subscribes to the proxy's signals and spawns a background Tokio task to handle them.
    pub async fn spawn(
        self,
        connection: &zbus::Connection,
        proxy: &zbus::Proxy<'_>,
        service_name: &'static str,
    ) -> Result<tokio::task::JoinHandle<()>, Error> {
        let mut stream = crate::proxies::proxy_signal_stream(connection, proxy).await?;
        Ok(tokio::spawn(async move {
            while let Some(message) = stream.next().await {
                match message {
                    Ok(msg) => {
                        if let Err(e) = self.handle_message(&msg).await {
                            tracing::error!("Error handling {service_name} signal: {e:?}");
                        }
                    }
                    Err(e) => {
                        tracing::error!("Error in {service_name} signal stream: {e:?}");
                    }
                }
            }
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agama_utils::{
        api::{event::Event, Scope},
        progress,
    };
    use tokio::sync::broadcast;

    #[tokio::test]
    async fn test_handle_progress_changed_and_finished() {
        let (events_tx, mut _events_rx) = broadcast::channel::<Event>(16);
        let progress_handler = progress::Service::starter(events_tx.clone()).start();

        let monitor = StorageMonitor::new(progress_handler.clone(), events_tx, Scope::ISCSI);

        let json =
            r#"{"size": 3, "steps": ["step 1", "step 2", "step 3"], "step": "step 1", "index": 1}"#;
        monitor.handle_progress_changed(json).await.unwrap();

        let progresses = progress_handler
            .call(progress::message::GetProgress)
            .await
            .unwrap();
        assert_eq!(progresses.len(), 1);
        let p = &progresses[0];
        assert_eq!(p.scope, Scope::ISCSI);
        assert_eq!(p.size, 3);
        assert_eq!(p.step, "step 1");
        assert_eq!(p.index, 1);

        // Test finish
        monitor.handle_progress_finished().await.unwrap();
        let is_empty = progress_handler
            .call(progress::message::IsEmpty::new())
            .await
            .unwrap();
        assert!(is_empty);
    }

    #[tokio::test]
    async fn test_handle_progress_invalid_json() {
        let (events_tx, _events_rx) = broadcast::channel::<Event>(16);
        let progress_handler = progress::Service::starter(events_tx.clone()).start();
        let monitor = StorageMonitor::new(progress_handler, events_tx, Scope::DASD);

        let result = monitor.handle_progress_changed("not-valid-json").await;
        assert!(matches!(result, Err(Error::Json(_))));
    }
}
