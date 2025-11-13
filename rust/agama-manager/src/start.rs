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

use crate::{l10n, network, service::Service, software, storage};
use agama_utils::{
    actor::{self, Handler},
    api::event,
    issue, progress, question,
};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Progress(#[from] progress::start::Error),
    #[error(transparent)]
    L10n(#[from] l10n::start::Error),
    #[error(transparent)]
    Manager(#[from] crate::service::Error),
    #[error(transparent)]
    Network(#[from] network::start::Error),
    #[error(transparent)]
    Software(#[from] software::start::Error),
    #[error(transparent)]
    Storage(#[from] storage::start::Error),
    #[error(transparent)]
    Issues(#[from] issue::start::Error),
}

/// Starts the manager service.
///
/// * `events`: channel to emit the [events](agama_utils::Event).
/// * `dbus`: connection to Agama's D-Bus server. If it is not given, those features
///           that require to connect to the Agama's D-Bus server won't work.
pub async fn start(
    questions: Handler<question::Service>,
    events: event::Sender,
    dbus: zbus::Connection,
) -> Result<Handler<Service>, Error> {
    let issues = issue::start(events.clone(), dbus.clone()).await?;
    let progress = progress::start(events.clone()).await?;
    let l10n = l10n::start(issues.clone(), events.clone()).await?;
    let network = network::start().await?;
    let software = software::start(issues.clone(), progress.clone(), events.clone()).await?;
    let storage = storage::start(progress.clone(), issues.clone(), events.clone(), dbus).await?;

    let mut service = Service::new(
        l10n,
        network,
        software,
        storage,
        issues,
        progress,
        questions,
        events.clone(),
    );
    service.setup().await?;

    let handler = actor::spawn(service);
    Ok(handler)
}
