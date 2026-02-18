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

use crate::openapi::schemas;
use cidr::{errors::NetworkParseError, IpInet};
use serde::{Deserialize, Serialize};
use serde_with::{serde_as, skip_serializing_none, DisplayFromStr};
use std::{
    collections::HashMap,
    fmt,
    net::IpAddr,
    str::{self, FromStr},
};
use thiserror::Error;
use zbus::zvariant::Value;

/// Access Point
#[serde_as]
#[derive(Default, Debug, Clone, PartialEq, Deserialize, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AccessPoint {
    pub device: String,
    #[serde_as(as = "DisplayFromStr")]
    pub ssid: SSID,
    pub hw_address: String,
    pub strength: u8,
    pub flags: u32,
    pub rsn_flags: u32,
    pub wpa_flags: u32,
}

/// Network device
#[serde_as]
#[skip_serializing_none]
#[derive(Default, Debug, Clone, PartialEq, Deserialize, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: DeviceType,
    #[serde_as(as = "DisplayFromStr")]
    pub mac_address: MacAddress,
    pub ip_config: Option<IpConfig>,
    // Connection.id
    pub connection: Option<String>,
    pub state: DeviceState,
}

#[derive(Debug, Default, Clone, PartialEq, Serialize, utoipa::ToSchema)]
pub enum MacAddress {
    #[schema(value_type = String, format = "MAC address in EUI-48 format")]
    MacAddress(macaddr::MacAddr6),
    Preserve,
    Permanent,
    Random,
    Stable,
    #[default]
    Unset,
}

impl fmt::Display for MacAddress {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let output = match &self {
            Self::MacAddress(mac) => mac.to_string(),
            Self::Preserve => "preserve".to_string(),
            Self::Permanent => "permanent".to_string(),
            Self::Random => "random".to_string(),
            Self::Stable => "stable".to_string(),
            Self::Unset => "".to_string(),
        };
        write!(f, "{}", output)
    }
}

#[derive(Debug, Error)]
#[error("Invalid MAC address: {0}")]
pub struct InvalidMacAddress(String);

impl FromStr for MacAddress {
    type Err = InvalidMacAddress;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "preserve" => Ok(Self::Preserve),
            "permanent" => Ok(Self::Permanent),
            "random" => Ok(Self::Random),
            "stable" => Ok(Self::Stable),
            "" => Ok(Self::Unset),
            _ => Ok(Self::MacAddress(match macaddr::MacAddr6::from_str(s) {
                Ok(mac) => mac,
                Err(e) => return Err(InvalidMacAddress(e.to_string())),
            })),
        }
    }
}

impl TryFrom<&Option<String>> for MacAddress {
    type Error = InvalidMacAddress;

    fn try_from(value: &Option<String>) -> Result<Self, Self::Error> {
        match &value {
            Some(str) => MacAddress::from_str(str),
            None => Ok(Self::Unset),
        }
    }
}

impl From<InvalidMacAddress> for zbus::fdo::Error {
    fn from(value: InvalidMacAddress) -> Self {
        zbus::fdo::Error::Failed(value.to_string())
    }
}

#[derive(Debug, Default, Copy, Clone, PartialEq, Deserialize, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum LinkLocal {
    #[default]
    Default = 0,
    Auto = 1,
    Disabled = 2,
    Enabled = 3,
    Fallback = 4,
}

#[derive(Debug, Error)]
#[error("Invalid link-local value: {0}")]
pub struct InvalidLinkLocalValue(i32);

impl TryFrom<i32> for LinkLocal {
    type Error = InvalidLinkLocalValue;

    fn try_from(value: i32) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(LinkLocal::Default),
            1 => Ok(LinkLocal::Auto),
            2 => Ok(LinkLocal::Disabled),
            3 => Ok(LinkLocal::Enabled),
            4 => Ok(LinkLocal::Fallback),
            _ => Err(InvalidLinkLocalValue(value)),
        }
    }
}

