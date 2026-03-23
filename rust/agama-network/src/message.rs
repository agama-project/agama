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

use crate::error::NetworkStateError;
use crate::model::{Connection, GeneralState};
use crate::types::{AccessPoint, ConnectionState, Device, Proposal, SystemInfo};
use crate::{NetworkAdapterError, NetworkSystemError};
use agama_utils::actor::Message;
use agama_utils::api::network::Config;
use uuid::Uuid;

pub struct NewConnection {
    pub connection: Box<Connection>,
}

impl Message for NewConnection {
    type Reply = ();
}

pub struct GetConnection {
    pub id: String,
}

impl Message for GetConnection {
    type Reply = Option<Connection>;
}

pub struct GetConnectionByUuid {
    pub uuid: Uuid,
}

impl Message for GetConnectionByUuid {
    type Reply = Option<Connection>;
}

pub struct GetConfig;

impl Message for GetConfig {
    type Reply = Config;
}

pub struct GetProposal;

impl Message for GetProposal {
    type Reply = Proposal;
}

pub struct SetConfig {
    pub config: Box<Config>,
}

impl Message for SetConfig {
    type Reply = Result<(), NetworkSystemError>;
}

pub struct GetSystem;

impl Message for GetSystem {
    type Reply = SystemInfo;
}

pub struct GetConnections;

impl Message for GetConnections {
    type Reply = Vec<Connection>;
}

pub struct AddAccessPoint {
    pub access_point: Box<AccessPoint>,
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
    pub device: Box<Device>,
}

impl Message for AddDevice {
    type Reply = ();
}

pub struct UpdateDevice {
    pub name: String,
    pub device: Box<Device>,
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

pub struct GetDevice {
    pub name: String,
}

impl Message for GetDevice {
    type Reply = Option<Device>;
}

pub struct GetDevices;

impl Message for GetDevices {
    type Reply = Vec<Device>;
}

pub struct GetGeneralState;

impl Message for GetGeneralState {
    type Reply = GeneralState;
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
    type Reply = Result<(), NetworkStateError>;
}

pub struct Install;

impl Message for Install {
    type Reply = Result<(), NetworkStateError>;
}

pub struct UpdateConnection {
    pub connection: Box<Connection>,
}

impl Message for UpdateConnection {
    type Reply = Result<(), NetworkStateError>;
}

pub struct UpdateGeneralState {
    pub state: GeneralState,
}

impl Message for UpdateGeneralState {
    type Reply = ();
}

pub struct RefreshScan;

impl Message for RefreshScan {
    type Reply = Result<(), NetworkAdapterError>;
}

pub struct RemoveConnection {
    pub uuid: Uuid,
}

impl Message for RemoveConnection {
    type Reply = ();
}

pub struct Apply;

impl Message for Apply {
    type Reply = Result<(), NetworkAdapterError>;
}

#[derive(Clone)]
pub struct SetLocale {
    pub locale: String,
}

impl SetLocale {
    pub fn new(locale: &str) -> Self {
        Self {
            locale: locale.to_string(),
        }
    }
}

impl Message for SetLocale {
    type Reply = ();
}
