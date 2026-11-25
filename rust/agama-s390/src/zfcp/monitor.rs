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

use crate::storage_client::{
    self,
    monitor::StorageMonitor,
    proxies::{self, ZFCPProxy},
};
use agama_utils::{
    actor::Handler,
    api::{
        event::{self, Event},
        Scope,
    },
    issue, progress,
};
use tokio::sync::broadcast;
use tokio_stream::StreamExt;
use zbus::{fdo::PropertiesChanged, Connection};

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
    DBusConversion(#[from] zbus::zvariant::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    StorageClient(#[from] storage_client::Error),
    #[error(transparent)]
    StorageMonitor(#[from] storage_client::monitor::Error),
}

pub struct Monitor {
    storage_monitor: StorageMonitor,
    issues: Handler<issue::Service>,
    connection: Connection,
    storage_client: Handler<storage_client::Service>,
}

impl Monitor {
    pub fn new(
        progress: Handler<progress::Service>,
        issues: Handler<issue::Service>,
        events: event::Sender,
        connection: Connection,
        storage_client: Handler<storage_client::Service>,
    ) -> Self {
        Self {
            storage_monitor: StorageMonitor::new(progress, events, Scope::ZFCP),
            issues,
            connection,
            storage_client,
        }
    }

    async fn run(&self) -> Result<(), Error> {
        let proxy = ZFCPProxy::new(&self.connection).await?;
        let mut stream = proxies::proxy_signal_stream(&self.connection, proxy.inner()).await?;

        self.update_issues().await?;

        while let Some(message) = stream.next().await {
            let message = message?;

            if let Some(signal) = PropertiesChanged::from_message(message.clone()) {
                self.handle_properties_changed(signal).await?;
                continue;
            }
            if self.storage_monitor.handle_message(&message).await? {
                continue;
            }
            tracing::warn!("Unmanaged zFCP signal: {message:?}");
        }

        Ok(())
    }

    async fn update_issues(&self) -> Result<(), Error> {
        let issues = self
            .storage_client
            .call(storage_client::message::zfcp::GetIssues)
            .await?;
        self.issues
            .cast(issue::message::Set::new(Scope::ZFCP, issues))?;
        Ok(())
    }

    async fn handle_properties_changed(&self, signal: PropertiesChanged) -> Result<(), Error> {
        self.storage_monitor.handle_properties_changed(&signal)?;

        let args = signal.args()?;
        if let Some(issues) = args.changed_properties().get("Issues").cloned() {
            let issues: String = issues.try_into()?;
            let issues = serde_json::from_str(issues.as_str())?;
            self.issues
                .cast(issue::message::Set::new(Scope::ZFCP, issues))?;
        }
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
