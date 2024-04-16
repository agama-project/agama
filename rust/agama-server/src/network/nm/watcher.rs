use crate::network::{
    adapter::Watcher, model::Device, nm::proxies::DeviceProxy, Action, NetworkAdapterError,
};
use agama_lib::{error::ServiceError, network::types::DeviceType};
use async_trait::async_trait;
use pin_project::pin_project;
use std::{
    collections::HashMap,
    pin::Pin,
    task::{Context, Poll},
};
use tokio::sync::mpsc::UnboundedSender;
use tokio_stream::{Stream, StreamExt, StreamMap};
use zbus::{fdo::ObjectManagerProxy, zvariant::OwnedObjectPath, Connection};

pub struct NetworkManagerWatcher<'a> {
    connection: zbus::Connection,
    devices: HashMap<OwnedObjectPath, DeviceProxy<'a>>,
}

impl<'a> NetworkManagerWatcher<'a> {
    pub fn new(connection: &zbus::Connection) -> Self {
        Self {
            connection: connection.clone(),
            devices: HashMap::new(),
        }
    }

    async fn build_device_proxy(
        &self,
        path: OwnedObjectPath,
    ) -> Result<DeviceProxy<'a>, ServiceError> {
        let proxy = DeviceProxy::builder(&self.connection)
            .path(path.clone())?
            .build()
            .await?;
        Ok(proxy)
    }
}

#[async_trait]
impl<'a> Watcher for NetworkManagerWatcher<'a> {
    async fn run(
        mut self: Box<Self>,
        actions: UnboundedSender<Action>,
    ) -> Result<(), NetworkAdapterError> {
        let mut stream = AddedAndRemovedStream::new(&self.connection).await.unwrap();

        while let Some(change) = stream.next().await {
            match change {
                DeviceChange::DeviceAdded(path) => {
                    if let Ok(proxy) = self.build_device_proxy(path.clone()).await {
                        let device = Device {
                            name: proxy.interface().await.unwrap().to_string(),
                            type_: DeviceType::Ethernet,
                            ..Default::default()
                        };
                        self.devices.insert(path, proxy);
                        _ = actions.send(Action::AddDevice(device));
                        // _ = changes_tx.send(NetworkChange::DeviceAdded(device));
                    }
                }
                DeviceChange::DeviceRemoved(path) => {
                    if let Some(proxy) = self.devices.remove(&path) {
                        let name = proxy.interface().await.unwrap().to_string();
                        // _ = changes_tx.send(NetworkChange::DeviceRemoved(name));
                        _ = actions.send(Action::RemoveDevice(name));
                    }
                }
            }
        }
        Ok(())
    }
}

#[derive(Debug)]
pub enum DeviceChange {
    DeviceAdded(OwnedObjectPath),
    DeviceRemoved(OwnedObjectPath),
}

/// Stream of addded and removed devices.
///
/// This is a private stream that detects when a device was added or removed
/// from NetworkManager. It is implemented as a struct because it needs to
/// keep the ObjectManagerProxy alive.
#[pin_project]
struct AddedAndRemovedStream<'a> {
    #[pin]
    objects: ObjectManagerProxy<'a>,
    #[pin]
    inner: StreamMap<&'static str, Pin<Box<dyn Stream<Item = DeviceChange> + Send>>>,
}

impl<'a> AddedAndRemovedStream<'a> {
    pub async fn new(connection: &Connection) -> Result<Self, ServiceError> {
        let objects = ObjectManagerProxy::builder(&connection)
            .destination("org.freedesktop.NetworkManager")?
            .path("/org/freedesktop")?
            .build()
            .await?;

        let mut inner = StreamMap::new();
        inner.insert("added", Self::added_stream(&objects).await?);
        inner.insert("removed", Self::removed_stream(&objects).await?);
        Ok(Self { objects, inner })
    }

    async fn added_stream(
        objects: &ObjectManagerProxy<'_>,
    ) -> Result<Pin<Box<dyn Stream<Item = DeviceChange> + Send>>, ServiceError> {
        let stream = objects
            .receive_interfaces_added()
            .await?
            .filter_map(|added| {
                let Ok(args) = added.args() else {
                    return None;
                };

                let interfaces: Vec<String> = args
                    .interfaces_and_properties()
                    .keys()
                    .into_iter()
                    .map(|i| i.to_string())
                    .collect();

                if interfaces.contains(&"org.freedesktop.NetworkManager.Device".to_string()) {
                    let path = OwnedObjectPath::from(args.object_path().clone());
                    return Some(DeviceChange::DeviceAdded(path));
                }

                None
            });
        Ok(Box::pin(stream))
    }

    async fn removed_stream(
        objects: &ObjectManagerProxy<'_>,
    ) -> Result<Pin<Box<dyn Stream<Item = DeviceChange> + Send>>, ServiceError> {
        let stream = objects
            .receive_interfaces_removed()
            .await?
            .filter_map(|removed| {
                let Ok(args) = removed.args() else {
                    return None;
                };

                if args
                    .interfaces
                    .contains(&"org.freedesktop.NetworkManager.Device")
                {
                    let path = OwnedObjectPath::from(args.object_path().clone());
                    return Some(DeviceChange::DeviceRemoved(path));
                }
                None
            });
        Ok(Box::pin(stream))
    }
}

impl<'a> Stream for AddedAndRemovedStream<'a> {
    type Item = DeviceChange;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let pinned = self.project();
        match pinned.inner.poll_next(cx) {
            Poll::Ready(Some((_, change))) => Poll::Ready(Some(change)),
            _ => Poll::Pending,
        }
    }
}
