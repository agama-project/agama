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

use crate::{
    monitor::{self, Monitor},
    service::{self, Service},
};
use agama_utils::{
    actor::{self, Handler},
    api::event,
    issue, progress,
};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Monitor(#[from] monitor::Error),
    #[error(transparent)]
    Service(#[from] service::Error),
}

/// Starts the storage service.
pub async fn start(
    progress: Handler<progress::Service>,
    issues: Handler<issue::Service>,
    events: event::Sender,
    dbus: zbus::Connection,
) -> Result<Handler<Service>, Error> {
    let service = Service::new(issues.clone(), dbus.clone()).setup().await?;
    let handler = actor::spawn(service);

    let monitor = Monitor::new(handler.clone(), progress, issues, events, dbus);
    monitor::spawn(monitor)?;

    Ok(handler)
}
