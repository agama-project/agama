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

//! Set of structs and enums to handle devices and connections from NetworkManager.
//!
//! This are meant to be used internally, so we omit everything it is not useful for us.

/// NetworkManager wireless mode
///
/// Using the newtype pattern around an String is enough. For proper support, we might replace this
/// struct with an enum.
use crate::network::{
    model::{Ipv4Method, Ipv6Method, SecurityProtocol, WirelessMode},
    nm::error::NmError,
};
use agama_lib::network::types::DeviceType;
use std::fmt;
use std::str::FromStr;

#[derive(Debug, PartialEq)]
pub struct NmWirelessMode(pub String);

impl Default for NmWirelessMode {
    fn default() -> Self {
        NmWirelessMode("infrastructure".to_string())
    }
}

impl From<&str> for NmWirelessMode {
    fn from(value: &str) -> Self {
        Self(value.to_string())
    }
}

impl NmWirelessMode {
    pub fn as_str(&self) -> &str {
        self.0.as_str()
    }
}

impl TryFrom<NmWirelessMode> for WirelessMode {
    type Error = NmError;

    fn try_from(value: NmWirelessMode) -> Result<Self, Self::Error> {
        match value.as_str() {
            "infrastructure" => Ok(WirelessMode::Infra),
            "adhoc" => Ok(WirelessMode::AdHoc),
            "mesh" => Ok(WirelessMode::Mesh),
            "ap" => Ok(WirelessMode::AP),
            _ => Err(NmError::UnsupporedWirelessMode(value.to_string())),
        }
    }
}

impl fmt::Display for NmWirelessMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", &self.0)
    }
}

/// Device types
///
/// As we are using the number just to filter wireless devices, using the newtype
/// pattern around an u32 is enough. For proper support, we might replace this
/// struct with an enum.
#[derive(Debug, Default, Clone, Copy)]
pub struct NmDeviceType(pub u32);

impl From<NmDeviceType> for u32 {
    fn from(value: NmDeviceType) -> u32 {
        value.0
    }
}

impl fmt::Display for NmDeviceType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl TryFrom<NmDeviceType> for DeviceType {
    type Error = NmError;

    fn try_from(value: NmDeviceType) -> Result<Self, Self::Error> {
        match value {
            NmDeviceType(1) => Ok(DeviceType::Ethernet),
            NmDeviceType(2) => Ok(DeviceType::Wireless),
            NmDeviceType(10) => Ok(DeviceType::Bond),
            NmDeviceType(13) => Ok(DeviceType::Bridge),
            NmDeviceType(22) => Ok(DeviceType::Dummy),
            NmDeviceType(32) => Ok(DeviceType::Loopback),
            NmDeviceType(_) => Err(NmError::UnsupportedDeviceType(value.into())),
        }
    }
}

/// Device state
#[derive(Default, Debug, PartialEq, Copy, Clone)]
pub enum NmDeviceState {
    #[default]
    Unknown = 0,
    Unmanaged = 10,
    Unavailable = 20,
    Disconnected = 30,
    Prepare = 40,
    Config = 50,
    NeedAuth = 60,
    IpConfig = 70,
    IpCheck = 80,
    Secondaries = 90,
    Activated = 100,
    Deactivating = 110,
    Failed = 120,
}

#[derive(Debug, thiserror::Error, PartialEq)]
#[error("Invalid state: {0}")]
pub struct InvalidNmDeviceState(String);

impl TryFrom<u8> for NmDeviceState {
    type Error = InvalidNmDeviceState;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(NmDeviceState::Unknown),
            10 => Ok(NmDeviceState::Unmanaged),
            20 => Ok(NmDeviceState::Unavailable),
            30 => Ok(NmDeviceState::Disconnected),
            40 => Ok(NmDeviceState::Prepare),
            50 => Ok(NmDeviceState::Config),
            60 => Ok(NmDeviceState::NeedAuth),
            70 => Ok(NmDeviceState::IpConfig),
            80 => Ok(NmDeviceState::IpCheck),
            90 => Ok(NmDeviceState::Secondaries),
            100 => Ok(NmDeviceState::Activated),
            110 => Ok(NmDeviceState::Deactivating),
            120 => Ok(NmDeviceState::Failed),
            _ => Err(InvalidNmDeviceState(value.to_string())),
        }
    }
}

/// Key management
///
/// Using the newtype pattern around an String is enough. For proper support, we might replace this
/// struct with an enum.
#[derive(Debug, PartialEq)]
pub struct NmKeyManagement(pub String);

impl Default for NmKeyManagement {
    fn default() -> Self {
        NmKeyManagement("none".to_string())
    }
}

impl From<&str> for NmKeyManagement {
    fn from(value: &str) -> Self {
        Self(value.to_string())
    }
}

impl TryFrom<NmKeyManagement> for SecurityProtocol {
    type Error = NmError;

    fn try_from(value: NmKeyManagement) -> Result<Self, Self::Error> {
        match value.as_str() {
            "owe" => Ok(SecurityProtocol::OWE),
            "ieee8021x" => Ok(SecurityProtocol::DynamicWEP),
            "wpa-psk" => Ok(SecurityProtocol::WPA2),
            "wpa-eap" => Ok(SecurityProtocol::WPA3Personal),
            "sae" => Ok(SecurityProtocol::WPA2Enterprise),
            "wpa-eap-suite-b-192" => Ok(SecurityProtocol::WPA2Enterprise),
            "none" => Ok(SecurityProtocol::WEP),
            _ => Err(NmError::UnsupportedSecurityProtocol(value.to_string())),
        }
    }
}

impl NmKeyManagement {
    pub fn as_str(&self) -> &str {
        self.0.as_str()
    }
}

impl fmt::Display for NmKeyManagement {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", &self.0)
    }
}

#[derive(Debug, PartialEq)]
pub struct NmMethod(pub String);

impl Default for NmMethod {
    fn default() -> Self {
        NmMethod("auto".to_string())
    }
}

impl NmMethod {
    pub fn as_str(&self) -> &str {
        self.0.as_str()
    }
}

impl TryFrom<NmMethod> for Ipv4Method {
    type Error = NmError;

    fn try_from(value: NmMethod) -> Result<Self, Self::Error> {
        match Ipv4Method::from_str(value.as_str()) {
            Ok(method) => Ok(method),
            _ => Err(NmError::UnsupportedIpMethod(value.to_string())),
        }
    }
}

impl TryFrom<NmMethod> for Ipv6Method {
    type Error = NmError;

    fn try_from(value: NmMethod) -> Result<Self, Self::Error> {
        match Ipv6Method::from_str(value.as_str()) {
            Ok(method) => Ok(method),
            _ => Err(NmError::UnsupportedIpMethod(value.to_string())),
        }
    }
}

impl fmt::Display for NmMethod {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", &self.0)
    }
}

#[derive(Debug, Default, PartialEq)]
pub struct NmIp4Config {
    pub addresses: Vec<(String, u32)>,
    pub nameservers: Vec<String>,
    pub gateway: Option<String>,
    pub method: NmMethod,
}
