//! Implements the mechanism to listen for NetworkManager changes.
//!
//! Monitors NetworkManager's D-Bus service and emit [actions](crate::network::Action] to update
//! the NetworkSystem state when devices or active connections change.

use crate::network::{
    adapter::Watcher, model::Device, nm::proxies::DeviceProxy, Action, NetworkAdapterError,
};
use agama_lib::error::ServiceError;
use async_trait::async_trait;
use futures_util::ready;
use pin_project::pin_project;
use std::{
    collections::{hash_map::Entry, HashMap},
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

use super::{builder::DeviceFromProxyBuilder, proxies::NetworkManagerProxy};

/// Implements a [crate::network::adapter::Watcher] for NetworkManager.
///
/// This process is composed of the following pieces:
///
/// * A stream of potentially useful D-Bus signals (see [DeviceChangedStream]).
/// * A dispatcher that receives the signals from the stream and turns them into
///   [network system actions](crate::network::Action).
///
/// To avoid deadlocks, the stream runs on a separate Tokio task and it communicates
/// with the dispatcher through a multi-producer single-consumer (mpsc) channel.
///
/// At this point, it detects the following changes:
///
/// * A device is added, changed or removed.
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
        dispatcher.run().await.map_err(NetworkAdapterError::Watcher)
    }
}

/// Receives the updates and turns them into [network actions](crate::network::Action).
///
/// See [ActionDispatcher::run] for further details.
struct ActionDispatcher<'a> {
    connection: zbus::Connection,
    proxies: ProxiesRegistry<'a>,
    updates_rx: UnboundedReceiver<DeviceChange>,
    actions_tx: UnboundedSender<Action>,
}

impl<'a> ActionDispatcher<'a> {
    /// Returns a new dispatcher.
    ///
    /// * `connection`: D-Bus connection to NetworkManager.
    /// * `updates_rx`: Channel to receive the updates.
    /// * `actions_tx`: Channel to dispatch the network actions.
    pub fn new(
        connection: zbus::Connection,
        updates_rx: UnboundedReceiver<DeviceChange>,
        actions_tx: UnboundedSender<Action>,
    ) -> Self {
        Self {
            proxies: ProxiesRegistry::new(&connection),
            connection,
            updates_rx,
            actions_tx,
        }
    }

    /// Processes the updates.
    ///
    /// It runs until the updates channel is closed.
    pub async fn run(&mut self) -> Result<(), ServiceError> {
        self.read_devices().await?;
        while let Some(update) = self.updates_rx.recv().await {
            let result = match update {
                DeviceChange::DeviceAdded(path) => self.handle_device_added(path).await,
                DeviceChange::DeviceUpdated(path) => self.handle_device_updated(path).await,
                DeviceChange::DeviceRemoved(path) => self.handle_device_removed(path).await,
                DeviceChange::IP4ConfigChanged(path) => self.handle_ip4_config_changed(path).await,
                DeviceChange::IP6ConfigChanged(path) => self.handle_ip6_config_changed(path).await,
            };

            if let Err(error) = result {
                tracing::warn!("Could not process a network update: {error}]")
            }
        }
        Ok(())
    }

    /// Reads the devices.
    async fn read_devices(&mut self) -> Result<(), ServiceError> {
        let nm_proxy = NetworkManagerProxy::new(&self.connection).await?;
        for path in nm_proxy.get_devices().await? {
            self.proxies.find_or_create_device(&path).await?;
        }
        Ok(())
    }

    async fn handle_device_added(&mut self, path: OwnedObjectPath) -> Result<(), ServiceError> {
        let (_, proxy) = self.proxies.find_or_create_device(&path).await?;
        if let Ok(device) = Self::device_from_proxy(&self.connection, proxy.clone()).await {
            _ = self.actions_tx.send(Action::AddDevice(Box::new(device)));
        }
        // TODO: report an error if the device cannot get generated

        Ok(())
    }

    async fn handle_device_updated(&mut self, path: OwnedObjectPath) -> Result<(), ServiceError> {
        let (old_name, proxy) = self.proxies.find_or_create_device(&path).await?;
        let device = Self::device_from_proxy(&self.connection, proxy.clone()).await?;
        let new_name = device.name.clone();
        _ = self
            .actions_tx
            .send(Action::UpdateDevice(old_name.to_string(), Box::new(device)));
        self.proxies.update_device_name(&path, &new_name);
        Ok(())
    }

