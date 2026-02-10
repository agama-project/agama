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

use crate::{
    dasd::dbus::{
        DASDProxy, FormatChanged, FormatFinished, ProgressChanged, ProgressFinished, SystemChanged,
    },
    storage,
};
use agama_utils::{
    actor::Handler,
    api::{
        event::{self, Event},
        s390::dasd::FormatSummary,
        Progress, Scope,
    },
    progress,
};
use serde::Deserialize;
use serde_json;
use tokio::sync::broadcast;
use tokio_stream::StreamExt;
use zbus::{message, Connection, MatchRule, MessageStream};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Progress(#[from] progress::service::Error),
    #[error(transparent)]
    Event(#[from] broadcast::error::SendError<Event>),
    #[error(transparent)]
    DBus(#[from] zbus::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Storage(#[from] storage::service::Error),
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
            scope: Scope::DASD,
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
    events: event::Sender,
    connection: Connection,
}

impl Monitor {
    pub fn new(
        storage: Handler<storage::Service>,
        progress: Handler<progress::Service>,
        events: event::Sender,
        connection: Connection,
    ) -> Self {
        Self {
            storage,
            progress,
            events,
            connection,
        }
    }

    async fn run(&self) -> Result<(), Error> {
        let proxy = DASDProxy::new(&self.connection).await?;
        let rule = MatchRule::builder()
            .msg_type(message::Type::Signal)
            .sender(proxy.inner().destination())?
            .path(proxy.inner().path())?
            .interface(proxy.inner().interface())?
            .build();
        let mut stream = MessageStream::for_match_rule(rule, &self.connection, None).await?;

        while let Some(Ok(message)) = stream.next().await {
            if let Some(signal) = SystemChanged::from_message(message.clone()) {
                self.handle_system_changed(signal)?;
                continue;
            }
            if let Some(signal) = ProgressChanged::from_message(message.clone()) {
                self.handle_progress_changed(signal)?;
                continue;
            }
            if let Some(signal) = ProgressFinished::from_message(message.clone()) {
                self.handle_progress_finished(signal)?;
                continue;
            }
            if let Some(signal) = FormatChanged::from_message(message.clone()) {
                self.handle_format_changed(signal)?;
                continue;
            }
            if let Some(signal) = FormatFinished::from_message(message.clone()) {
                self.handle_format_finished(signal)?;
                continue;
            }
            tracing::warn!("Unmanaged DASD signal: {message:?}");
        }

        Ok(())
    }

    fn handle_system_changed(&self, _signal: SystemChanged) -> Result<(), Error> {
        self.events
            .send(Event::SystemChanged { scope: Scope::DASD })?;
        self.storage.cast(storage::message::Probe)?;
        Ok(())
    }

    fn handle_progress_changed(&self, signal: ProgressChanged) -> Result<(), Error> {
        let args = signal.args()?;
        let progress_data = serde_json::from_str::<ProgressData>(args.progress)?;
        self.progress
            .cast(progress::message::SetProgress::new(progress_data.into()))?;
        Ok(())
    }

    fn handle_progress_finished(&self, _signal: ProgressFinished) -> Result<(), Error> {
        self.progress
            .cast(progress::message::Finish::new(Scope::DASD))?;
        Ok(())
    }

    fn handle_format_changed(&self, signal: FormatChanged) -> Result<(), Error> {
        let args = signal.args()?;
        let format_summary = serde_json::from_str::<FormatSummary>(args.summary)?;
        self.events.send(Event::DASDFormatChanged(format_summary))?;
        Ok(())
    }

    fn handle_format_finished(&self, _signal: FormatFinished) -> Result<(), Error> {
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
