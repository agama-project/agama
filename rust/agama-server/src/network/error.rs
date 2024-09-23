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

//! Error types.
use thiserror::Error;

/// Errors that are related to the network configuration.
#[derive(Error, Debug)]
pub enum NetworkStateError {
    #[error("Unknown connection '{0}'")]
    UnknownConnection(String),
    #[error("Cannot update connection '{0}'")]
    CannotUpdateConnection(String),
    #[error("Unknown device '{0}'")]
    UnknownDevice(String),
    #[error("Invalid connection UUID: '{0}'")]
    InvalidUuid(String),
    #[error("Invalid IP address: '{0}'")]
    InvalidIpAddr(String),
    #[error("Invalid IP method: '{0}'")]
    InvalidIpMethod(u8),
    #[error("Invalid wireless mode: '{0}'")]
    InvalidWirelessMode(String),
    #[error("Connection '{0}' already exists")]
    ConnectionExists(String),
    #[error("Invalid security wireless protocol: '{0}'")]
    InvalidSecurityProtocol(String),
    #[error("Adapter error: '{0}'")]
    AdapterError(String),
    #[error("Invalid bond mode '{0}'")]
    InvalidBondMode(String),
    #[error("Invalid bond options")]
    InvalidBondOptions,
    #[error("Not a controller connection: '{0}'")]
    NotControllerConnection(String),
    #[error("Unexpected configuration")]
    UnexpectedConfiguration,
    #[error("Invalid WEP authentication algorithm: '{0}'")]
    InvalidWEPAuthAlg(String),
    #[error("Invalid WEP key type: '{0}'")]
    InvalidWEPKeyType(u32),
    #[error("Invalid EAP method: '{0}'")]
    InvalidEAPMethod(String),
    #[error("Invalid phase2 authentication method: '{0}'")]
    InvalidPhase2AuthMethod(String),
    #[error("Invalid group algorithm: '{0}'")]
    InvalidGroupAlgorithm(String),
    #[error("Invalid pairwise algorithm: '{0}'")]
    InvalidPairwiseAlgorithm(String),
    #[error("Invalid WPA protocol version: '{0}'")]
    InvalidWPAProtocolVersion(String),
    #[error("Invalid wireless band: '{0}'")]
    InvalidWirelessBand(String),
    #[error("Invalid bssid: '{0}'")]
    InvalidBssid(String),
}

impl From<NetworkStateError> for zbus::fdo::Error {
    fn from(value: NetworkStateError) -> zbus::fdo::Error {
        zbus::fdo::Error::Failed(format!("Network error: {value}"))
    }
}
