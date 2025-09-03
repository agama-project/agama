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

//! Defines a service that keep tracks of the Agama issues.
//!
//! It is responsible for:
//!
//! * Querying the issues via D-Bus and keeping them in a cache.
//! * Listening to D-Bus signals to keep the cache up-to-date.
//! * Emitting `IssuesChanged` events.
//!
//! The following components are included:
//!
//! * [IssuesService] that runs on a separate task to hold the status.
//! * [IssuesClient] that allows querying the [IssuesService] server about the
//!   issues.
//! * [IssuesRouterBuilder] which allows building a router.
//!
//! At this point, it only handles the issues that are exposed through D-Bus.

use crate::web::EventsSender;
use agama_lib::{event, http::Event, issue::Issue};
use agama_utils::dbus::build_properties_changed_stream;
use axum::{extract::State, routing::get, Json, Router};
use std::collections::HashMap;
use tokio::sync::{broadcast, mpsc, oneshot};
use tokio_stream::StreamExt;
use zbus::{
    fdo::PropertiesChanged,
    names::BusName,
    zvariant::{Array, OwnedObjectPath},
};

type IssuesServiceResult<T> = Result<T, IssuesServiceError>;

#[derive(Debug, thiserror::Error)]
pub enum IssuesServiceError {
    #[error("Could not return the issues")]
    SendIssues,
    #[error("Could not get an answer from the service: {0}")]
    RecvIssues(#[from] oneshot::error::RecvError),
    #[error("Could not set the command: {0}")]
    SendCommand(#[from] mpsc::error::SendError<IssuesCommand>),
    #[error("Error parsing issues from D-Bus: {0}")]
    InvalidIssue(#[from] zbus::zvariant::Error),
    #[error("Error reading the issues: {0}")]
    DBus(#[from] zbus::Error),
    #[error("Invalid D-Bus name: {0}")]
    DBusName(#[from] zbus::names::Error),
    #[error("Could not send the event: {0}")]
    SendEvent(#[from] broadcast::error::SendError<Event>),
}

#[derive(Debug)]
pub enum IssuesCommand {
    Get(String, String, oneshot::Sender<Vec<Issue>>),
}

/// Implements a Tokio task that holds the issues for each service.
pub struct IssuesService {
    cache: HashMap<String, Vec<Issue>>,
    commands: mpsc::Receiver<IssuesCommand>,
    events: EventsSender,
    dbus: zbus::Connection,
}

impl IssuesService {
    /// Sets up and starts the service as a Tokio task.
    ///
    /// Once it is started, the service waits for:
    ///
    /// * Commands from a client ([IssuesClient]).
    /// * Relevant events from D-Bus.
    pub async fn start(dbus: zbus::Connection, events: EventsSender) -> IssuesClient {
        let (tx, rx) = mpsc::channel(4);
        let mut service = IssuesService {
            cache: HashMap::new(),
            dbus,
            events,
            commands: rx,
        };

        tokio::spawn(async move {
            if let Err(e) = service.run().await {
                tracing::error!("Could not start the issues service: {e:?}")
            }
        });
        IssuesClient(tx)
    }

    /// Main loop of the service.
    async fn run(&mut self) -> IssuesServiceResult<()> {
        let mut messages = build_properties_changed_stream(&self.dbus).await?;
        loop {
            tokio::select! {
                Some(cmd) = self.commands.recv() => {
                    if let Err(e) = self.handle_command(cmd).await {
                        tracing::error!("{e}");
                    }
                }

                Some(Ok(message)) = messages.next() => {
                    if let Some(changed) = PropertiesChanged::from_message(message) {
                        if let Err(e) = self.handle_property_changed(changed) {
                            tracing::error!("IssuesService: could not handle change: {:?}", e);
                        }
                    }
                }
            }
        }
    }

    /// Handles commands from the client.
    async fn handle_command(&mut self, command: IssuesCommand) -> IssuesServiceResult<()> {
        match command {
            IssuesCommand::Get(service, path, tx) => {
                let issues = self.get(&service, &path).await?;
                tx.send(issues)
                    .map_err(|_| IssuesServiceError::SendIssues)?;
            }
        }

        Ok(())
    }

    /// Handles PropertiesChanged events.
    ///
    /// It reports an error if something went work. If the message was processed or skipped
    /// it returns Ok(()).
    fn handle_property_changed(&mut self, message: PropertiesChanged) -> IssuesServiceResult<()> {
        let args = message.args()?;
        let inner = message.message();
        let header = inner.header();

        // We are neither interested on this message...
        let Some(path) = header.path() else {
            return Ok(());
        };

        // nor on this...
        if args.interface_name.as_str() != "org.opensuse.Agama1.Issues" {
            return Ok(());
        }

        // nor on this one.
        let Some(all) = args.changed_properties().get("All") else {
            return Ok(());
        };

        let all = all.downcast_ref::<&Array>()?;
        let issues = all
            .into_iter()
            .map(Issue::try_from)
            .collect::<Result<Vec<_>, _>>()?;

        self.cache.insert(path.to_string(), issues.clone());

        let event = event!(IssuesChanged {
            path: path.to_string(),
            issues,
        });
        self.events.send(event)?;
        Ok(())
    }

    /// Gets the issues for a given D-Bus service and path.
    ///
    /// This method uses a cache to store the values. If the value is not in the cache,
    /// it asks the D-Bus service about the issues (and cache them).
    ///
    /// * `service`: D-Bus service to connect to.
    /// * `path`: path of the D-Bus object implementing the
    ///   "org.opensuse.Agama1.Issues" interface.
    async fn get(&mut self, service: &str, path: &str) -> IssuesServiceResult<Vec<Issue>> {
        if let Some(issues) = self.cache.get(path) {
            return Ok(issues.clone());
        }

        let bus = BusName::try_from(service.to_string())?;
        let path = OwnedObjectPath::try_from(path)?;
        let output = self
            .dbus
            .call_method(
                Some(&bus),
                &path,
                Some("org.freedesktop.DBus.Properties"),
                "Get",
                &("org.opensuse.Agama1.Issues", "All"),
            )
            .await?;

        let body = output.body();
        let body: zbus::zvariant::Value = body.deserialize()?;
        let body = body.downcast_ref::<&Array>()?;
        let issues = body
            .into_iter()
            .map(Issue::try_from)
            .collect::<Result<Vec<_>, _>>()?;

        self.cache.insert(path.to_string(), issues.clone());
        Ok(issues)
    }
}

/// It allows querying the [IssuesService].
///
/// It is cheap to clone the client and use it from several
/// places.
#[derive(Clone)]
pub struct IssuesClient(mpsc::Sender<IssuesCommand>);

impl IssuesClient {
    /// Get the issues for the given D-Bus service and path.
    pub async fn get(&self, service: &str, path: &str) -> IssuesServiceResult<Vec<Issue>> {
        let (tx, rx) = oneshot::channel();
        self.0
            .send(IssuesCommand::Get(
                service.to_string(),
                path.to_string(),
                tx,
            ))
            .await?;
        Ok(rx.await?)
    }
}

/// It allows building an Axum router for the issues service.
pub struct IssuesRouterBuilder {
    service: String,
    path: String,
    client: IssuesClient,
}

impl IssuesRouterBuilder {
    /// Creates a new builder.
    ///
    /// * `service`: D-Bus service to connect to.
    /// * `path`: path of the D-Bus object implementing the
    ///   "org.opensuse.Agama1.Issues" interface.
    /// * `client`: client to access the issues.
    pub fn new(service: &str, path: &str, client: IssuesClient) -> Self {
        IssuesRouterBuilder {
            service: service.to_string(),
            path: path.to_string(),
            client,
        }
    }

    /// Builds the Axum router.
    pub fn build<T>(self) -> Result<Router<T>, crate::error::Error> {
        let state = IssuesState {
            service: self.service,
            path: self.path,
            client: self.client,
        };

        Ok(Router::new()
            .route("/", get(Self::issues))
            .with_state(state))
    }

    /// Handler of the GET /issues endpoint.
    async fn issues(
        State(state): State<IssuesState>,
    ) -> Result<Json<Vec<Issue>>, crate::error::Error> {
        let issues = state.client.get(&state.service, &state.path).await?;
        Ok(Json(issues))
    }
}

/// State for the router.
#[derive(Clone)]
struct IssuesState {
    service: String,
    path: String,
    client: IssuesClient,
}
