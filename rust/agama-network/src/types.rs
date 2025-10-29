// Copyright (c) [2024-2025] SUSE LLC
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

pub use agama_utils::api::network::*;
use serde::{Deserialize, Serialize};
use std::str::{self};
use thiserror::Error;

/// Network device
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct Device {
    pub name: String,
    pub type_: DeviceType,
    pub state: DeviceState,
}

// https://networkmanager.dev/docs/api/latest/nm-dbus-types.html#NMSettingsConnectionFlags
#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone, Copy, utoipa::ToSchema)]
pub enum ConnectionFlags {
    None = 0,
    Unsaved = 0x01,
    NmGenerated = 0x02,
    Volatile = 0x03,
    External = 0x04,
}

#[derive(Debug, Error, PartialEq)]
#[error("Invalid connection flag: {0}")]
pub struct InvalidConnectionFlag(u32);

impl TryFrom<u32> for ConnectionFlags {
    type Error = InvalidConnectionFlag;

    fn try_from(value: u32) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(ConnectionFlags::None),
            0x1 => Ok(ConnectionFlags::Unsaved),
            0x2 => Ok(ConnectionFlags::NmGenerated),
            0x3 => Ok(ConnectionFlags::Volatile),
            0x4 => Ok(ConnectionFlags::External),
            _ => Err(InvalidConnectionFlag(value)),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone, Copy, utoipa::ToSchema)]
pub enum AddFlags {
    None = 0,
    ToDisk = 0x1,
    InMemory = 0x2,
    BlockAutoconnect = 0x20,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone, Copy, utoipa::ToSchema)]
pub enum UpdateFlags {
    None = 0,
    ToDisk = 0x1,
    InMemory = 0x2,
    InMemoryDetached = 0x4,
    InMemoryOnly = 0x8,
    Volatile = 0x10,
    BlockAutoconnect = 0x20,
    NoReapply = 0x40,
}
