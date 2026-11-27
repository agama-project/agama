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
use crate::storage_client::{
    monitor::StorageMonitor,
    proxies::{self, dasd, DASDProxy},
};
use agama_utils::{
    actor::Handler,
    api::{event, s390::dasd::FormatSummary, Event, Scope},
    progress,
};
use tokio_stream::StreamExt;
use zbus::Connection;

pub struct Monitor {
    storage_monitor: StorageMonitor,
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
            storage_monitor: StorageMonitor::new(progress, events.clone(), Scope::DASD),
            events,
            connection,
        }
    }

    async fn run(&self) -> Result<(), Error> {
        let proxy = DASDProxy::new(&self.connection).await?;
        let mut stream = proxies::proxy_signal_stream(&self.connection, proxy.inner()).await?;

        while let Some(message) = stream.next().await {
            let message = message?;

            if self.storage_monitor.handle_message(&message).await? {
                continue;
            }
            if let Some(signal) = dasd::FormatChanged::from_message(message.clone()) {
                self.handle_format_changed(signal)?;
                continue;
            }
            if let Some(signal) = dasd::FormatFinished::from_message(message.clone()) {
                self.handle_format_finished(signal)?;
                continue;
            }
            tracing::warn!("Unmanaged DASD signal: {message:?}");
        }

        Ok(())
    }

    fn handle_format_changed(&self, signal: dasd::FormatChanged) -> Result<(), Error> {
        let args = signal.args()?;
        let summary = serde_json::from_str::<FormatSummary>(args.summary)?;
        self.events.send(Event::DASDFormatChanged { summary })?;
        Ok(())
    }

    fn handle_format_finished(&self, _signal: dasd::FormatFinished) -> Result<(), Error> {
        self.events.send(Event::DASDFormatFinished)?;
        Ok(())
    }
}

/// Spawns a Tokio task for the monitor.
///
/// * `monitor`: monitor to spawn.
pub fn spawn(monitor: Monitor) -> Result<(), Error> {
    tokio::spawn(async move {
        if let Err(e) = monitor.run().await {
            tracing::error!("Error running the DASD monitor: {e:?}");
        }
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use agama_utils::progress;
    use tokio::sync::broadcast;

    #[tokio::test]
    async fn test_format_finished_event() {
        let (events_tx, mut events_rx) = broadcast::channel::<Event>(16);
        let progress_handler = progress::Service::starter(events_tx.clone()).start();
        let connection = zbus::connection::Builder::session().unwrap().build().await;
        if let Ok(connection) = connection {
            let monitor = Monitor::new(progress_handler, events_tx, connection);
            monitor.events.send(Event::DASDFormatFinished).unwrap();
            let event = events_rx.recv().await.unwrap();
            assert!(matches!(event, Event::DASDFormatFinished));
        }
    }
}
