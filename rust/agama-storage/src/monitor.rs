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

use agama_utils::{
    actor::Handler,
    api::{
        event::{self, Event},
        Progress, Scope,
    },
    progress::{self, message},
};
use serde::Deserialize;
use serde_json;
use std::pin::Pin;
use tokio::sync::broadcast;
use tokio_stream::{Stream, StreamExt, StreamMap};
use zbus::{proxy, Connection};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Wrong signal arguments")]
    ProgressChangedArgs,
    #[error("Wrong signal data")]
    ProgressChangedData,
    #[error(transparent)]
    Progress(#[from] progress::service::Error),
    #[error(transparent)]
    DBus(#[from] zbus::Error),
    #[error(transparent)]
    Event(#[from] broadcast::error::SendError<Event>),
}

#[proxy(
    default_service = "org.opensuse.Agama.Storage1",
    default_path = "/org/opensuse/Agama/Storage1",
    interface = "org.opensuse.Agama.Storage1",
    assume_defaults = true
)]
pub trait Storage1 {
    #[zbus(signal)]
    fn system_changed(&self) -> zbus::Result<()>;

    #[zbus(signal)]
    fn proposal_changed(&self) -> zbus::Result<()>;

    #[zbus(signal)]
    fn progress_changed(&self, progress: &str) -> zbus::Result<()>;

    #[zbus(signal)]
    fn progress_finished(&self) -> zbus::Result<()>;
}

#[derive(Debug)]
enum Signal {
    SystemChanged(SystemChanged),
    ProposalChanged(ProposalChanged),
    ProgressChanged(ProgressChanged),
    ProgressFinished(ProgressFinished),
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
            scope: Scope::Storage,
            size: data.size,
            steps: data.steps,
            step: data.step,
            index: data.index,
        }
    }
}

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

    async fn run(&self) -> Result<(), Error> {
        let mut streams = StreamMap::new();
        streams.insert("SystemChanged", self.system_changed_stream().await?);
        streams.insert("ProposalChanged", self.proposal_changed_stream().await?);
        streams.insert("ProgressChanged", self.progress_changed_stream().await?);
        streams.insert("ProgressFinished", self.progress_finished_stream().await?);

        tokio::pin!(streams);

        while let Some((_, signal)) = streams.next().await {
            self.handle_signal(signal)?;
        }

        Ok(())
    }

    fn handle_signal(&self, signal: Signal) -> Result<(), Error> {
        match signal {
            Signal::SystemChanged(signal) => self.handle_system_changed(signal)?,
            Signal::ProposalChanged(signal) => self.handle_proposal_changed(signal)?,
            Signal::ProgressChanged(signal) => self.handle_progress_changed(signal)?,
            Signal::ProgressFinished(signal) => self.handle_progress_finished(signal)?,
        }
        Ok(())
    }

    fn handle_system_changed(&self, _signal: SystemChanged) -> Result<(), Error> {
        self.events.send(Event::SystemChanged {
            scope: Scope::Storage,
        })?;
        Ok(())
    }

    fn handle_proposal_changed(&self, _signal: ProposalChanged) -> Result<(), Error> {
        self.events.send(Event::ProposalChanged {
            scope: Scope::Storage,
        })?;
        Ok(())
    }

    fn handle_progress_changed(&self, signal: ProgressChanged) -> Result<(), Error> {
        let Ok(args) = signal.args() else {
            return Err(Error::ProgressChangedArgs);
        };
        let Ok(progress_data) = serde_json::from_str::<ProgressData>(args.progress) else {
            return Err(Error::ProgressChangedData);
        };
        self.progress
            .cast(message::Set::new(progress_data.into()))?;

        Ok(())
    }

    fn handle_progress_finished(&self, _signal: ProgressFinished) -> Result<(), Error> {
        self.progress.cast(message::Finish::new(Scope::Storage))?;
        Ok(())
    }

    async fn system_changed_stream(
        &self,
    ) -> Result<Pin<Box<dyn Stream<Item = Signal> + Send>>, Error> {
        let proxy = Storage1Proxy::new(&self.connection).await?;
        let stream = proxy
            .receive_system_changed()
            .await?
            .map(|signal| Signal::SystemChanged(signal));
        Ok(Box::pin(stream))
    }

    async fn proposal_changed_stream(
        &self,
    ) -> Result<Pin<Box<dyn Stream<Item = Signal> + Send>>, Error> {
        let proxy = Storage1Proxy::new(&self.connection).await?;
        let stream = proxy
            .receive_proposal_changed()
            .await?
            .map(|signal| Signal::ProposalChanged(signal));
        Ok(Box::pin(stream))
    }

    async fn progress_changed_stream(
        &self,
    ) -> Result<Pin<Box<dyn Stream<Item = Signal> + Send>>, Error> {
        let proxy = Storage1Proxy::new(&self.connection).await?;
        let stream = proxy
            .receive_progress_changed()
            .await?
            .map(|signal| Signal::ProgressChanged(signal));
        Ok(Box::pin(stream))
    }

    async fn progress_finished_stream(
        &self,
    ) -> Result<Pin<Box<dyn Stream<Item = Signal> + Send>>, Error> {
        let proxy = Storage1Proxy::new(&self.connection).await?;
        let stream = proxy
            .receive_progress_finished()
            .await?
            .map(|signal| Signal::ProgressFinished(signal));
        Ok(Box::pin(stream))
    }
}

/// Spawns a Tokio task for the monitor.
///
/// * `monitor`: monitor to spawn.
pub fn spawn(monitor: Monitor) -> Result<(), Error> {
    tokio::spawn(async move {
        if let Err(e) = monitor.run().await {
            println!("Error running the storage monitor: {e:?}");
        }
    });
    Ok(())
}
