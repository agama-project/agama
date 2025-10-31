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
    model::Model,
    service::{self, Service},
    zypp_server::{ZyppServer, ZyppServerError},
};
use agama_utils::{
    actor::{self, Handler},
    api::event,
    issue,
};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Service(#[from] service::Error),
    #[error(transparent)]
    ZyppError(#[from] ZyppServerError),
}

/// Starts the localization service.
///
/// It starts two Tokio tasks:
///
/// - The main service, which is reponsible for holding and applying the configuration.
/// - zypp thread for tasks which needs libzypp
/// - It depends on the issues service to keep the installation issues.
///
/// * `events`: channel to emit the [localization-specific events](crate::Event).
/// * `issues`: handler to the issues service.
pub async fn start(
    issues: Handler<issue::Service>,
    events: event::Sender,
) -> Result<Handler<Service>, Error> {
    let zypp_sender = ZyppServer::start()?;
    let model = Model::new(zypp_sender)?;
    let mut service = Service::new(model, issues, events);
    service.read().await?;
    let handler = actor::spawn(service);
    Ok(handler)
}
