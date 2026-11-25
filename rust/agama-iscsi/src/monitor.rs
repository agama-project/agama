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

pub use crate::storage_client::monitor::Error;
use crate::storage_client::{monitor::StorageMonitor, proxies::ISCSIProxy};
use agama_utils::{
    actor::Handler,
    api::{event, Scope},
    progress,
};
use zbus::Connection;

pub struct Monitor {
    progress: Handler<progress::Service>,
    events: event::Sender,
    connection: Connection,
}

impl Monitor {
    pub fn new(
        progress: Handler<progress::Service>,
        events: event::Sender,
        connection: Connection,
    ) -> Self {
        Self {
            progress,
            events,
            connection,
        }
    }

    pub async fn spawn(self) -> Result<tokio::task::JoinHandle<()>, Error> {
        let proxy = ISCSIProxy::new(&self.connection).await?;
        let monitor = StorageMonitor::new(self.progress, self.events, Scope::ISCSI);
        monitor
            .spawn(&self.connection, proxy.inner(), "iSCSI")
            .await
    }
}

/// Spawns a Tokio task for the monitor.
///
/// * `monitor`: monitor to spawn.
pub fn spawn(monitor: Monitor) -> Result<(), Error> {
    tokio::spawn(async move {
        if let Err(e) = monitor.spawn().await {
            tracing::error!("Error running the iSCSI monitor: {e:?}");
        }
    });
    Ok(())
}
