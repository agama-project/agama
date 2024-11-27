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

// FIXME: the code is pretty similar to iscsi::stream. Refactor the stream to reduce the repetition.

use std::{collections::HashMap, task::Poll};

use agama_lib::{
    dbus::get_optional_property,
    error::ServiceError,
    property_from_dbus,
    storage::{
        client::dasd::DASDClient,
        model::dasd::{DASDDevice, DASDFormatSummary},
    },
};
use futures_util::{ready, Stream};
use pin_project::pin_project;
use thiserror::Error;
use tokio::sync::mpsc::unbounded_channel;
use tokio_stream::{wrappers::UnboundedReceiverStream, StreamExt};
use zbus::{
    fdo::{PropertiesChanged, PropertiesChangedArgs},
    message::Type as MessageType,
    zvariant::{self, ObjectPath, OwnedObjectPath, OwnedValue},
    MatchRule, Message, MessageStream,
};

use crate::{
    dbus::{DBusObjectChange, DBusObjectChangesStream, ObjectsCache},
    web::Event,
};

#[derive(Debug, Error)]
enum DASDDeviceStreamError {
    #[error("Service error: {0}")]
    Service(#[from] ServiceError),
    #[error("Unknown DASD device: {0}")]
    UnknownDevice(OwnedObjectPath),
}

/// This stream listens for changes in the collection of DASD devices and emits
/// the updated objects.
///
/// It relies on the [DBusObjectChangesStream] stream and uses a cache to avoid holding a bunch of
/// proxy objects.
#[pin_project]
pub struct DASDDeviceStream {
    dbus: zbus::Connection,
    cache: ObjectsCache<DASDDevice>,
    #[pin]
    inner: UnboundedReceiverStream<DBusObjectChange>,
}

impl DASDDeviceStream {
    /// Creates a new stream
    ///
    /// * `dbus`: D-Bus connection to listen on.
    pub async fn new(dbus: &zbus::Connection) -> Result<Self, ServiceError> {
        const MANAGER_PATH: &str = "/org/opensuse/Agama/Storage1";
        const NAMESPACE: &str = "/org/opensuse/Agama/Storage1/dasds";

        let (tx, rx) = unbounded_channel();
        let mut stream = DBusObjectChangesStream::new(
            dbus,
            &ObjectPath::from_str_unchecked(MANAGER_PATH),
            &ObjectPath::from_str_unchecked(NAMESPACE),
            "org.opensuse.Agama.Storage1.DASD.Device",
        )
        .await?;

        tokio::spawn(async move {
            while let Some(change) = stream.next().await {
                let _ = tx.send(change);
            }
        });
        let rx = UnboundedReceiverStream::new(rx);

        let mut cache: ObjectsCache<DASDDevice> = Default::default();
        let client = DASDClient::new(dbus.clone()).await?;
        for (path, device) in client.devices().await? {
            cache.add(path, device);
        }

        Ok(Self {
            dbus: dbus.clone(),
            cache,
            inner: rx,
        })
    }

