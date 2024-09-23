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

use std::{collections::HashMap, task::Poll};

use agama_lib::{
    dbus::{extract_id_from_path, get_optional_property},
    error::ServiceError,
    property_from_dbus,
    storage::{ISCSIClient, ISCSINode},
};
use futures_util::{ready, Stream};
use pin_project::pin_project;
use thiserror::Error;
use tokio::sync::mpsc::unbounded_channel;
use tokio_stream::{wrappers::UnboundedReceiverStream, StreamExt};
use zbus::zvariant::{ObjectPath, OwnedObjectPath, OwnedValue};

use crate::{
    dbus::{DBusObjectChange, DBusObjectChangesStream, ObjectsCache},
    web::Event,
};

/// This stream listens for changes in the collection ISCSI nodes and emits
/// the updated objects.
///
/// It relies on the [DBusObjectChangesStream] stream and uses a cache to avoid holding a bunch of
/// proxy objects.
#[pin_project]
pub struct ISCSINodeStream {
    dbus: zbus::Connection,
    cache: ObjectsCache<ISCSINode>,
    #[pin]
    inner: UnboundedReceiverStream<DBusObjectChange>,
}

/// Internal stream error
#[derive(Debug, Error)]
enum ISCSINodeStreamError {
    #[error("Service error: {0}")]
    Service(#[from] ServiceError),
    #[error("Unknown ISCSI node: {0}")]
    UnknownNode(OwnedObjectPath),
}

impl ISCSINodeStream {
    /// Creates a new stream.
    ///
    /// * `dbus`: D-Bus connection to listen on.
    pub async fn new(dbus: &zbus::Connection) -> Result<Self, ServiceError> {
        const MANAGER_PATH: &str = "/org/opensuse/Agama/Storage1";
        const NAMESPACE: &str = "/org/opensuse/Agama/Storage1/iscsi_nodes";

        let (tx, rx) = unbounded_channel();
        let mut stream = DBusObjectChangesStream::new(
            dbus,
            &ObjectPath::from_str_unchecked(MANAGER_PATH),
            &ObjectPath::from_str_unchecked(NAMESPACE),
            "org.opensuse.Agama.Storage1.ISCSI.Node",
        )
        .await?;

        tokio::spawn(async move {
            while let Some(change) = stream.next().await {
                let _ = tx.send(change);
            }
        });
        let rx = UnboundedReceiverStream::new(rx);

        //  Populate the objects cache
        let mut cache: ObjectsCache<ISCSINode> = Default::default();
        let client = ISCSIClient::new(dbus.clone()).await?;
        for node in client.get_nodes().await? {
            let path = ObjectPath::from_string_unchecked(format!("{}/{}", NAMESPACE, node.id));
            cache.add(path.into(), node);
        }

        Ok(Self {
            dbus: dbus.clone(),
            cache,
            inner: rx,
        })
    }

    fn update_node<'a>(
        cache: &'a mut ObjectsCache<ISCSINode>,
        path: &OwnedObjectPath,
        values: &HashMap<String, OwnedValue>,
    ) -> Result<&'a ISCSINode, ServiceError> {
        let node = cache.find_or_create(path);
        node.id = extract_id_from_path(path)?;
        property_from_dbus!(node, target, "Target", values, str);
        property_from_dbus!(node, address, "Address", values, str);
        property_from_dbus!(node, interface, "Interface", values, str);
        property_from_dbus!(node, startup, "Startup", values, str);
        property_from_dbus!(node, port, "Port", values, u32);
        property_from_dbus!(node, connected, "Connected", values, bool);
        Ok(node)
    }

    fn remove_node(
        cache: &mut ObjectsCache<ISCSINode>,
        path: &OwnedObjectPath,
    ) -> Result<ISCSINode, ISCSINodeStreamError> {
        cache
            .remove(path)
            .ok_or_else(|| ISCSINodeStreamError::UnknownNode(path.clone()))
    }

    fn handle_change(
        cache: &mut ObjectsCache<ISCSINode>,
        change: &DBusObjectChange,
    ) -> Result<Event, ISCSINodeStreamError> {
        match change {
            DBusObjectChange::Added(path, values) => {
                let node = Self::update_node(cache, path, values)?;
                Ok(Event::ISCSINodeAdded { node: node.clone() })
            }
            DBusObjectChange::Changed(path, updated) => {
                let node = Self::update_node(cache, path, updated)?;
                Ok(Event::ISCSINodeChanged { node: node.clone() })
            }
            DBusObjectChange::Removed(path) => {
                let node = Self::remove_node(cache, path)?;
                Ok(Event::ISCSINodeRemoved { node })
            }
        }
    }
}

impl Stream for ISCSINodeStream {
    type Item = Event;

    fn poll_next(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Option<Self::Item>> {
        let mut pinned = self.project();

        Poll::Ready(loop {
            let change = ready!(pinned.inner.as_mut().poll_next(cx));
            let next_value = match change {
                Some(change) => {
                    if let Ok(event) = Self::handle_change(pinned.cache, &change) {
                        Some(event)
                    } else {
                        log::warn!("Could not process change {:?}", &change);
                        None
                    }
                }
                None => break None,
            };
            if next_value.is_some() {
                break next_value;
            }
        })
    }
}
