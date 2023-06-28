use serde::{Deserialize, Serialize};
use std::{fmt, str};
use thiserror::Error;
use zbus;

#[derive(Debug, Default, PartialEq, Clone, Serialize, Deserialize)]
pub struct SSID(pub Vec<u8>);

impl SSID {
    pub fn to_vec(&self) -> &Vec<u8> {
        &self.0
    }
}

impl fmt::Display for SSID {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", str::from_utf8(&self.0).unwrap())
    }
}

impl From<SSID> for Vec<u8> {
    fn from(value: SSID) -> Self {
        value.0.clone()
    }
}

#[derive(Debug, PartialEq, Copy, Clone)]
pub enum DeviceType {
    Loopback = 0,
    Ethernet = 1,
    Wireless = 2,
}

#[derive(Debug, Error)]
#[error("Invalid device type: {0}")]
pub struct InvalidDeviceType(u8);

impl TryFrom<u8> for DeviceType {
    type Error = InvalidDeviceType;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(DeviceType::Loopback),
            1 => Ok(DeviceType::Ethernet),
            2 => Ok(DeviceType::Wireless),
            _ => Err(InvalidDeviceType(value)),
        }
    }
}

impl From<InvalidDeviceType> for zbus::fdo::Error {
    fn from(value: InvalidDeviceType) -> zbus::fdo::Error {
        zbus::fdo::Error::Failed(format!("Network error: {}", value.to_string()))
    }
}
