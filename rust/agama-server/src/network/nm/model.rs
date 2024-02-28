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
            NmDeviceType(0) => Ok(DeviceType::Loopback),
            NmDeviceType(1) => Ok(DeviceType::Ethernet),
            NmDeviceType(2) => Ok(DeviceType::Wireless),
            NmDeviceType(3) => Ok(DeviceType::Dummy),
            NmDeviceType(10) => Ok(DeviceType::Bond),
            NmDeviceType(_) => Err(NmError::UnsupportedDeviceType(value.into())),
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
            "wpa-eap-suite-b192" => Ok(SecurityProtocol::WPA2Enterprise),
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