    fn update_device<'a>(
        cache: &'a mut ObjectsCache<DASDDevice>,
        path: &OwnedObjectPath,
        values: &HashMap<String, OwnedValue>,
    ) -> Result<&'a DASDDevice, ServiceError> {
        let device = cache.find_or_create(path);
        property_from_dbus!(device, id, "Id", values, str);
        property_from_dbus!(device, enabled, "Enabled", values, bool);
        property_from_dbus!(device, device_name, "DeviceName", values, str);
        property_from_dbus!(device, formatted, "Formatted", values, bool);
        property_from_dbus!(device, diag, "Diag", values, bool);
        property_from_dbus!(device, status, "Status", values, str);
        property_from_dbus!(device, device_type, "Type", values, str);
        property_from_dbus!(device, access_type, "AccessType", values, str);
        property_from_dbus!(device, partition_info, "PartitionInfo", values, str);
        Ok(device)
    }

    fn remove_device(
        cache: &mut ObjectsCache<DASDDevice>,
        path: &OwnedObjectPath,
    ) -> Result<DASDDevice, DASDDeviceStreamError> {
        cache
            .remove(path)
            .ok_or_else(|| DASDDeviceStreamError::UnknownDevice(path.clone()))
    }

    fn handle_change(
        cache: &mut ObjectsCache<DASDDevice>,
        change: &DBusObjectChange,
    ) -> Result<Event, DASDDeviceStreamError> {
        match change {
            DBusObjectChange::Added(path, values) => {
                let device = Self::update_device(cache, path, values)?;
                Ok(Event::DASDDeviceAdded {
                    device: device.clone(),
                })
            }
            DBusObjectChange::Changed(path, updated) => {
                let device = Self::update_device(cache, path, updated)?;
                Ok(Event::DASDDeviceChanged {
                    device: device.clone(),
                })
            }
            DBusObjectChange::Removed(path) => {
                let device = Self::remove_device(cache, path)?;
                Ok(Event::DASDDeviceRemoved { device })
            }
        }
    }
}

impl Stream for DASDDeviceStream {
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

/// This stream listens for DASD progress changes and emits an [Event::DASDFormatJobChanged] event.
#[pin_project]
pub struct DASDFormatJobStream {
    #[pin]
    inner: MessageStream,
}

impl DASDFormatJobStream {
    pub async fn new(connection: &zbus::Connection) -> Result<Self, ServiceError> {
        let rule = MatchRule::builder()
            .msg_type(MessageType::Signal)
            .path_namespace("/org/opensuse/Agama/Storage1/jobs")?
            .interface("org.freedesktop.DBus.Properties")?
            .member("PropertiesChanged")?
            .build();
        let inner = MessageStream::for_match_rule(rule, connection, None).await?;
        Ok(Self { inner })
    }

    fn handle_change(message: Result<Message, zbus::Error>) -> Option<Event> {
        let Ok(message) = message else {
            return None;
        };
        let properties = PropertiesChanged::from_message(message)?;
        let args = properties.args().ok()?;

        if args.interface_name.as_str() != "org.opensuse.Agama.Storage1.DASD.Format" {
            return None;
        }

        let inner = properties.message();
        let id = inner.header().path()?.to_string();
        let event = Self::to_event(id, &args);
        if event.is_none() {
            log::warn!("Could not decode the DASDFormatJobChanged event");
        }
        event
    }

    fn to_event(path: String, properties_changed: &PropertiesChangedArgs) -> Option<Event> {
        let dict = properties_changed
            .changed_properties()
            .get("Summary")?
            .downcast_ref::<zvariant::Dict>()
            .ok()?;

        // the key is the D-Bus path of the DASD device and the value is the progress
        // of the related formatting process
        let map = <HashMap<String, zvariant::Value<'_>>>::try_from(dict).ok()?;
        let mut format_summary = HashMap::new();

        for (dasd_id, summary) in map {
            let summary_values = summary.downcast_ref::<zvariant::Structure>().ok()?;
            let fields = summary_values.fields();
            let total: &u32 = fields.first()?.downcast_ref().ok()?;
            let step: &u32 = fields.get(1)?.downcast_ref().ok()?;
            let done: &bool = fields.get(2)?.downcast_ref().ok()?;
            format_summary.insert(
                dasd_id.to_string(),
                DASDFormatSummary {
                    total: *total,
                    step: *step,
                    done: *done,
                },
            );
        }

        Some(Event::DASDFormatJobChanged {
            job_id: path.to_string(),
            summary: format_summary,
        })
    }
}

impl Stream for DASDFormatJobStream {
    type Item = Event;

    fn poll_next(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Option<Self::Item>> {
        let mut pinned = self.project();

        Poll::Ready(loop {
            let item = ready!(pinned.inner.as_mut().poll_next(cx));
            let next_value = match item {
                Some(change) => Self::handle_change(change),
                None => break None,
            };
            if next_value.is_some() {
                break next_value;
            }
        })
    }
}
