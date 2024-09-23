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

use crate::network::{model::StateConfig, Action, NetworkState};
use agama_lib::error::ServiceError;
use async_trait::async_trait;
use thiserror::Error;
use tokio::sync::mpsc::UnboundedSender;

#[derive(Error, Debug)]
pub enum NetworkAdapterError {
    #[error("Could not read the network configuration: {0}")]
    Read(ServiceError),
    #[error("Could not update the network configuration: {0}")]
    Write(ServiceError),
    #[error("Checkpoint handling error: {0}")]
    Checkpoint(ServiceError), // only relevant for adapters that implement a checkpoint mechanism
    #[error("The network watcher cannot run: {0}")]
    Watcher(ServiceError),
}

/// A trait for the ability to read/write from/to a network service.
#[async_trait]
pub trait Adapter {
    async fn read(&self, config: StateConfig) -> Result<NetworkState, NetworkAdapterError>;
    async fn write(&self, network: &NetworkState) -> Result<(), NetworkAdapterError>;
    /// Returns the watcher, which is responsible for listening for network changes.
    fn watcher(&self) -> Option<Box<dyn Watcher + Send>> {
        None
    }
}

impl From<NetworkAdapterError> for zbus::fdo::Error {
    fn from(value: NetworkAdapterError) -> zbus::fdo::Error {
        zbus::fdo::Error::Failed(value.to_string())
    }
}

#[async_trait]
/// A trait for the ability to listen for network changes.
pub trait Watcher {
    /// Listens for network changes and emit actions to update the state.
    ///
    /// * `actions`: channel to emit the actions.
    async fn run(
        self: Box<Self>,
        actions: UnboundedSender<Action>,
    ) -> Result<(), NetworkAdapterError>;
}
