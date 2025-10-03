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

use crate::{actor::Handler, dbus::build_properties_changed_stream};

use super::{message, model, Issue, Service};
use tokio_stream::StreamExt;
use zbus::fdo::PropertiesChanged;
use zbus::names::BusName;
use zbus::zvariant::Array;
use zvariant::OwnedObjectPath;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    DBus(#[from] zbus::Error),
    #[error("Error parsing issues from D-Bus: {0}")]
    InvalidIssue(#[from] zbus::zvariant::Error),
    #[error("Invalid D-Bus name")]
    InvalidDBusName(#[from] zbus::names::Error),
    #[error(transparent)]
    Model(#[from] model::Error),
}

/// Listens the D-Bus server and updates the list of issues.
pub struct Monitor {
    handler: Handler<Service>,
    dbus: zbus::Connection,
}

const MANAGER_SERVICE: &str = "org.opensuse.Agama.Manager1";
const SOFTWARE_SERVICE: &str = "org.opensuse.Agama.Software1";
const STORAGE_SERVICE: &str = "org.opensuse.Agama.Storage1";

const ISCSI_PATH: &str = "/org/opensuse/Agama/Storage1/ISCSI";
const PRODUCT_PATH: &str = "/org/opensuse/Agama/Software1/Product";
const SOFTWARE_PATH: &str = "/org/opensuse/Agama/Software1";
const STORAGE_PATH: &str = "/org/opensuse/Agama/Storage1";
const USERS_PATH: &str = "/org/opensuse/Agama/Users1";

impl Monitor {
    pub fn new(handler: Handler<Service>, dbus: zbus::Connection) -> Self {
        Self { handler, dbus }
    }

    pub async fn run(&self) -> Result<(), Error> {
        let mut messages = build_properties_changed_stream(&self.dbus).await?;

        self.initialize_issues(MANAGER_SERVICE, USERS_PATH).await?;
        self.initialize_issues(SOFTWARE_SERVICE, SOFTWARE_PATH)
            .await?;
        self.initialize_issues(SOFTWARE_SERVICE, PRODUCT_PATH)
            .await?;
        self.initialize_issues(STORAGE_SERVICE, STORAGE_PATH)
            .await?;
        self.initialize_issues(STORAGE_SERVICE, ISCSI_PATH).await?;

        while let Some(Ok(message)) = messages.next().await {
            if let Some(changed) = PropertiesChanged::from_message(message) {
                if let Err(e) = self.handle_property_changed(changed) {
                    println!("Could not handle issues change: {:?}", e);
                }
            }
        }

        Ok(())
    }

    /// Handles PropertiesChanged events.
    ///
    /// It reports an error if something went work. If the message was processed or skipped
    /// it returns Ok(()).
    fn handle_property_changed(&self, message: PropertiesChanged) -> Result<(), Error> {
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

        self.update_issues(path.as_str(), issues, true);

        Ok(())
    }

    /// Initializes the list of issues reading the list from D-Bus.
    ///
    /// * `service`: service name.
    /// * `path`: path of the object implementing issues interface.
    async fn initialize_issues(&self, service: &str, path: &str) -> Result<(), Error> {
        let bus = BusName::try_from(service.to_string())?;
        let dbus_path = OwnedObjectPath::try_from(path)?;
        let output = self
            .dbus
            .call_method(
                Some(&bus),
                &dbus_path,
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
        self.update_issues(path, issues, false);

        Ok(())
    }

    /// Updates the list of issues.
    fn update_issues(&self, path: &str, issues: Vec<Issue>, notify: bool) {
        match Self::list_id_from_path(path) {
            Some(list) => {
                _ = self
                    .handler
                    .cast(message::Update::new(list, issues).notify(notify));
            }
            None => {
                eprintln!("Unknown issues object {}", path);
            }
        }
    }

    fn list_id_from_path(path: &str) -> Option<&'static str> {
        match path {
            SOFTWARE_PATH => Some("software"),
            PRODUCT_PATH => Some("product"),
            STORAGE_PATH => Some("storage"),
            USERS_PATH => Some("users"),
            ISCSI_PATH => Some("iscsi"),
            _ => None,
        }
    }
}