#[skip_serializing_none]
#[derive(Default, Debug, PartialEq, Clone, Deserialize, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IpConfig {
    pub method4: Ipv4Method,
    pub method6: Ipv6Method,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[schema(schema_with = schemas::ip_inet_array)]
    pub addresses: Vec<IpInet>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[schema(schema_with = schemas::ip_addr_array)]
    pub nameservers: Vec<IpAddr>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub dns_searchlist: Vec<String>,
    pub ignore_auto_dns: bool,
    #[schema(schema_with = schemas::ip_addr)]
    pub gateway4: Option<IpAddr>,
    #[schema(schema_with = schemas::ip_addr)]
    pub gateway6: Option<IpAddr>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub routes4: Vec<IpRoute>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub routes6: Vec<IpRoute>,
    pub dhcp4_settings: Option<Dhcp4Settings>,
    pub dhcp6_settings: Option<Dhcp6Settings>,
    pub ip6_privacy: Option<i32>,
    pub dns_priority4: Option<i32>,
    pub dns_priority6: Option<i32>,
    pub link_local4: LinkLocal,
}

#[skip_serializing_none]
#[derive(Debug, Default, PartialEq, Clone, Deserialize, Serialize, utoipa::ToSchema)]
pub struct Dhcp4Settings {
    pub send_hostname: Option<bool>,
    pub hostname: Option<String>,
    pub send_release: Option<bool>,
    pub client_id: DhcpClientId,
    pub iaid: DhcpIaid,
}

#[skip_serializing_none]
#[derive(Debug, Default, PartialEq, Clone, Deserialize, Serialize, utoipa::ToSchema)]
pub struct Dhcp6Settings {
    pub send_hostname: Option<bool>,
    pub hostname: Option<String>,
    pub send_release: Option<bool>,
    pub duid: DhcpDuid,
    pub iaid: DhcpIaid,
}
#[derive(Debug, Default, Clone, PartialEq, Deserialize, Serialize, utoipa::ToSchema)]
pub enum DhcpClientId {
    Id(String),
    Mac,
    PermMac,
    Ipv6Duid,
    Duid,
    Stable,
    None,
    #[default]
    Unset,
}

impl From<&str> for DhcpClientId {
    fn from(s: &str) -> Self {
        match s {
            "mac" => Self::Mac,
            "perm-mac" => Self::PermMac,
            "ipv6-duid" => Self::Ipv6Duid,
            "duid" => Self::Duid,
            "stable" => Self::Stable,
            "none" => Self::None,
            "" => Self::Unset,
            _ => Self::Id(s.to_string()),
        }
    }
}

impl From<Option<String>> for DhcpClientId {
    fn from(value: Option<String>) -> Self {
        match &value {
            Some(str) => Self::from(str.as_str()),
            None => Self::Unset,
        }
    }
}

impl fmt::Display for DhcpClientId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let output = match &self {
            Self::Id(id) => id.to_string(),
            Self::Mac => "mac".to_string(),
            Self::PermMac => "perm-mac".to_string(),
            Self::Ipv6Duid => "ipv6-duid".to_string(),
            Self::Duid => "duid".to_string(),
            Self::Stable => "stable".to_string(),
            Self::None => "none".to_string(),
            Self::Unset => "".to_string(),
        };
        write!(f, "{}", output)
    }
}

#[derive(Debug, Default, Clone, PartialEq, Deserialize, Serialize, utoipa::ToSchema)]
pub enum DhcpDuid {
    Id(String),
    Lease,
    Llt,
    Ll,
    StableLlt,
    StableLl,
    StableUuid,
    #[default]
    Unset,
}

impl From<&str> for DhcpDuid {
    fn from(s: &str) -> Self {
        match s {
            "lease" => Self::Lease,
            "llt" => Self::Llt,
            "ll" => Self::Ll,
            "stable-llt" => Self::StableLlt,
            "stable-ll" => Self::StableLl,
            "stable-uuid" => Self::StableUuid,
            "" => Self::Unset,
            _ => Self::Id(s.to_string()),
        }
    }
}

impl From<Option<String>> for DhcpDuid {
    fn from(value: Option<String>) -> Self {
        match &value {
            Some(str) => Self::from(str.as_str()),
            None => Self::Unset,
        }
    }
}

