// Copyright (c) [2025] SUSE LLC
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

//! Representation of the network settings

use serde::{Deserialize, Serialize};
use std::default::Default;

use crate::{
    error::NetworkStateError,
    model::{AccessPoint, Device, GeneralState},
    settings::NetworkConnection,
    NetworkState,
};

/// Network settings for installation
#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub access_points: Vec<AccessPoint>,
    /// Connections to use in the installation
    pub connections: Vec<NetworkConnection>,
    pub devices: Vec<Device>,
    pub general_state: GeneralState,
}

impl TryFrom<NetworkState> for SystemInfo {
    type Error = NetworkStateError;

    fn try_from(state: NetworkState) -> Result<Self, Self::Error> {
        let connections = &state.connections;
        let network_connections = connections
            .iter()
            .filter(|c| c.controller.is_none())
            .map(|c| {
                let mut conn = NetworkConnection::try_from(c.clone()).unwrap();
                if let Some(ref mut bond) = conn.bond {
                    bond.ports = state.ports_for(c.uuid);
                }
                if let Some(ref mut bridge) = conn.bridge {
                    bridge.ports = state.ports_for(c.uuid);
                };
                conn
            })
            .collect();
        let access_points = state.access_points;
        let devices = state.devices;
        let general_state = state.general_state;

        Ok(SystemInfo {
            access_points,
            devices,
            connections: network_connections,
            general_state,
        })
    }
}
