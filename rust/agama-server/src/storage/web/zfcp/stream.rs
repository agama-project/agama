// FIXME: the code is pretty similar to iscsi::stream and dasd::stream. Refactor the stream to reduce the repetition.

use std::{collections::HashMap, task::Poll};

use agama_lib::{
    dbus::get_optional_property,
    error::ServiceError,
    property_from_dbus,
    storage::{
        client::zfcp::ZFCPClient,
        model::zfcp::{ZFCPController, ZFCPDisk},
    },
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

#[derive(Debug, Error)]
enum ZFCPDiskStreamError {
    #[error("Service error: {0}")]
    Service(#[from] ServiceError),
    #[error("Unknown ZFCP disk: {0}")]
    UnknownDevice(OwnedObjectPath),
}

/// This stream listens for changes in the collection of zFCP disks and emits
/// the updated objects.
///
/// It relies on the [DBusObjectChangesStream] stream and uses a cache to avoid holding a bunch of
/// proxy objects.
#[pin_project]
pub struct ZFCPDiskStream {
    dbus: zbus::Connection,
    cache: ObjectsCache<ZFCPDisk>,
    #[pin]
    inner: UnboundedReceiverStream<DBusObjectChange>,
}

impl ZFCPDiskStream {
    /// Creates a new stream
    ///
    /// * `dbus`: D-Bus connection to listen on.
    pub async fn new(dbus: &zbus::Connection) -> Result<Self, ServiceError> {
        const MANAGER_PATH: &str = "/org/opensuse/Agama/Storage1";
        const NAMESPACE: &str = "/org/opensuse/Agama/Storage1/zfcp_disks";

        let (tx, rx) = unbounded_channel();
        let mut stream = DBusObjectChangesStream::new(
            dbus,
            &ObjectPath::from_str_unchecked(MANAGER_PATH),
            &ObjectPath::from_str_unchecked(NAMESPACE),
            "org.opensuse.Agama.Storage1.ZFCP.Disk",
        )
        .await?;

        tokio::spawn(async move {
            while let Some(change) = stream.next().await {
                let _ = tx.send(change);
            }
        });
        let rx = UnboundedReceiverStream::new(rx);

        let mut cache: ObjectsCache<ZFCPDisk> = Default::default();
        let client = ZFCPClient::new(dbus.clone()).await?;
        for (path, device) in client.get_disks().await? {
            cache.add(path.into(), device);
        }

        Ok(Self {
            dbus: dbus.clone(),
            cache,
            inner: rx,
        })
    }

    fn update_device<'a>(
        cache: &'a mut ObjectsCache<ZFCPDisk>,
        path: &OwnedObjectPath,
        values: &HashMap<String, OwnedValue>,
    ) -> Result<&'a ZFCPDisk, ServiceError> {
        let device = cache.find_or_create(path);
        property_from_dbus!(device, name, "Name", values, str);
        property_from_dbus!(device, channel, "Channel", values, str);
        property_from_dbus!(device, wwpn, "WWPN", values, str);
        property_from_dbus!(device, lun, "LUN", values, str);
        Ok(device)
    }

    fn remove_device(
        cache: &mut ObjectsCache<ZFCPDisk>,
        path: &OwnedObjectPath,
    ) -> Result<ZFCPDisk, ZFCPDiskStreamError> {
        cache
            .remove(path)
            .ok_or_else(|| ZFCPDiskStreamError::UnknownDevice(path.clone()))
    }

    fn handle_change(
        cache: &mut ObjectsCache<ZFCPDisk>,
        change: &DBusObjectChange,
    ) -> Result<Event, ZFCPDiskStreamError> {
        match change {
            DBusObjectChange::Added(path, values) => {
                let device = Self::update_device(cache, path, values)?;
                Ok(Event::ZFCPDiskAdded {
                    device: device.clone(),
                })
            }
            DBusObjectChange::Changed(path, updated) => {
                let device = Self::update_device(cache, path, updated)?;
                Ok(Event::ZFCPDiskChanged {
                    device: device.clone(),
                })
            }
            DBusObjectChange::Removed(path) => {
                let device = Self::remove_device(cache, path)?;
                Ok(Event::ZFCPDiskRemoved { device })
            }
        }
    }
}

