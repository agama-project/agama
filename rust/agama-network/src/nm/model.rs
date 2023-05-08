//! Set of structs and enums to handle devices and connections from NetworkManager.
//!
//! This are meant to be used internally, so we omit everything it is not useful for us.

/// NetworkManager device
#[derive(Debug, Default)]
pub struct NmDevice {
    /// D-Bus path of the device. It is used as a sort of ID.
    pub path: String,
    /// Interface name
    pub iface: String,
    /// Device type
    pub device_type: NmDeviceType,
}

impl NmDevice {
    /// Determines whether it is a wireless device
    pub fn is_wireless(&self) -> bool {
        matches!(&self.device_type, NmDeviceType(2))
    }
}

/// NetworkManager connection
#[derive(Debug, Default, PartialEq)]
pub struct NmConnection {
    /// Connection ID
    pub id: String,
    /// Wireless settings
    pub wireless: Option<NmWireless>,
    /// IPv4 configuration
    pub ipv4: Option<NmIp4Config>,
}

#[derive(Debug, Default, PartialEq)]
pub struct NmWireless {
    /// Network wireless mode
    pub mode: NmWirelessMode,
    /// Wireless SSID
    pub ssid: Vec<u8>,
    /// Key management
    pub key_mgmt: NmKeyManagement,
}

/// NetworkManager wireless mode
///
/// Using the newtype pattern around an String is enough. For proper support, we might replace this
/// struct with an enum.
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

#[derive(Debug, Default, PartialEq)]
pub struct NmIp4Config {
    pub addresses: Vec<(String, u32)>,
    pub nameservers: Vec<String>,
    pub method: NmMethod,
}
