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

use crate::storage;
use agama_storage_client::proxies::{zfcp, ZFCPProxy};
use agama_utils::{
    actor::Handler,
    api::{
        event::{self, Event},
        Progress, Scope,
    },
    issue, progress,
};
use serde::Deserialize;
use serde_json;
use tokio::sync::broadcast;
use tokio_stream::StreamExt;
use zbus::{fdo::PropertiesChanged, message, Connection, MatchRule, MessageStream};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Progress(#[from] progress::service::Error),
    #[error(transparent)]
    Event(#[from] broadcast::error::SendError<Event>),
    #[error(transparent)]
    Issue(#[from] issue::service::Error),
    #[error(transparent)]
    DBus(#[from] zbus::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Storage(#[from] storage::service::Error),
    #[error(transparent)]
    DBusClient(#[from] agama_storage_client::Error),
}

#[derive(Debug, Deserialize)]
struct ProgressData {
    pub size: usize,
    pub steps: Vec<String>,
    pub step: String,
    pub index: usize,
}

impl From<ProgressData> for Progress {
    fn from(data: ProgressData) -> Self {
        Progress {
            scope: Scope::ZFCP,
            size: data.size,
            steps: data.steps,
            step: data.step,
            index: data.index,
        }
    }
}

pub struct Monitor {
    storage: Handler<storage::Service>,
    progress: Handler<progress::Service>,
    issues: Handler<issue::Service>,
    events: event::Sender,
    connection: Connection,
    storage_dbus: Handler<agama_storage_client::Service>,
}

impl Monitor {
    pub fn new(
        storage: Handler<storage::Service>,
        progress: Handler<progress::Service>,
        issues: Handler<issue::Service>,
        events: event::Sender,
        connection: Connection,
        storage_dbus: Handler<agama_storage_client::Service>,
    ) -> Self {
        Self {
            storage,
            progress,
            issues,
            events,
            connection,
            storage_dbus,
        }
    }

    async fn run(&self) -> Result<(), Error> {
        let proxy = ZFCPProxy::new(&self.connection).await?;
        let rule = MatchRule::builder()
            .msg_type(message::Type::Signal)
            .sender(proxy.inner().destination())?
            .path(proxy.inner().path())?
            .build();
        let mut stream = MessageStream::for_match_rule(rule, &self.connection, None).await?;

        self.update_issues().await?;

        while let Some(message) = stream.next().await {
            let message = message?;

            if let Some(signal) = PropertiesChanged::from_message(message.clone()) {
                self.handle_properties_changed(signal).await?;
                continue;
            }
            if let Some(signal) = zfcp::ProgressChanged::from_message(message.clone()) {
                self.handle_progress_changed(signal).await?;
                continue;
            }
            if let Some(signal) = zfcp::ProgressFinished::from_message(message.clone()) {
                self.handle_progress_finished(signal).await?;
                continue;
            }
            tracing::warn!("Unmanaged zFCP signal: {message:?}");
        }

        Ok(())
    }

    async fn update_issues(&self) -> Result<(), Error> {
        let issues = self
            .storage_dbus
            .call(agama_storage_client::message::zfcp::GetIssues)
            .await?;
        self.issues
            .cast(issue::message::Set::new(Scope::ZFCP, issues))?;
        Ok(())
    }

    async fn handle_properties_changed(&self, signal: PropertiesChanged) -> Result<(), Error> {
        let args = signal.args()?;
        if args.changed_properties().get("System").is_some() {
            self.events
                .send(Event::SystemChanged { scope: Scope::ZFCP })?;
            self.storage.cast(storage::message::Probe)?;
        }
        if args.changed_properties().get("Issues").is_some() {
            self.update_issues().await?;
        }
        Ok(())
    }

    async fn handle_progress_changed(&self, signal: zfcp::ProgressChanged) -> Result<(), Error> {
        let args = signal.args()?;
        let progress_data = serde_json::from_str::<ProgressData>(args.progress)?;
        self.progress
            .call(progress::message::SetProgress::new(progress_data.into()))
            .await?;
        Ok(())
    }

    async fn handle_progress_finished(&self, _signal: zfcp::ProgressFinished) -> Result<(), Error> {
        self.progress
            .call(progress::message::Finish::new(Scope::ZFCP))
            .await?;
        Ok(())
    }
}

/// Spawns a Tokio task for the monitor.
///
/// * `monitor`: monitor to spawn.
pub fn spawn(monitor: Monitor) -> Result<(), Error> {
    tokio::spawn(async move {
        if let Err(e) = monitor.run().await {
            tracing::error!("Error running the zFCP monitor: {e:?}");
        }
    });
    Ok(())
}
