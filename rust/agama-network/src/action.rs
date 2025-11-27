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

use crate::model::Connection;
use crate::types::{ConnectionState, Device, DeviceType, Proposal, SystemInfo};
use agama_utils::api::network::Config;
use tokio::sync::oneshot;

use super::{error::NetworkStateError, NetworkAdapterError};

pub type Responder<T> = oneshot::Sender<T>;
pub type ControllerConnection = (Connection, Vec<String>);

/// Networking actions, like adding, updating or removing connections.
///
/// These actions are meant to be processed by [crate::network::system::NetworkSystem], updating the model
/// and the D-Bus tree as needed.
#[derive(Debug)]
pub enum Action {
    /// Add a new connection with the given name and type.
    AddConnection(String, DeviceType, Responder<Result<(), NetworkStateError>>),
    /// Add a new connection
    NewConnection(Box<Connection>, Responder<Result<(), NetworkStateError>>),
    /// Gets the internal state of the network configuration
    GetConfig(Responder<Config>),
    /// Gets the internal state of the network configuration proposal
    GetProposal(Responder<Proposal>),
    /// Updates the internal state of the network configuration applying the changes to the system
    UpdateConfig(Box<Config>, Responder<Result<(), NetworkStateError>>),
    /// Gets the current network system configuration containing connections, devices, access_points and
    /// also the general state
    GetSystem(Responder<SystemInfo>),
    /// Adds a new device.
    AddDevice(Box<Device>),
    /// Updates a device by its `name`.
    UpdateDevice(String, Box<Device>),
    /// Removes a device by its `name`.
    RemoveDevice(String),
    /// Connection state changed
    ChangeConnectionState(String, ConnectionState),
    /// Updates a connection (replacing the old one).
    UpdateConnection(Box<Connection>, Responder<Result<(), NetworkStateError>>),
    /// Forces a wireless networks scan refresh
    RefreshScan(Responder<Result<(), NetworkAdapterError>>),
    /// Remove the connection with the given Uuid.
    RemoveConnection(String, Responder<Result<(), NetworkStateError>>),
    /// Apply the current configuration.
    Apply(Responder<Result<(), NetworkAdapterError>>),
}
