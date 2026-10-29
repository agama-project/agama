// Copyright (c) [2026] SUSE LLC
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

use crate::model::{Connection, GeneralState};
use crate::types::{AccessPoint, ConnectionState, Device, Proposal, SystemInfo};
use agama_utils::actor::Message;
use agama_utils::api::network::Config;
use uuid::Uuid;

pub struct NewConnection {
    pub connection: Connection,
}

impl Message for NewConnection {
    type Reply = ();
}

pub struct GetConfig;

impl Message for GetConfig {
    type Reply = Config;
}

pub struct GetProposal;

impl Message for GetProposal {
    type Reply = Proposal;
}

/// Sets the network configuration and applies it to the system.
///
/// Unlike other services, the configuration is not optional: the network configuration is applied
/// to the running system, so when a profile has no network section, the network is left untouched
/// instead of resetting it to the defaults.
pub struct SetConfig {
    pub config: Config,
}

impl Message for SetConfig {
    type Reply = ();
}

impl SetConfig {
    pub fn new(config: Config) -> Self {
        Self { config }
    }
}

pub struct GetSystem;

impl Message for GetSystem {
    type Reply = SystemInfo;
}

pub struct AddAccessPoint {
    pub access_point: AccessPoint,
}

impl Message for AddAccessPoint {
    type Reply = ();
}

pub struct RemoveAccessPoint {
    pub hw_address: String,
}

impl Message for RemoveAccessPoint {
    type Reply = ();
}

pub struct AddDevice {
    pub device: Device,
}

impl Message for AddDevice {
    type Reply = ();
}

pub struct UpdateDevice {
    pub name: String,
    pub device: Device,
}

impl Message for UpdateDevice {
    type Reply = ();
}

pub struct RemoveDevice {
    pub name: String,
}

impl Message for RemoveDevice {
    type Reply = ();
}

pub struct ChangeConnectionState {
    pub uuid: Uuid,
    pub state: ConnectionState,
}

impl Message for ChangeConnectionState {
    type Reply = ();
}

pub struct ProposeDefault;

impl Message for ProposeDefault {
    type Reply = ();
}

pub struct Install;

impl Message for Install {
    type Reply = ();
}

pub struct UpdateGeneralState {
    pub state: GeneralState,
}

impl Message for UpdateGeneralState {
    type Reply = ();
}

pub struct RemoveConnection {
    pub uuid: Uuid,
}

impl Message for RemoveConnection {
    type Reply = ();
}

pub struct Apply;

impl Message for Apply {
    type Reply = ();
}
