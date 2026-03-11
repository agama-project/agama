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

use futures_util::ready;
use pin_project::pin_project;
use std::{
    pin::Pin,
    task::{Context, Poll},
};
use tokio_stream::{Stream, StreamMap};
use zbus::{fdo::PropertiesChanged, Message, MessageStream};

use super::common::{build_properties_changed_stream, NmChange};
use crate::nm::error::NmError;

/// Stream of general state changes.
///
/// This stream listens for NetworkManager general state changes (connectivity,
/// wireless enabled, etc.) and converts them into [NmChange::GeneralStateChanged].
#[pin_project]
pub struct GeneralStateChangedStream {
    #[pin]
    inner: StreamMap<&'static str, MessageStream>,
}

impl GeneralStateChangedStream {
    /// Builds a new stream using the given D-Bus connection.
    ///
    /// * `connection`: D-Bus connection.
    pub async fn new(connection: &zbus::Connection) -> Result<Self, NmError> {
        let mut inner = StreamMap::new();
        inner.insert(
            "properties",
            build_properties_changed_stream(connection).await?,
        );
        Ok(Self { inner })
    }

    fn handle_changed(message: PropertiesChanged) -> Option<NmChange> {
        const GENERAL_PROPS: &[&str] = &["Connectivity", "WirelessEnabled"];

        let args = message.args().ok()?;
        let inner = message.message();
        let path = inner.header().path()?.to_owned();

        if path.as_str() == "/org/freedesktop/NetworkManager"
            && args.interface_name.as_str() == "org.freedesktop.NetworkManager"
        {
            let properties: Vec<_> = args.changed_properties.keys().collect();
            if GENERAL_PROPS.iter().any(|i| properties.contains(&i)) {
                return Some(NmChange::GeneralStateChanged);
            }
        }
        None
    }

    fn handle_message(message: Result<Message, zbus::Error>) -> Option<NmChange> {
        let Ok(message) = message else {
            return None;
        };

        if let Some(changed) = PropertiesChanged::from_message(message.clone()) {
            return Self::handle_changed(changed);
        }

        None
    }
}

impl Stream for GeneralStateChangedStream {
    type Item = NmChange;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let mut pinned = self.project();
        Poll::Ready(loop {
            let item = ready!(pinned.inner.as_mut().poll_next(cx));
            let next_value = match item {
                Some((_, message)) => Self::handle_message(message),
                _ => None,
            };
            if next_value.is_some() {
                break next_value;
            }
        })
    }
}
