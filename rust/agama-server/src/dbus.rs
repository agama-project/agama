// Copyright (c) [2024] SUSE LLC
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

//! This module defines some reusable functions/structs related to D-Bus that might be useful when
//! implementing agama-server features.

use std::{
    collections::{hash_map::Entry, HashMap},
    pin::Pin,
    sync::Arc,
    task::{Context, Poll},
};

use agama_lib::{dbus::to_owned_hash, error::ServiceError};
use futures_util::{ready, Stream};
use pin_project::pin_project;
use tokio_stream::StreamMap;
use zbus::{
    fdo::{InterfacesAdded, InterfacesRemoved, PropertiesChanged},
    zvariant::{ObjectPath, OwnedObjectPath},
    MatchRule, Message, MessageStream, MessageType,
};

#[derive(Debug)]
pub enum DBusObjectChange {
    Added(OwnedObjectPath, HashMap<String, zbus::zvariant::OwnedValue>),
    Changed(OwnedObjectPath, HashMap<String, zbus::zvariant::OwnedValue>),
    Removed(OwnedObjectPath),
}

const PROPERTIES_CHANGED: &str = "properties_changed";
const OBJECTS_MANAGER: &str = "objects_manager";

/// This stream listens for changes in a collection of D-Bus objects and emits
/// an [DBusObjectChange] when an object is added, updated or removed. It is required
/// that the collection implements the ObjectManager interface.
///
/// Initially, it was intended to emit the proxy representing the object. However, as
/// retrieving the proxy is an async operation too, it might lead to a deadlock.
/// See the [zbus::MessageStream](https://docs.rs/zbus/4.2.0/zbus/struct.MessageStream.html)
/// and [issue#350](https://github.com/dbus2/zbus/issues/350).
///
/// TODO: allow filtering by multiple D-Bus interfaces and properties.
#[pin_project]
pub struct DBusObjectChangesStream {
    connection: zbus::Connection,
    manager_path: OwnedObjectPath,
    namespace: OwnedObjectPath,
    interface: String,
    #[pin]
    inner: StreamMap<&'static str, MessageStream>,
}

impl DBusObjectChangesStream {
    /// Creates a new stream.
    ///
    /// * `connection`: D-Bus connection to listen on.
    /// * `manager_path`: D-Bus path of the object implementing the ObjectManager.
    /// * `namespace`: namespace to watch (corresponds to a "path_namespace" in the MatchRule).
    /// * `interface`: name of the interface to watch.
    pub async fn new(
        connection: &zbus::Connection,
        manager_path: &ObjectPath<'_>,
        namespace: &ObjectPath<'_>,
        interface: &str,
    ) -> Result<Self, ServiceError> {
        let manager_path = OwnedObjectPath::from(manager_path.to_owned());
        let namespace = OwnedObjectPath::from(namespace.to_owned());
        let connection = connection.clone();
        let mut inner = StreamMap::new();
        inner.insert(
            OBJECTS_MANAGER,
            Self::build_added_and_removed_stream(&connection, &manager_path).await?,
        );
        inner.insert(
            PROPERTIES_CHANGED,
            Self::build_properties_changed_stream(&connection, &namespace).await?,
        );

        Ok(Self {
            connection,
            manager_path,
            namespace,
            interface: interface.to_string(),
            inner,
        })
    }

    /// Handles the case where a property changes.
    ///
    /// * message: property change message.
    /// * interface: name of the interface to watch.
    fn handle_properties_changed(
        message: Result<Arc<Message>, zbus::Error>,
        interface: &str,
    ) -> Option<DBusObjectChange> {
        let Ok(message) = message else {
            return None;
        };
        let properties = PropertiesChanged::from_message(message)?;
        let args = properties.args().ok()?;

        if args.interface_name.as_str() == interface {
            let path = OwnedObjectPath::from(properties.path().unwrap().clone());
            let data = to_owned_hash(&args.changed_properties);
            Some(DBusObjectChange::Changed(path, data))
        } else {
            None
        }
    }

