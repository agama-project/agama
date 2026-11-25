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
use agama_utils::api::network::Config;
use agama_utils::define_message;
use uuid::Uuid;

define_message!(NewConnection { connection: Connection } -> ());
define_message!(GetConfig -> Config);
define_message!(GetProposal -> Proposal);

define_message!(
    /// Sets the network configuration and applies it to the system.
    ///
    /// Unlike other services, the configuration is not optional: the network configuration is applied
    /// to the running system, so when a profile has no network section, the network is left untouched
    /// instead of resetting it to the defaults.
    SetConfig { config: Config } -> ()
);

define_message!(GetSystem -> SystemInfo);
define_message!(AddAccessPoint { access_point: AccessPoint } -> ());
define_message!(RemoveAccessPoint { hw_address: String } -> ());
define_message!(AddDevice { device: Device } -> ());
define_message!(UpdateDevice { name: String, device: Device } -> ());
define_message!(RemoveDevice { name: String } -> ());
define_message!(ChangeConnectionState { uuid: Uuid, state: ConnectionState } -> ());
define_message!(Install -> ());
define_message!(UpdateGeneralState { state: GeneralState } -> ());
define_message!(RemoveConnection { uuid: Uuid } -> ());
