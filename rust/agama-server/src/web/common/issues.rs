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
//! * (Not implemented yet) Emitting `IssuesChanged` events, replacing
//!   [issues_stream](crate::web::common::issues_stream).
//!
//! The following components are included:
//!
//! * [IssuesService] that runs on a separate task to hold the status.
//! * [IssuesClient] that allows querying the [IssuesService] server about the
//!   issues.
//! * [IssuesRouter] which allows building a router, replacing
//!   [issues_router](crate::web::common::issues_router).
//!
//! At this point, it only handles the issues that are exposed through D-Bus.

use agama_lib::issue::Issue;
use agama_utils::dbus::build_properties_changed_stream;
use axum::{extract::State, routing::get, Json, Router};
use std::collections::HashMap;
use tokio::sync::{mpsc, oneshot};
use tokio_stream::StreamExt;
use zbus::{
    fdo::PropertiesChanged,
    names::BusName,
    zvariant::{Array, OwnedObjectPath},
};

#[derive(Debug)]
enum IssuesCommand {
    Get(String, String, oneshot::Sender<Vec<Issue>>),
}

/// Implements a Tokio task that holds the issues for each service.
pub struct IssuesService {
    issues: HashMap<String, Vec<Issue>>,
    commands: mpsc::Receiver<IssuesCommand>,
    dbus: zbus::Connection,
}

impl IssuesService {
    /// Sets up and starts the service as a Tokio task.
    ///
    /// Once it is started, the service waits for:
    ///
    /// * Commands from a client ([IssuesClient]).
    /// * Relevant events from D-Bus.
    pub async fn start(dbus: zbus::Connection) -> IssuesClient {
        let (tx, rx) = mpsc::channel(16);
        let mut service = IssuesService {
            issues: HashMap::new(),
            dbus,
            commands: rx,
        };

        tokio::spawn(async move { service.run().await });
        IssuesClient(tx)
    }

    /// Main loop of the service.
    async fn run(&mut self) {
        let mut messages = build_properties_changed_stream(&self.dbus).await.unwrap();
        loop {
            tokio::select! {
                Some(cmd) = self.commands.recv() => {
                    self.handle_command(cmd).await;
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
    async fn handle_command(&mut self, command: IssuesCommand) {
        match command {
            IssuesCommand::Get(service, path, tx) => {
                let issues = self.get(&service, &path).await.unwrap();
                tx.send(issues).unwrap();
            }
        }
    }

    /// Handles PropertiesChanged events.
    fn handle_property_changed(&mut self, message: PropertiesChanged) -> zbus::Result<()> {
        let args = message.args()?;
        let inner = message.message();
        let header = inner.header();
        let Some(path) = header.path() else {
            return Ok(());
        };

        // Only process Agama issues signals.
        if args.interface_name.as_str() != "org.opensuse.Agama1.Issues" {
            return Ok(());
        }

        let Some(all) = args.changed_properties().get("All") else {
            return Ok(());
        };

        let all = all.downcast_ref::<&Array>()?;
        let issues = all
            .into_iter()
            .map(Issue::try_from)
            .collect::<Result<Vec<_>, _>>()?;

        self.issues.insert(path.to_string(), issues);

        // TODO: ideally we should emit the issues changes from here.
        // self.events_tx.send...
        Ok(())
    }

    /// Gets the issues for a given D-Bus service and path.
    async fn get(&mut self, service: &str, path: &str) -> zbus::Result<Vec<Issue>> {
        if let Some(issues) = self.issues.get(path) {
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

        self.issues.insert(path.to_string(), issues.clone());
        Ok(issues)
    }
}

/// It allows querying the [IssuesService].o
///
/// It is cheap to clone the client and use it from several
/// places.
#[derive(Clone)]
pub struct IssuesClient(mpsc::Sender<IssuesCommand>);

impl IssuesClient {
    /// Get the issues for the given D-Bus service and path.
    pub async fn get(&self, service: &str, path: &str) -> Option<Vec<Issue>> {
        let (tx, rx) = oneshot::channel();
        self.0
            .send(IssuesCommand::Get(
                service.to_string(),
                path.to_string(),
                tx,
            ))
            .await
            .unwrap();
        Some(rx.await.unwrap())
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
        let issues = state.client.get(&state.service, &state.path).await.unwrap();
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
