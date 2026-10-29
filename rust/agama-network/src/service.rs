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

use crate::{
    error::NetworkStateError,
    message,
    model::{NetworkState, StateConfig},
    types::{Config, Proposal, SystemInfo},
    Adapter, NetworkAdapterError, NetworkManagerAdapter,
};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{event, Event, Scope},
    progress,
};
use anyhow::Context;
use gettextrs::gettext;
use tokio::sync::broadcast;

#[derive(thiserror::Error, Debug)]
pub enum NetworkSystemError {
    #[error("Network state error: {0}")]
    State(#[from] NetworkStateError),
    #[error("Network backend error: {0}")]
    AdapterError(#[from] NetworkAdapterError),
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    Event(#[from] broadcast::error::SendError<Event>),
    #[error(transparent)]
    Progress(#[from] progress::service::Error),
    #[error(transparent)]
    Generic(#[from] anyhow::Error),
}

/// Starts the network service
pub struct Starter {
    adapter: Option<Box<dyn Adapter + Send + 'static>>,
    events: event::Sender,
    progress: Handler<progress::Service>,
}

impl Starter {
    /// Returns a new instance of the network configuration system.
    ///
    /// This function does not start the system. To get it running, you must call
    /// the [start](Self::start) method.
    ///
    /// * `events`: channel to emit generic events.
    /// * `progress`: handler to the progress service.
    pub fn new(events: event::Sender, progress: Handler<progress::Service>) -> Self {
        Self {
            adapter: None,
            events,
            progress,
        }
    }

    /// Uses the given adapter.
    ///
    /// By default, the network service relies on NetworkManager. However, it might be useful
    /// to replace it in some scenarios (e.g., when testing).
    ///
    /// * `adapter`: adapter to use. It must implement the [Adapter] trait.
    pub fn with_adapter<T: Adapter + Send + 'static>(mut self, adapter: T) -> Self {
        self.adapter = Some(Box::new(adapter));
        self
    }

    /// Starts the network configuration service and returns a handler to communicate with it.
    pub async fn start(self) -> Result<Handler<Service>, NetworkSystemError> {
        let adapter = match self.adapter {
            Some(adapter) => adapter,
            None => Box::new(
                NetworkManagerAdapter::from_system()
                    .await
                    .context("Could not connect to NetworkManager")?,
            ),
        };

        let state = adapter.read(StateConfig::default()).await?;
        let watcher = adapter.watcher();

        let service = Service {
            events: self.events,
            progress: self.progress,
            state,
            adapter,
        };

        let handler = actor::spawn(service);

        if let Some(watcher) = watcher {
            let handler_clone = handler.clone();
            tokio::spawn(async move {
                if let Err(error) = watcher.run(handler_clone).await {
                    tracing::error!(
                        "The network watcher stopped, therefore changes from NetworkManager will \
                         be ignored. The original error was {error}"
                    );
                }
            });
        }

        Ok(handler)
    }
}

pub struct Service {
    events: event::Sender,
    progress: Handler<progress::Service>,
    state: NetworkState,
    adapter: Box<dyn Adapter + Send + 'static>,
}

impl Service {
    pub fn starter(events: event::Sender, progress: Handler<progress::Service>) -> Starter {
        Starter::new(events, progress)
    }

    /// Reads the system network configuration.
    pub async fn read(&mut self) -> Result<NetworkState, NetworkAdapterError> {
        self.adapter.read(StateConfig::default()).await
    }

    /// Reads the system network configuration.
    pub async fn force_state_read(&mut self) -> Result<(), NetworkAdapterError> {
        let result = match self.adapter.read(StateConfig::default()).await {
            Err(e) => Err(e),
            Ok(state) => {
                if self.state.sync_from(state) {
                    self.events.send(Event::ProposalChanged {
                        scope: (Scope::Network),
                    })?;
                    self.events.send(Event::SystemChanged {
                        scope: (Scope::Network),
                    })?;
                }
                Ok(())
            }
        };

        result
    }

    /// Writes the network configuration based on current state and then replace the state from the
    /// one read from the system.
    pub async fn apply(&mut self) -> Result<(), NetworkAdapterError> {
        let steps = vec![
            gettext("Writing network configuration"),
            gettext("Syncing the network service state"),
        ];

        let _ = self.progress.cast(progress::message::StartWithSteps::new(
            Scope::Network,
            steps,
        ));

        if let Err(e) = self.adapter.write(&self.state).await {
            self.progress
                .call(progress::message::Finish::new(Scope::Network))
                .await?;

            return Err(e);
        }
        self.progress
            .cast(progress::message::Next::new(Scope::Network))?;

        let result = match self.adapter.read(StateConfig::default()).await {
            Err(e) => Err(e),
            Ok(state) => {
                self.state.sync_from(state);
                Ok(())
            }
        };

        self.progress
            .call(progress::message::Finish::new(Scope::Network))
            .await?;
        self.events.send(Event::ConfigChanged {
            scope: (Scope::Network),
        })?;
        self.events.send(Event::ProposalChanged {
            scope: (Scope::Network),
        })?;
        self.events.send(Event::SystemChanged {
            scope: (Scope::Network),
        })?;

        result
    }
}

impl Actor for Service {
    type Error = NetworkSystemError;
}

impl MessageHandler<message::NewConnection> for Service {
    async fn handle(&mut self, message: message::NewConnection) -> Result<(), NetworkSystemError> {
        if let Some(conn) = self.state.get_connection(&message.connection.id) {
            tracing::info!("Connection {:?} already exists, skipping it", conn);
        } else {
            tracing::info!(
                "New connection to be added {:?}, forcing re-read",
                &message.connection
            );
            // It emits the events if the state changed.
            self.force_state_read().await?;
        }
        Ok(())
    }
}

impl MessageHandler<message::GetSystem> for Service {
    async fn handle(
        &mut self,
        _message: message::GetSystem,
    ) -> Result<SystemInfo, NetworkSystemError> {
        let result = self.read().await?.try_into()?;
        Ok(result)
    }
}

impl MessageHandler<message::GetConfig> for Service {
    async fn handle(&mut self, _message: message::GetConfig) -> Result<Config, NetworkSystemError> {
        let config: Config = self.state.clone().try_into()?;
        Ok(config)
    }
}

impl MessageHandler<message::GetProposal> for Service {
    async fn handle(
        &mut self,
        _message: message::GetProposal,
    ) -> Result<Proposal, NetworkSystemError> {
        let config: Proposal = self.state.clone().try_into()?;
        Ok(config)
    }
}

impl MessageHandler<message::SetConfig> for Service {
    async fn handle(&mut self, message: message::SetConfig) -> Result<(), NetworkSystemError> {
        self.state.update_state(message.config)?;

        self.apply().await?;
        Ok(())
    }
}

impl MessageHandler<message::AddDevice> for Service {
    async fn handle(&mut self, message: message::AddDevice) -> Result<(), NetworkSystemError> {
        self.state.add_device(message.device)?;
        self.events.send(Event::SystemChanged {
            scope: (Scope::Network),
        })?;
        Ok(())
    }
}

impl MessageHandler<message::UpdateDevice> for Service {
    async fn handle(&mut self, message: message::UpdateDevice) -> Result<(), NetworkSystemError> {
        if let Some(old_device) = self.state.get_device(&message.name) {
            if old_device == &message.device {
                return Ok(());
            }
        }
        self.state.update_device(&message.name, message.device)?;
        self.events.send(Event::SystemChanged {
            scope: (Scope::Network),
        })?;
        Ok(())
    }
}

impl MessageHandler<message::RemoveDevice> for Service {
    async fn handle(&mut self, message: message::RemoveDevice) -> Result<(), NetworkSystemError> {
        self.state.remove_device(&message.name)?;
        self.events.send(Event::SystemChanged {
            scope: (Scope::Network),
        })?;
        Ok(())
    }
}

impl MessageHandler<message::AddAccessPoint> for Service {
    async fn handle(&mut self, message: message::AddAccessPoint) -> Result<(), NetworkSystemError> {
        tracing::info!("Adding access point: {:?}", &message.access_point);
        self.state.add_access_point(message.access_point)?;
        Ok(())
    }
}

impl MessageHandler<message::RemoveAccessPoint> for Service {
    async fn handle(
        &mut self,
        message: message::RemoveAccessPoint,
    ) -> Result<(), NetworkSystemError> {
        self.state.remove_access_point(&message.hw_address)?;
        tracing::info!("Access point removed: {:?}", &message.hw_address);
        Ok(())
    }
}

impl MessageHandler<message::ChangeConnectionState> for Service {
    async fn handle(
        &mut self,
        message: message::ChangeConnectionState,
    ) -> Result<(), NetworkSystemError> {
        if let Some(conn) = self.state.get_connection_by_uuid_mut(message.uuid) {
            if conn.state != message.state {
                tracing::info!(
                    "Changed connection {} state: ({} -> {})",
                    conn.id,
                    conn.state,
                    message.state
                );
                conn.state = message.state;
            }
        }
        Ok(())
    }
}

impl MessageHandler<message::UpdateGeneralState> for Service {
    async fn handle(
        &mut self,
        message: message::UpdateGeneralState,
    ) -> Result<(), NetworkSystemError> {
        if self.state.general_state != message.state {
            self.state.general_state = message.state;
            self.events.send(Event::ProposalChanged {
                scope: (Scope::Network),
            })?;
            self.events.send(Event::SystemChanged {
                scope: (Scope::Network),
            })?;
        }
        Ok(())
    }
}

impl MessageHandler<message::RemoveConnection> for Service {
    async fn handle(
        &mut self,
        message: message::RemoveConnection,
    ) -> Result<(), NetworkSystemError> {
        if let Some(conn) = self.state.get_connection_by_uuid(message.uuid) {
            if !conn.is_removed() {
                tracing::info!("Connection {:?} exists, removing it", conn);
                self.state.remove_connection(message.uuid)?;
                self.events.send(Event::ConfigChanged {
                    scope: (Scope::Network),
                })?;
            } else {
                tracing::info!("Connection {:?} is marked to be removed, skipping it", conn);
            }
        } else {
            tracing::info!("Connection {} does not exists, skipping it", message.uuid);
        }
        Ok(())
    }
}

impl MessageHandler<message::Apply> for Service {
    async fn handle(&mut self, _message: message::Apply) -> Result<(), NetworkSystemError> {
        self.apply().await?;
        Ok(())
    }
}

impl MessageHandler<message::ProposeDefault> for Service {
    async fn handle(
        &mut self,
        _message: message::ProposeDefault,
    ) -> Result<(), NetworkSystemError> {
        self.state.propose_default()?;
        Ok(())
    }
}

impl MessageHandler<message::Install> for Service {
    async fn handle(&mut self, _message: message::Install) -> Result<(), NetworkSystemError> {
        self.state.install().await?;
        Ok(())
    }
}
