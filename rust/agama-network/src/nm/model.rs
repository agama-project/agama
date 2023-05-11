//! Set of structs and enums to handle devices and connections from NetworkManager.
//!
//! This are meant to be used internally, so we omit everything it is not useful for us.

/// NetworkManager wireless mode
///
/// Using the newtype pattern around an String is enough. For proper support, we might replace this
/// struct with an enum.
use crate::model::{DeviceType, IpMethod, SecurityProtocol, WirelessMode};

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
        &self.0.as_str()
    }
}

impl From<NmWirelessMode> for WirelessMode {
    fn from(value: NmWirelessMode) -> Self {
        match value.as_str() {
            "infrastructure" => WirelessMode::Infra,
            "adhoc" => WirelessMode::AdHoc,
            "mesh" => WirelessMode::Mesh,
            "ap" => WirelessMode::AP,
            _ => WirelessMode::Other,
        }
    }
}

/// Device types
///
/// As we are using the number just to filter wireless devices, using the newtype
/// pattern around an u32 is enough. For proper support, we might replace this
/// struct with an enum.
#[derive(Debug)]
pub struct NmDeviceType(pub u32);

impl Default for NmDeviceType {
    fn default() -> Self {
        NmDeviceType(0)
    }
}

impl From<NmDeviceType> for DeviceType {
    fn from(value: NmDeviceType) -> Self {
        match value {
            NmDeviceType(1) => DeviceType::Ethernet,
            NmDeviceType(2) => DeviceType::Wireless,
            _ => DeviceType::Unknown,
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

impl From<NmKeyManagement> for SecurityProtocol {
    fn from(value: NmKeyManagement) -> Self {
        match value.as_str() {
            "owe" => SecurityProtocol::OWE,
            "ieee8021x" => SecurityProtocol::DynamicWEP,
            "wpa-psk" => SecurityProtocol::WPA2,
            "wpa-eap" => SecurityProtocol::WPA3Personal,
            "sae" => SecurityProtocol::WPA2Enterprise,
            "wpa-eap-suite-b192" => SecurityProtocol::WPA2Enterprise,
            _ => SecurityProtocol::WEP,
        }
    }
}

impl NmKeyManagement {
    pub fn as_str(&self) -> &str {
        &self.0.as_str()
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
        &self.0.as_str()
    }
}

impl From<NmMethod> for IpMethod {
    fn from(value: NmMethod) -> Self {
        match value.as_str() {
            "auto" => IpMethod::Auto,
            "manual" => IpMethod::Manual,
            _ => IpMethod::Unknown,
        }
    }
}

#[derive(Debug, Default, PartialEq)]
pub struct NmIp4Config {
    pub addresses: Vec<(String, u32)>,
    pub nameservers: Vec<String>,
    pub gateway: Option<String>,
    pub method: NmMethod,
}
