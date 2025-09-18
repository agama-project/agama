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

//! Defines a service that keep tracks of the Agama progress.
//!
//! It is responsible for:
//!
//! * Querying the progress via D-Bus and keeping them in a cache.
//! * Listening to D-Bus signals to keep the cache up-to-date.
//! * Emitting `ProgressChanged` events.
//!
//! The following components are included:
//!
//! * [ProgressService] that runs on a separate task to hold the status.
//! * [ProgressClient] that allows querying the [ProgressService] server about the
//!   progress.
//! * [ProgressRouterBuilder] which allows building a router.
//!
//! At this point, it only handles the progress that are exposed through D-Bus.

use crate::web::EventsSender;
use agama_lib::{
    event,
    http::Event,
    progress::{Progress, ProgressSequence},
    proxies::{ProgressChanged, ProgressProxy},
};
use axum::{extract::State, routing::get, Json, Router};
use std::collections::HashMap;
use tokio::sync::{broadcast, mpsc, oneshot};
use tokio_stream::StreamExt;
use zbus::{message::Type as MessageType, MatchRule, MessageStream};

type ProgressServiceResult<T> = Result<T, ProgressServiceError>;

#[derive(Debug, thiserror::Error)]
pub enum ProgressServiceError {
    #[error("Could not return the progress")]
    SendProgress,
    #[error("Could not get an answer from the service: {0}")]
    RecvProgress(#[from] oneshot::error::RecvError),
    #[error("Could not set the command: {0}")]
    SendCommand(#[from] mpsc::error::SendError<ProgressCommand>),
    #[error("Error parsing progress from D-Bus: {0}")]
    InvalidProgress(#[from] zbus::zvariant::Error),
    #[error("Error reading the progress: {0}")]
    DBus(#[from] zbus::Error),
    #[error("Invalid D-Bus name: {0}")]
    DBusName(#[from] zbus::names::Error),
    #[error("Could not send the event: {0}")]
    SendEvent(#[from] broadcast::error::SendError<Event>),
}

#[derive(Debug)]
pub enum ProgressCommand {
    Get(String, String, oneshot::Sender<ProgressSequence>),
}

/// Implements a Tokio task that holds the progress for each service.
pub struct ProgressService {
    cache: HashMap<String, ProgressSequence>,
    commands: mpsc::Receiver<ProgressCommand>,
    events: EventsSender,
    dbus: zbus::Connection,
}

impl ProgressService {
    /// Sets up and starts the service as a Tokio task.
    ///
    /// Once it is started, the service waits for:
    ///
    /// * Commands from a client ([ProgressClient]).
    /// * Relevant events from D-Bus.
    pub async fn start(dbus: zbus::Connection, events: EventsSender) -> ProgressClient {
        let (tx, rx) = mpsc::channel(4);
        let mut service = ProgressService {
            cache: HashMap::new(),
            dbus,
            events,
            commands: rx,
        };

        tokio::spawn(async move {
            if let Err(e) = service.run().await {
                tracing::error!("Could not start the progress service: {e:?}")
            }
        });
        ProgressClient(tx)
    }

    /// Main loop of the service.
    async fn run(&mut self) -> ProgressServiceResult<()> {
        let mut messages = build_progress_changed_stream(&self.dbus).await?;
        loop {
            tokio::select! {
                Some(cmd) = self.commands.recv() => {
                    if let Err(e) = self.handle_command(cmd).await {
                        tracing::error!("{e}");
                    }
                }

                Some(Ok(message)) = messages.next() => {
                    if let Some(changed) = ProgressChanged::from_message(message) {
                        if let Err(e) = self.handle_progress_changed(changed).await {
                            tracing::error!("ProgressService: could not handle change: {:?}", e);
                        }
                    }
                }
            }
        }
    }

    /// Handles commands from the client.
    async fn handle_command(&mut self, command: ProgressCommand) -> ProgressServiceResult<()> {
        match command {
            ProgressCommand::Get(service, path, tx) => {
                let progress = self.get(&service, &path).await?;
                tx.send(progress)
                    .map_err(|_| ProgressServiceError::SendProgress)?;
            }
        }

        Ok(())
    }

    /// Handles ProgressChanged events.
    ///
    /// It reports an error if something went work. If the message was processed or skipped
    /// it returns Ok(()).
    async fn handle_progress_changed(
        &mut self,
        message: ProgressChanged,
    ) -> ProgressServiceResult<()> {
        let args = message.args()?;
        let inner = message.message();
        let header = inner.header();

        // Given that it is a ProcessChanged, it should not happen.
        let Some(path) = header.path() else {
            tracing::warn!("Found a ProgressChanged signal without a path");
            return Ok(());
        };

        let (current_step, current_title) = args.current_step();
        let progress = Progress {
            current_title: current_title.to_string(),
            current_step: current_step.clone(),
            max_steps: args.total_steps,
            finished: args.finished,
        };
        let sequence = ProgressSequence {
            steps: args.steps().iter().map(ToString::to_string).collect(),
            progress: progress.clone(),
        };
        self.cache.insert(path.to_string(), sequence.clone());

        let event = event!(ProgressChanged {
            path: path.to_string(),
            progress,
        });
        self.events.send(event)?;
        Ok(())
    }

    /// Gets the progress for a given D-Bus service and path.
    ///
    /// This method uses a cache to store the values. If the value is not in the cache,
    /// it asks the D-Bus service about the progress (and cache them).
    ///
    /// * `service`: D-Bus service to connect to.
    /// * `path`: path of the D-Bus object implementing the
    ///   "org.opensuse.Agama1.Progress" interface.
    async fn get(&mut self, service: &str, path: &str) -> ProgressServiceResult<ProgressSequence> {
        if let Some(sequence) = self.cache.get(path) {
            return Ok(sequence.clone());
        }

        let proxy = ProgressProxy::builder(&self.dbus)
            .destination(service)?
            .path(path)?
            .build()
            .await?;

        let progress = Progress::from_proxy(&proxy).await?;
        let steps = proxy.steps().await?;
        let sequence = ProgressSequence { steps, progress };

        self.cache.insert(path.to_string(), sequence.clone());
        Ok(sequence)
    }
}

/// It allows querying the [ProgressService].
///
/// It is cheap to clone the client and use it from several
/// places.
#[derive(Clone)]
pub struct ProgressClient(mpsc::Sender<ProgressCommand>);

impl ProgressClient {
    /// Get the progress for the given D-Bus service and path.
    pub async fn get(&self, service: &str, path: &str) -> ProgressServiceResult<ProgressSequence> {
        let (tx, rx) = oneshot::channel();
        self.0
            .send(ProgressCommand::Get(
                service.to_string(),
                path.to_string(),
                tx,
            ))
            .await?;
        Ok(rx.await?)
    }
}

/// It allows building an Axum router for the progress service.
pub struct ProgressRouterBuilder {
    service: String,
    path: String,
    client: ProgressClient,
}

impl ProgressRouterBuilder {
    /// Creates a new builder.
    ///
    /// * `service`: D-Bus service to connect to.
    /// * `path`: path of the D-Bus object implementing the
    ///   "org.opensuse.Agama1.Progress" interface.
    /// * `client`: client to access the progress.
    pub fn new(service: &str, path: &str, client: ProgressClient) -> Self {
        ProgressRouterBuilder {
            service: service.to_string(),
            path: path.to_string(),
            client,
        }
    }

    /// Builds the Axum router.
    pub fn build<T>(self) -> Result<Router<T>, crate::error::Error> {
        let state = ProgressState {
            service: self.service,
            path: self.path,
            client: self.client,
        };

        Ok(Router::new()
            .route("/progress", get(Self::progress))
            .with_state(state))
    }

    /// Handler of the GET /progress endpoint.
    async fn progress(
        State(state): State<ProgressState>,
    ) -> Result<Json<ProgressSequence>, crate::error::Error> {
        let progress = state.client.get(&state.service, &state.path).await?;
        Ok(Json(progress))
    }
}

/// State for the router.
#[derive(Clone)]
struct ProgressState {
    service: String,
    path: String,
    client: ProgressClient,
}

/// Returns a stream of properties changes.
///
/// It listens for changes in several objects that are related to a network device.
pub async fn build_progress_changed_stream(
    connection: &zbus::Connection,
) -> Result<MessageStream, zbus::Error> {
    let rule = MatchRule::builder()
        .msg_type(MessageType::Signal)
        .interface("org.opensuse.Agama1.Progress")?
        .member("ProgressChanged")?
        .build();
    // The third parameter corresponds to the max_queue. We rely on the default (64).
    let stream = MessageStream::for_match_rule(rule, connection, None).await?;
    Ok(stream)
}
