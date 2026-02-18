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
use zbus::{
    fdo::{InterfacesAdded, InterfacesRemoved, PropertiesChanged},
    names::InterfaceName,
    zvariant::OwnedObjectPath,
    Message, MessageStream,
};

use crate::nm::error::NmError;

use super::{
    common::{build_added_and_removed_stream, build_properties_changed_stream},
    NmChange,
};

/// Stream of connection settings state changes
///
/// This stream listens for connections settings state changes and converts
/// them into [ConnectionSettingsStateChange] events
#[pin_project]
pub struct ConnectionSettingsChangedStream {
    connection: zbus::Connection,
    #[pin]
    inner: StreamMap<&'static str, MessageStream>,
}

impl ConnectionSettingsChangedStream {
    /// Builds a new stream using the given D-Bus connection.
    ///
    /// * `connection`: D-Bus connection.
    pub async fn new(connection: &zbus::Connection) -> Result<Self, NmError> {
        let connection = connection.clone();
        let mut inner = StreamMap::new();
        inner.insert(
            "object_manager",
            build_added_and_removed_stream(&connection).await?,
        );
        inner.insert(
            "properties",
            build_properties_changed_stream(&connection).await?,
        );
        Ok(Self { connection, inner })
    }

    fn handle_added(message: InterfacesAdded) -> Option<NmChange> {
        let args = message.args().ok()?;
        let interfaces: Vec<String> = args
            .interfaces_and_properties()
            .keys()
            .map(|i| i.to_string())
            .collect();

        if interfaces.contains(&"org.freedesktop.NetworkManager.Settings.Connection".to_string()) {
            let path = OwnedObjectPath::from(args.object_path().clone());
            tracing::info!("Connection added {}", path);
            return Some(NmChange::ConnectionAdded(path));
        }

        None
    }

    fn handle_removed(message: InterfacesRemoved) -> Option<NmChange> {
        let args = message.args().ok()?;

        let interface =
            InterfaceName::from_str_unchecked("org.freedesktop.NetworkManager.Settings.Connection");
        if args.interfaces.contains(&interface) {
            let path = OwnedObjectPath::from(args.object_path().clone());
            tracing::info!("Connection removed {}", path);
            return Some(NmChange::ConnectionRemoved(path));
        }

        None
    }

    fn handle_changed(message: PropertiesChanged) -> Option<NmChange> {
        let args = message.args().ok()?;
        let inner = message.message();
        let path = OwnedObjectPath::from(inner.header().path()?.to_owned());

        if args.interface_name.as_str() == "org.freedesktop.NetworkManager.Settings.Connection" {
            tracing::info!("Connection updated {}", path);
        }

        None
    }

    fn handle_message(message: Result<Message, zbus::Error>) -> Option<NmChange> {
        let Ok(message) = message else {
            return None;
        };

        if let Some(added) = InterfacesAdded::from_message(message.clone()) {
            return Self::handle_added(added);
        }

        if let Some(removed) = InterfacesRemoved::from_message(message.clone()) {
            return Self::handle_removed(removed);
        }

        if let Some(changed) = PropertiesChanged::from_message(message.clone()) {
            return Self::handle_changed(changed);
        }

        None
    }
}

/// Stream of active connections state changes.
///
/// This stream listens for active connection state changes and converts
/// them into [ConnectionStateChange] events.
///
/// It is implemented as a struct because it needs to keep the ProxiesRegistry alive.
#[pin_project]
pub struct ActiveConnectionChangedStream {
    connection: zbus::Connection,
    #[pin]
    inner: StreamMap<&'static str, MessageStream>,
}

impl ActiveConnectionChangedStream {
    /// Builds a new stream using the given D-Bus connection.
    ///
    /// * `connection`: D-Bus connection.
    pub async fn new(connection: &zbus::Connection) -> Result<Self, NmError> {
        let connection = connection.clone();
        let mut inner = StreamMap::new();
        inner.insert(
            "object_manager",
            build_added_and_removed_stream(&connection).await?,
        );
        inner.insert(
            "properties",
            build_properties_changed_stream(&connection).await?,
        );
        Ok(Self { connection, inner })
    }

    fn handle_added(message: InterfacesAdded) -> Option<NmChange> {
        let args = message.args().ok()?;
        let interfaces: Vec<String> = args
            .interfaces_and_properties()
            .keys()
            .map(|i| i.to_string())
            .collect();

        if interfaces.contains(&"org.freedesktop.NetworkManager.Connection.Active".to_string()) {
            let path = OwnedObjectPath::from(args.object_path().clone());
            return Some(NmChange::ActiveConnectionAdded(path));
        }

        None
    }

    fn handle_removed(message: InterfacesRemoved) -> Option<NmChange> {
        let args = message.args().ok()?;

        let interface =
            InterfaceName::from_str_unchecked("org.freedesktop.NetworkManager.Connection.Active");
        if args.interfaces.contains(&interface) {
            let path = OwnedObjectPath::from(args.object_path().clone());
            return Some(NmChange::ActiveConnectionRemoved(path));
        }

        None
    }

    fn handle_changed(message: PropertiesChanged) -> Option<NmChange> {
        let args = message.args().ok()?;
        let inner = message.message();
        let path = OwnedObjectPath::from(inner.header().path()?.to_owned());

        if args.interface_name.as_str() == "org.freedesktop.NetworkManager.Connection.Active" {
            return Some(NmChange::ActiveConnectionUpdated(path));
        }

        None
    }

    fn handle_message(message: Result<Message, zbus::Error>) -> Option<NmChange> {
        let Ok(message) = message else {
            return None;
        };

        if let Some(added) = InterfacesAdded::from_message(message.clone()) {
            return Self::handle_added(added);
        }

        if let Some(removed) = InterfacesRemoved::from_message(message.clone()) {
            return Self::handle_removed(removed);
        }

        if let Some(changed) = PropertiesChanged::from_message(message.clone()) {
            return Self::handle_changed(changed);
        }

        None
    }
}

impl Stream for ActiveConnectionChangedStream {
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

impl Stream for ConnectionSettingsChangedStream {
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
