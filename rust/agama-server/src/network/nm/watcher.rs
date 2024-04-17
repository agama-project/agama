//! Implements the mechanism to listen for NetworkManager changes.
//!
//! Monitors NetworkManager's D-Bus service and emit [actions](crate::network::Action] to update
//! the NetworkSystem state when devices or active connections change.

use crate::network::{
    adapter::Watcher, model::Device, nm::proxies::DeviceProxy, Action, NetworkAdapterError,
};
use agama_lib::{error::ServiceError, network::types::DeviceType};
use async_trait::async_trait;
use futures_util::ready;
use pin_project::pin_project;
use std::{
    collections::HashMap,
    pin::Pin,
    sync::Arc,
    task::{Context, Poll},
};
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use tokio_stream::{Stream, StreamExt, StreamMap};
use zbus::{
    fdo::{InterfacesAdded, InterfacesRemoved, PropertiesChanged},
    zvariant::OwnedObjectPath,
    MatchRule, Message, MessageStream, MessageType,
};

/// Implements a [crate::network::adapter::Watcher] for NetworkManager.
///
/// It detects the following changes by monitoring NetworkManager's D-Bus API:
///
/// * A device is added or removed.
/// * The IPv4 or IPv6 configuration changes.
pub struct NetworkManagerWatcher {
    connection: zbus::Connection,
}

impl NetworkManagerWatcher {
    /// Builds a new watcher over a D-Bus connection.
    pub fn new(connection: &zbus::Connection) -> Self {
        Self {
            connection: connection.clone(),
        }
    }
}

#[async_trait]
impl Watcher for NetworkManagerWatcher {
    async fn run(
        self: Box<Self>,
        actions: UnboundedSender<Action>,
    ) -> Result<(), NetworkAdapterError> {
        let (tx, rx) = unbounded_channel();

        // Process the DeviceChangedStream in a separate task.
        let connection = self.connection.clone();
        tokio::spawn(async move {
            let mut stream = DeviceChangedStream::new(&connection).await.unwrap();

            while let Some(change) = stream.next().await {
                if let Err(e) = tx.send(change) {
                    tracing::error!("Could not dispatch a network change: {e}");
                }
            }
        });

        // Turn the changes into actions in a separate task.
        let connection = self.connection.clone();
        let mut dispatcher = ActionDispatcher::new(connection, rx, actions);
        dispatcher.run().await;

        Ok(())
    }
}

struct ActionDispatcher<'a> {
    connection: zbus::Connection,
    devices: HashMap<OwnedObjectPath, DeviceProxy<'a>>,
    updates: UnboundedReceiver<DeviceChange>,
    actions: UnboundedSender<Action>,
}

impl<'a> ActionDispatcher<'a> {
    pub fn new(
        connection: zbus::Connection,
        updates: UnboundedReceiver<DeviceChange>,
        actions: UnboundedSender<Action>,
    ) -> Self {
        Self {
            connection,
            updates,
            actions,
            devices: HashMap::new(),
        }
    }

    pub async fn run(&mut self) {
        while let Some(update) = self.updates.recv().await {
            match update {
                DeviceChange::DeviceAdded(path) => {
                    if let Ok(proxy) = self.build_device_proxy(path.clone()).await {
                        let device = Device {
                            name: proxy.interface().await.unwrap().to_string(),
                            type_: DeviceType::Ethernet,
                            ..Default::default()
                        };
                        self.devices.insert(path, proxy);
                        _ = self.actions.send(Action::AddDevice(device));
                    }
                }

                DeviceChange::DeviceRemoved(path) => {
                    if let Some(proxy) = self.devices.remove(&path) {
                        if let Ok(name) = proxy.interface().await {
                            _ = self.actions.send(Action::RemoveDevice(name));
                        }
                    }
                }

                _ => {
                    println!("Unhandled message");
                }
            }
        }
    }

    async fn build_device_proxy(
        &self,
        path: OwnedObjectPath,
    ) -> Result<DeviceProxy<'a>, ServiceError> {
        let proxy = DeviceProxy::builder(&self.connection.clone())
            .path(path.clone())?
            .build()
            .await?;
        Ok(proxy)
    }
}

/// Stream of addded and removed devices.
///
/// This is a private stream that detects when a device was added or removed
/// from NetworkManager. It is implemented as a struct because it needs to
/// keep the ObjectManagerProxy alive.
#[pin_project]
struct DeviceChangedStream {
    connection: zbus::Connection,
    #[pin]
    inner: StreamMap<&'static str, MessageStream>,
}

impl DeviceChangedStream {
    pub async fn new(connection: &zbus::Connection) -> Result<Self, ServiceError> {
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

    fn handle_added(message: InterfacesAdded) -> Option<DeviceChange> {
        let args = message.args().ok()?;
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
    }

    fn handle_removed(message: InterfacesRemoved) -> Option<DeviceChange> {
        let args = message.args().ok()?;

        if args
            .interfaces
            .contains(&"org.freedesktop.NetworkManager.Device")
        {
            let path = OwnedObjectPath::from(args.object_path().clone());
            return Some(DeviceChange::DeviceRemoved(path));
        }

        None
    }

    fn handle_changed(message: PropertiesChanged) -> Option<DeviceChange> {
        let path = OwnedObjectPath::from(message.path()?);
        let args = message.args().ok()?;

        match args.interface_name.as_str() {
            "org.freedesktop.NetworkManager.IP4Config" => {
                Some(DeviceChange::IP4ConfigChanged(path))
            }
            "org.freedesktop.NetworkManager.IP6Config" => {
                Some(DeviceChange::IP6ConfigChanged(path))
            }
            _ => None,
        }
    }

    fn handle_message(message: Result<Arc<Message>, zbus::Error>) -> Option<DeviceChange> {
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

impl Stream for DeviceChangedStream {
    type Item = DeviceChange;

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

async fn build_added_and_removed_stream(
    connection: &zbus::Connection,
) -> Result<MessageStream, ServiceError> {
    let rule = MatchRule::builder()
        .msg_type(MessageType::Signal)
        .path("/org/freedesktop")?
        .interface("org.freedesktop.DBus.ObjectManager")?
        .build();
    let stream = MessageStream::for_match_rule(rule, &connection, Some(1)).await?;
    Ok(stream)
}

async fn build_properties_changed_stream(
    connection: &zbus::Connection,
) -> Result<MessageStream, ServiceError> {
    let rule = MatchRule::builder()
        .msg_type(MessageType::Signal)
        .interface("org.freedesktop.DBus.Properties")?
        .member("PropertiesChanged")?
        .build();
    let stream = MessageStream::for_match_rule(rule, &connection, Some(1)).await?;
    Ok(stream)
}

#[derive(Debug, Clone)]
pub enum DeviceChange {
    DeviceAdded(OwnedObjectPath),
    DeviceRemoved(OwnedObjectPath),
    IP4ConfigChanged(OwnedObjectPath),
    IP6ConfigChanged(OwnedObjectPath),
}
