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

//! NetworkManager error types
use crate::network::error::NetworkStateError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum NmError {
    #[error("Unsupported IP method: '{0}'")]
    UnsupportedIpMethod(String),
    #[error("Unsupported device type: '{0}'")]
    UnsupportedDeviceType(u32),
    #[error("Unsupported security protocol: '{0}'")]
    UnsupportedSecurityProtocol(String),
    #[error("Unsupported wireless mode: '{0}'")]
    UnsupporedWirelessMode(String),
}

impl From<NmError> for NetworkStateError {
    fn from(value: NmError) -> NetworkStateError {
        NetworkStateError::AdapterError(value.to_string())
    }
}
