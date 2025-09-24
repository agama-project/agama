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

mod error;
pub use error::Error;

mod event;
pub use event::EventsListener;

pub mod handler;
pub use handler::Handler;

mod service;
pub use service::{Action, Message, Service};

mod system_info;
pub use system_info::SystemInfo;

mod proposal;
pub use proposal::Proposal;

mod scope;
pub use scope::{Scope, ScopeConfig};

use crate::web::EventsSender;
use agama_l10n as l10n;
use agama_utils::Service as _;
use tokio::sync::mpsc;

/// Starts the supervisor service.
///
/// It starts two Tokio tasks:
///
/// * The main service, called "Supervisor", which coordinates the rest of services
///   an entry point for the HTTP API.
/// * An events listener which retransmit the events from all the services.
///
/// It receives the following argument:
///
/// * `events`: channel to emit the [events](agama_lib::http::Event).
pub async fn start_service(events: EventsSender) -> Result<Handler, Error> {
    let mut listener = EventsListener::new(events);
    let (events_sender, events_receiver) = mpsc::unbounded_channel::<l10n::Event>();
    let l10n = l10n::start_service(events_sender).await?;
    listener.add_channel("l10n", events_receiver);
    tokio::spawn(async move {
        listener.run().await;
    });

    let (sender, receiver) = mpsc::unbounded_channel();
    let mut service = Service::new(l10n, receiver);
    tokio::spawn(async move {
        service.run().await;
    });

    Ok(Handler::new(sender))
}
