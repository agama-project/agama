use serde::{Deserialize, Serialize};
use std::{fmt, str};
use thiserror::Error;
use zbus;

/// Network device
#[derive(Debug, Clone)]
pub struct Device {
    pub name: String,
    pub type_: DeviceType,
}

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
        value.0
    }
}

#[derive(Debug, PartialEq, Copy, Clone, Serialize, Deserialize)]
pub enum DeviceType {
    Loopback = 0,
    Ethernet = 1,
    Wireless = 2,
    Bond = 3,
}

#[derive(Debug, Error, PartialEq)]
#[error("Invalid device type: {0}")]
pub struct InvalidDeviceType(u8);

impl TryFrom<u8> for DeviceType {
    type Error = InvalidDeviceType;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(DeviceType::Loopback),
            1 => Ok(DeviceType::Ethernet),
            2 => Ok(DeviceType::Wireless),
            3 => Ok(DeviceType::Bond),
            _ => Err(InvalidDeviceType(value)),
        }
    }
}

impl From<InvalidDeviceType> for zbus::fdo::Error {
    fn from(value: InvalidDeviceType) -> zbus::fdo::Error {
        zbus::fdo::Error::Failed(format!("Network error: {value}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_display_ssid() {
        let ssid = SSID(vec![97, 103, 97, 109, 97]);
        assert_eq!(format!("{}", ssid), "agama");
    }

    #[test]
    fn test_ssid_to_vec() {
        let vec = vec![97, 103, 97, 109, 97];
        let ssid = SSID(vec.clone());
        assert_eq!(ssid.to_vec(), &vec);
    }

    #[test]
    fn test_device_type_from_u8() {
        let dtype = DeviceType::try_from(0);
        assert_eq!(dtype, Ok(DeviceType::Loopback));

        let dtype = DeviceType::try_from(128);
        assert_eq!(dtype, Err(InvalidDeviceType(128)));
    }
}