impl fmt::Display for DhcpDuid {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let output = match &self {
            Self::Id(id) => id.to_string(),
            Self::Lease => "lease".to_string(),
            Self::Llt => "llt".to_string(),
            Self::Ll => "ll".to_string(),
            Self::StableLlt => "stable-llt".to_string(),
            Self::StableLl => "stable-ll".to_string(),
            Self::StableUuid => "stable-uuid".to_string(),
            Self::Unset => "".to_string(),
        };
        write!(f, "{}", output)
    }
}

#[derive(Debug, Default, Clone, PartialEq, Deserialize, Serialize, utoipa::ToSchema)]
pub enum DhcpIaid {
    Id(String),
    Mac,
    PermMac,
    Ifname,
    Stable,
    #[default]
    Unset,
}

impl From<&str> for DhcpIaid {
    fn from(s: &str) -> Self {
        match s {
            "mac" => Self::Mac,
            "perm-mac" => Self::PermMac,
            "ifname" => Self::Ifname,
            "stable" => Self::Stable,
            "" => Self::Unset,
            _ => Self::Id(s.to_string()),
        }
    }
}

impl From<Option<String>> for DhcpIaid {
    fn from(value: Option<String>) -> Self {
        match value {
            Some(str) => Self::from(str.as_str()),
            None => Self::Unset,
        }
    }
}

impl fmt::Display for DhcpIaid {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let output = match &self {
            Self::Id(id) => id.to_string(),
            Self::Mac => "mac".to_string(),
            Self::PermMac => "perm-mac".to_string(),
            Self::Ifname => "ifname".to_string(),
            Self::Stable => "stable".to_string(),
            Self::Unset => "".to_string(),
        };
        write!(f, "{}", output)
    }
}

#[derive(Debug, PartialEq, Clone, Deserialize, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IpRoute {
    #[schema(schema_with = schemas::ip_inet_ref)]
    pub destination: IpInet,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(schema_with = schemas::ip_addr)]
    pub next_hop: Option<IpAddr>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metric: Option<u32>,
}

impl From<&IpRoute> for HashMap<&str, Value<'_>> {
    fn from(route: &IpRoute) -> Self {
        let mut map: HashMap<&str, Value> = HashMap::from([
            ("dest", Value::new(route.destination.address().to_string())),
            (
                "prefix",
                Value::new(route.destination.network_length() as u32),
            ),
        ]);
        if let Some(next_hop) = route.next_hop {
            map.insert("next-hop", Value::new(next_hop.to_string()));
        }
        if let Some(metric) = route.metric {
            map.insert("metric", Value::new(metric));
        }
        map
    }
}

#[derive(Debug, Error)]
#[error("Unknown IP configuration method name: {0}")]
pub struct UnknownIpMethod(String);

#[derive(Debug, Default, Copy, Clone, PartialEq, Deserialize, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum Ipv4Method {
    Disabled = 0,
    #[default]
    Auto = 1,
    Manual = 2,
    LinkLocal = 3,
}

impl fmt::Display for Ipv4Method {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            Ipv4Method::Disabled => "disabled",
            Ipv4Method::Auto => "auto",
            Ipv4Method::Manual => "manual",
            Ipv4Method::LinkLocal => "link-local",
        };
        write!(f, "{}", name)
    }
}

impl FromStr for Ipv4Method {
    type Err = UnknownIpMethod;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "disabled" => Ok(Ipv4Method::Disabled),
            "auto" => Ok(Ipv4Method::Auto),
            "manual" => Ok(Ipv4Method::Manual),
            "link-local" => Ok(Ipv4Method::LinkLocal),
            _ => Err(UnknownIpMethod(s.to_string())),
        }
    }
}

#[derive(Debug, Default, Copy, Clone, PartialEq, Deserialize, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum Ipv6Method {
    Disabled = 0,
    #[default]
    Auto = 1,
    Manual = 2,
    LinkLocal = 3,
    Ignore = 4,
    Dhcp = 5,
}

impl fmt::Display for Ipv6Method {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            Ipv6Method::Disabled => "disabled",
            Ipv6Method::Auto => "auto",
            Ipv6Method::Manual => "manual",
            Ipv6Method::LinkLocal => "link-local",
            Ipv6Method::Ignore => "ignore",
            Ipv6Method::Dhcp => "dhcp",
        };
        write!(f, "{}", name)
    }
}