    async fn handle_device_removed(&mut self, path: OwnedObjectPath) -> Result<(), ServiceError> {
        if let Some((name, _)) = self.proxies.remove_device(&path) {
            _ = self.actions_tx.send(Action::RemoveDevice(name));
        }
        Ok(())
    }

    async fn handle_ip4_config_changed(
        &mut self,
        path: OwnedObjectPath,
    ) -> Result<(), ServiceError> {
        if let Some((name, proxy)) = self.proxies.find_device_for_ip4(&path).await {
            let device = Self::device_from_proxy(&self.connection, proxy.clone()).await?;
            _ = self
                .actions_tx
                .send(Action::UpdateDevice(name.to_string(), Box::new(device)));
        }
        Ok(())
    }

    async fn handle_ip6_config_changed(
        &mut self,
        path: OwnedObjectPath,
    ) -> Result<(), ServiceError> {
        if let Some((name, proxy)) = self.proxies.find_device_for_ip6(&path).await {
            let device = Self::device_from_proxy(&self.connection, proxy.clone()).await?;
            _ = self
                .actions_tx
                .send(Action::UpdateDevice(name.to_string(), Box::new(device)));
        }
        Ok(())
    }

    // TODO: improve after DeviceFromProxyBuilder API is improved
    async fn device_from_proxy(
        connection: &zbus::Connection,
        proxy: DeviceProxy<'_>,
    ) -> Result<Device, ServiceError> {
        let builder = DeviceFromProxyBuilder::new(&connection, &proxy);
        Ok(builder.build().await?)
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
            "org.freedesktop.NetworkManager.Device" => Some(DeviceChange::DeviceUpdated(path)),
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
enum DeviceChange {
    DeviceAdded(OwnedObjectPath),
    DeviceUpdated(OwnedObjectPath),
    DeviceRemoved(OwnedObjectPath),
    IP4ConfigChanged(OwnedObjectPath),
    IP6ConfigChanged(OwnedObjectPath),
}

struct ProxiesRegistry<'a> {
    connection: zbus::Connection,
    devices: HashMap<OwnedObjectPath, (String, DeviceProxy<'a>)>,
}

impl<'a> ProxiesRegistry<'a> {
    pub fn new(connection: &zbus::Connection) -> Self {
        Self {
            connection: connection.clone(),
            devices: HashMap::new(),
        }
    }
    pub async fn find_or_create_device(
        &mut self,
        path: &OwnedObjectPath,
    ) -> Result<&(String, DeviceProxy<'a>), ServiceError> {
        // Cannot use entry(...).or_insert_with(...) because of the async call.
        match self.devices.entry(path.clone()) {
            Entry::Vacant(entry) => {
                let proxy = DeviceProxy::builder(&self.connection.clone())
                    .path(path.clone())?
                    .build()
                    .await?;
                let name = proxy.interface().await?;

                Ok(entry.insert((name, proxy)))
            }
            Entry::Occupied(entry) => Ok(entry.into_mut()),
        }
    }

    pub fn remove_device(&mut self, path: &OwnedObjectPath) -> Option<(String, DeviceProxy)> {
        self.devices.remove(&path)
    }

    pub fn update_device_name(&mut self, path: &OwnedObjectPath, new_name: &str) {
        if let Some(value) = self.devices.get_mut(path) {
            value.0 = new_name.to_string();
        };
    }

    pub async fn find_device_for_ip4(
        &self,
        ip4_config_path: &OwnedObjectPath,
    ) -> Option<&(String, DeviceProxy<'_>)> {
        for (_, device) in &self.devices {
            if let Ok(path) = device.1.ip4_config().await {
                if path == *ip4_config_path {
                    return Some(&device);
                }
            }
        }
        None
    }

    pub async fn find_device_for_ip6(
        &self,
        ip4_config_path: &OwnedObjectPath,
    ) -> Option<&(String, DeviceProxy<'_>)> {
        for (_, device) in &self.devices {
            if let Ok(path) = device.1.ip4_config().await {
                if path == *ip4_config_path {
                    return Some(&device);
                }
            }
        }
        None
    }
}
