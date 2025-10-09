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

use crate::web::EventsSender;
use agama_lib::http::{Event, EventPayload};
use std::pin::Pin;
use tokio::sync::mpsc;
use tokio_stream::{wrappers::UnboundedReceiverStream, Stream, StreamExt, StreamMap};

/// Listens for events of each service and retransmit them over the websocket.
///
/// The events from each service comes in their own types (e.g.,
/// `agama_l10n::Event`) and has to be converted to the [Event
/// struct](agama_lib::http::Event).
pub struct EventsListener {
    inner: StreamMap<&'static str, Pin<Box<dyn Stream<Item = Event> + Send>>>,
    sender: EventsSender,
}

impl EventsListener {
    pub fn new(sender: EventsSender) -> Self {
        EventsListener {
            inner: StreamMap::new(),
            sender,
        }
    }

    pub fn add_channel<T: 'static + Send>(
        &mut self,
        name: &'static str,
        channel: mpsc::UnboundedReceiver<T>,
    ) where
        EventPayload: From<T>,
    {
        let stream =
            UnboundedReceiverStream::new(channel).map(|e| Event::new(EventPayload::from(e)));
        self.inner.insert(name, Box::pin(stream));
    }

    pub async fn run(self) {
        let mut stream = self.inner;
        while let Some((_, event)) = stream.next().await {
            if let Err(e) = self.sender.send(event) {
                tracing::error!("Could no retransmit the event: {e}");
            };
        }
    }
}

/// Spawns a Tokio task for the listener.
///
/// * `listener`: listener to spawn.
pub fn spawn(listener: EventsListener) {
    tokio::spawn(async move {
        listener.run().await;
    });
}