    /// Handles the addition or removal of an object.
    ///
    /// * message: add/remove message.
    /// * interface: name of the interface to watch.
    fn handle_added_or_removed(
        message: Result<Arc<Message>, zbus::Error>,
        interface: &str,
    ) -> Option<DBusObjectChange> {
        let Ok(message) = message else {
            return None;
        };

        if let Some(added) = InterfacesAdded::from_message(message.clone()) {
            let args = added.args().ok()?;
            let data = args.interfaces_and_properties.get(&interface)?;
            let data = to_owned_hash(data);
            let path = OwnedObjectPath::from(args.object_path().clone());
            return Some(DBusObjectChange::Added(path, data));
        }

        if let Some(removed) = InterfacesRemoved::from_message(message) {
            let args = removed.args().ok()?;
            if args.interfaces.contains(&interface) {
                let path = OwnedObjectPath::from(args.object_path().clone());
                return Some(DBusObjectChange::Removed(path));
            }
        }

        None
    }

    /// Builds a stream of added/removed objects within the collection.
    ///
    /// * `connection`: D-Bus connection.
    /// * `manager_path`: path of the object implementing the ObjectManager interface.
    async fn build_added_and_removed_stream(
        connection: &zbus::Connection,
        manager_path: &OwnedObjectPath,
    ) -> Result<MessageStream, ServiceError> {
        let rule = MatchRule::builder()
            .msg_type(MessageType::Signal)
            .path(manager_path.clone())?
            .interface("org.freedesktop.DBus.ObjectManager")?
            .build();
        let stream = MessageStream::for_match_rule(rule, connection, None).await?;
        Ok(stream)
    }

    /// Builds a stream of properties changed within the collection.
    ///
    /// * `connection`: D-Bus connection.
    /// * `namespace`: namespace to watch for.
    async fn build_properties_changed_stream(
        connection: &zbus::Connection,
        namespace: &OwnedObjectPath,
    ) -> Result<MessageStream, ServiceError> {
        let rule = MatchRule::builder()
            .msg_type(MessageType::Signal)
            .path_namespace(namespace.clone())?
            .interface("org.freedesktop.DBus.Properties")?
            .member("PropertiesChanged")?
            .build();
        let stream = MessageStream::for_match_rule(rule, connection, None).await?;
        Ok(stream)
    }
}

impl Stream for DBusObjectChangesStream {
    type Item = DBusObjectChange;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let mut pinned = self.project();
        Poll::Ready(loop {
            let item = ready!(pinned.inner.as_mut().poll_next(cx));
            let next_value = match item {
                Some((PROPERTIES_CHANGED, message)) => {
                    Self::handle_properties_changed(message, pinned.interface)
                }
                Some((OBJECTS_MANAGER, message)) => {
                    Self::handle_added_or_removed(message, pinned.interface)
                }
                _ => None,
            };
            if next_value.is_some() {
                break next_value;
            }
        })
    }
}

pub struct ObjectsCache<T> {
    objects: HashMap<OwnedObjectPath, T>,
}

impl<T> ObjectsCache<T>
where
    T: Default,
{
    pub fn add(&mut self, path: OwnedObjectPath, object: T) {
        _ = self.objects.insert(path, object)
    }

    pub fn find_or_create(&mut self, path: &OwnedObjectPath) -> &mut T {
        match self.objects.entry(path.clone()) {
            Entry::Vacant(entry) => entry.insert(T::default()),
            Entry::Occupied(entry) => entry.into_mut(),
        }
    }

    pub fn remove(&mut self, path: &OwnedObjectPath) -> Option<T> {
        self.objects.remove(path)
    }
}

impl<T> Default for ObjectsCache<T> {
    fn default() -> Self {
        Self {
            objects: HashMap::new(),
        }
    }
}