impl FromStr for Ipv6Method {
    type Err = UnknownIpMethod;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "disabled" => Ok(Ipv6Method::Disabled),
            "auto" => Ok(Ipv6Method::Auto),
            "manual" => Ok(Ipv6Method::Manual),
            "link-local" => Ok(Ipv6Method::LinkLocal),
            "ignore" => Ok(Ipv6Method::Ignore),
            "dhcp" => Ok(Ipv6Method::Dhcp),
            _ => Err(UnknownIpMethod(s.to_string())),
        }
    }
}

impl From<UnknownIpMethod> for zbus::fdo::Error {
    fn from(value: UnknownIpMethod) -> zbus::fdo::Error {
        zbus::fdo::Error::Failed(value.to_string())
    }
}
#[derive(Debug, Default, PartialEq, Clone, Serialize, Deserialize, utoipa::ToSchema)]
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

impl FromStr for SSID {
    type Err = NetworkParseError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(SSID(s.as_bytes().into()))
    }
}

impl From<SSID> for Vec<u8> {
    fn from(value: SSID) -> Self {
        value.0
    }
}

#[derive(Default, Debug, PartialEq, Copy, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum DeviceType {
    Loopback = 0,
    #[default]
    Ethernet = 1,
    Wireless = 2,
    Dummy = 3,
    Bond = 4,
    Vlan = 5,
    Bridge = 6,
}

/// Network device state.
#[derive(
    Default,
    Serialize,
    Deserialize,
    Debug,
    PartialEq,
    Eq,
    Clone,
    Copy,
    strum::Display,
    strum::EnumString,
    utoipa::ToSchema,
)]
#[strum(serialize_all = "camelCase")]
#[serde(rename_all = "camelCase")]
pub enum DeviceState {
    #[default]
    /// The device's state is unknown.
    Unknown,
    /// The device is recognized but not managed by Agama.
    Unmanaged,
    /// The device is detected but it cannot be used (wireless switched off, missing firmware, etc.).
    Unavailable,
    /// The device is connecting to the network.
    Connecting,
    /// The device is successfully connected to the network.
    Connected,
    /// The device is disconnecting from the network.
    Disconnecting,
    /// The device is disconnected from the network.
    Disconnected,
    /// The device failed to connect to a network.
    Failed,
}

#[derive(
    Default,
    Serialize,
    Deserialize,
    Debug,
    PartialEq,
    Eq,
    Clone,
    Copy,
    strum::Display,
    strum::EnumString,
    utoipa::ToSchema,
)]
#[strum(serialize_all = "camelCase")]
#[serde(rename_all = "camelCase")]
pub enum ConnectionState {
    /// The connection is getting activated.
    Activating,
    /// The connection is activated.
    Activated,
    /// The connection is getting deactivated.
    Deactivating,
    #[default]
    /// The connection is deactivated.
    Deactivated,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum Status {
    #[default]
    Up,
    Down,
    Removed,
    // Workaound for not modify the connection status
    Keep,
}

impl fmt::Display for Status {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match &self {
            Status::Up => "up",
            Status::Down => "down",
            Status::Keep => "keep",
            Status::Removed => "removed",
        };
        write!(f, "{}", name)
    }
}

#[derive(Debug, Error, PartialEq)]
#[error("Invalid status: {0}")]
pub struct InvalidStatus(String);

impl TryFrom<&str> for Status {
    type Error = InvalidStatus;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "up" => Ok(Status::Up),
            "down" => Ok(Status::Down),
            "keep" => Ok(Status::Keep),
            "removed" => Ok(Status::Removed),
            _ => Err(InvalidStatus(value.to_string())),
        }
    }
}