impl Stream for ZFCPDiskStream {
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

#[derive(Debug, Error)]
enum ZFCPControllerStreamError {
    #[error("Service error: {0}")]
    Service(#[from] ServiceError),
    #[error("Unknown ZFCP controller: {0}")]
    UnknownDevice(OwnedObjectPath),
}

/// This stream listens for changes in the collection of zFCP controllers and emits
/// the updated objects.
///
/// It relies on the [DBusObjectChangesStream] stream and uses a cache to avoid holding a bunch of
/// proxy objects.
#[pin_project]
pub struct ZFCPControllerStream {
    dbus: zbus::Connection,
    cache: ObjectsCache<ZFCPController>,
    #[pin]
    inner: UnboundedReceiverStream<DBusObjectChange>,
}

impl ZFCPControllerStream {
    /// Creates a new stream
    ///
    /// * `dbus`: D-Bus connection to listen on.
    pub async fn new(dbus: &zbus::Connection) -> Result<Self, ServiceError> {
        const MANAGER_PATH: &str = "/org/opensuse/Agama/Storage1";
        const NAMESPACE: &str = "/org/opensuse/Agama/Storage1/zfcp_controllers";

        let (tx, rx) = unbounded_channel();
        let mut stream = DBusObjectChangesStream::new(
            dbus,
            &ObjectPath::from_str_unchecked(MANAGER_PATH),
            &ObjectPath::from_str_unchecked(NAMESPACE),
            "org.opensuse.Agama.Storage1.ZFCP.Controller",
        )
        .await?;

        tokio::spawn(async move {
            while let Some(change) = stream.next().await {
                let _ = tx.send(change);
            }
        });
        let rx = UnboundedReceiverStream::new(rx);

        let mut cache: ObjectsCache<ZFCPController> = Default::default();
        let client = ZFCPClient::new(dbus.clone()).await?;
        for (path, device) in client.get_controllers().await? {
            cache.add(path.into(), device);
        }

        Ok(Self {
            dbus: dbus.clone(),
            cache,
            client,
            inner: rx,
        })
    }

    fn update_device<'a>(
        cache: &'a mut ObjectsCache<ZFCPController>,
        path: &OwnedObjectPath,
        values: &HashMap<String, OwnedValue>,
    ) -> Result<&'a ZFCPController, ServiceError> {
        let device = cache.find_or_create(path);
        property_from_dbus!(device, channel, "Channel", values, str);
        property_from_dbus!(device, lun_scan, "LUNScan", values, bool);
        property_from_dbus!(device, active, "Active", values, bool);
        Ok(device)
    }

    fn remove_device(
        cache: &mut ObjectsCache<ZFCPController>,
        path: &OwnedObjectPath,
    ) -> Result<ZFCPController, ZFCPControllerStreamError> {
        cache
            .remove(path)
            .ok_or_else(|| ZFCPControllerStreamError::UnknownDevice(path.clone()))
    }

    fn handle_change(
        cache: &mut ObjectsCache<ZFCPController>,
        change: &DBusObjectChange,
    ) -> Result<Event, ZFCPControllerStreamError> {
        match change {
            DBusObjectChange::Added(path, values) => {
                let device = Self::update_device(cache, path, values)?;
                Ok(Event::ZFCPControllerAdded {
                    device: device.clone(),
                })
            }
            DBusObjectChange::Changed(path, updated) => {
                let device = Self::update_device(cache, path, updated)?;
                Ok(Event::ZFCPControllerChanged {
                    device: device.clone(),
                })
            }
            DBusObjectChange::Removed(path) => {
                let device = Self::remove_device(cache, path)?;
                Ok(Event::ZFCPControllerRemoved { device })
            }
        }
    }
}

impl Stream for ZFCPControllerStream {
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