/// Bond mode
#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone, Copy, utoipa::ToSchema)]
pub enum BondMode {
    #[serde(rename = "balance-rr")]
    RoundRobin = 0,
    #[serde(rename = "active-backup")]
    ActiveBackup = 1,
    #[serde(rename = "balance-xor")]
    BalanceXOR = 2,
    #[serde(rename = "broadcast")]
    Broadcast = 3,
    #[serde(rename = "802.3ad")]
    LACP = 4,
    #[serde(rename = "balance-tlb")]
    BalanceTLB = 5,
    #[serde(rename = "balance-alb")]
    BalanceALB = 6,
}
impl Default for BondMode {
    fn default() -> Self {
        Self::RoundRobin
    }
}

impl std::fmt::Display for BondMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                BondMode::RoundRobin => "balance-rr",
                BondMode::ActiveBackup => "active-backup",
                BondMode::BalanceXOR => "balance-xor",
                BondMode::Broadcast => "broadcast",
                BondMode::LACP => "802.3ad",
                BondMode::BalanceTLB => "balance-tlb",
                BondMode::BalanceALB => "balance-alb",
            }
        )
    }
}

#[derive(Debug, Error, PartialEq)]
#[error("Invalid bond mode: {0}")]
pub struct InvalidBondMode(String);

impl TryFrom<&str> for BondMode {
    type Error = InvalidBondMode;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "balance-rr" => Ok(BondMode::RoundRobin),
            "active-backup" => Ok(BondMode::ActiveBackup),
            "balance-xor" => Ok(BondMode::BalanceXOR),
            "broadcast" => Ok(BondMode::Broadcast),
            "802.3ad" => Ok(BondMode::LACP),
            "balance-tlb" => Ok(BondMode::BalanceTLB),
            "balance-alb" => Ok(BondMode::BalanceALB),
            _ => Err(InvalidBondMode(value.to_string())),
        }
    }
}
impl TryFrom<u8> for BondMode {
    type Error = InvalidBondMode;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(BondMode::RoundRobin),
            1 => Ok(BondMode::ActiveBackup),
            2 => Ok(BondMode::BalanceXOR),
            3 => Ok(BondMode::Broadcast),
            4 => Ok(BondMode::LACP),
            5 => Ok(BondMode::BalanceTLB),
            6 => Ok(BondMode::BalanceALB),
            _ => Err(InvalidBondMode(value.to_string())),
        }
    }
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
            3 => Ok(DeviceType::Dummy),
            4 => Ok(DeviceType::Bond),
            5 => Ok(DeviceType::Vlan),
            6 => Ok(DeviceType::Bridge),
            _ => Err(InvalidDeviceType(value)),
        }
    }
}

impl From<InvalidBondMode> for zbus::fdo::Error {
    fn from(value: InvalidBondMode) -> zbus::fdo::Error {
        zbus::fdo::Error::Failed(format!("Network error: {value}"))
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

    #[test]
    fn test_display_bond_mode() {
        let mode = BondMode::try_from(1).unwrap();
        assert_eq!(format!("{}", mode), "active-backup");
    }

    #[test]
    fn test_macaddress() {
        let mut val: Option<String> = None;
        assert!(matches!(
            MacAddress::try_from(&val).unwrap(),
            MacAddress::Unset
        ));

        val = Some(String::from(""));
        assert!(matches!(
            MacAddress::try_from(&val).unwrap(),
            MacAddress::Unset
        ));

        val = Some(String::from("preserve"));
        assert!(matches!(
            MacAddress::try_from(&val).unwrap(),
            MacAddress::Preserve
        ));

        val = Some(String::from("permanent"));
        assert!(matches!(
            MacAddress::try_from(&val).unwrap(),
            MacAddress::Permanent
        ));

        val = Some(String::from("random"));
        assert!(matches!(
            MacAddress::try_from(&val).unwrap(),
            MacAddress::Random
        ));

        val = Some(String::from("stable"));
        assert!(matches!(
            MacAddress::try_from(&val).unwrap(),
            MacAddress::Stable
        ));

        val = Some(String::from("This is not a MACAddr"));
        assert!(matches!(
            MacAddress::try_from(&val),
            Err(InvalidMacAddress(_))
        ));

        val = Some(String::from("de:ad:be:ef:2b:ad"));
        assert_eq!(
            MacAddress::try_from(&val).unwrap().to_string(),
            String::from("de:ad:be:ef:2b:ad").to_uppercase()
        );
    }
}
