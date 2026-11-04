// Copyright (c) [2026] SUSE LLC
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

//! Settings entered by the user and the parsing of the values typed at the prompts.

use agama_network::types::{IpConfig, Ipv4Method, Ipv6Method};
use cidr::IpInet;
use std::net::{IpAddr, Ipv4Addr};

/// How to configure the IP addresses of a device.
#[derive(Clone, Debug, PartialEq)]
pub enum Method {
    /// DHCPv4 and IPv6 autoconfiguration.
    Dhcp,
    /// Static addresses.
    Static(StaticConfig),
}

/// Static IP configuration.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct StaticConfig {
    pub addresses: Vec<IpInet>,
    pub gateway4: Option<IpAddr>,
    pub gateway6: Option<IpAddr>,
    pub nameservers: Vec<IpAddr>,
    pub search: Vec<String>,
}

impl StaticConfig {
    pub fn has_ipv4(&self) -> bool {
        self.addresses.iter().any(|a| a.is_ipv4())
    }

    pub fn has_ipv6(&self) -> bool {
        self.addresses.iter().any(|a| a.is_ipv6())
    }
}

impl Method {
    /// Applies the method to an IP configuration, keeping the settings it does not cover.
    pub fn apply_to(&self, ip: &mut IpConfig) {
        match self {
            Method::Dhcp => {
                ip.method4 = Some(Ipv4Method::Auto);
                ip.method6 = Some(Ipv6Method::Auto);
                ip.addresses.clear();
                ip.gateway4 = None;
                ip.gateway6 = None;
                ip.nameservers.clear();
                ip.dns_searchlist.clear();
            }
            Method::Static(config) => {
                ip.method4 = Some(if config.has_ipv4() {
                    Ipv4Method::Manual
                } else {
                    Ipv4Method::Disabled
                });
                ip.method6 = Some(if config.has_ipv6() {
                    Ipv6Method::Manual
                } else {
                    Ipv6Method::Auto
                });
                ip.addresses = config.addresses.clone();
                ip.gateway4 = config.gateway4;
                ip.gateway6 = config.gateway6;
                ip.nameservers = config.nameservers.clone();
                ip.dns_searchlist = config.search.clone();
            }
        }
    }
}

/// Parses an address with its network prefix.
///
/// The prefix can be given as a length ("192.168.1.5/24") or as an IPv4 netmask
/// ("192.168.1.5/255.255.255.0").
pub fn parse_address(value: &str) -> Result<IpInet, String> {
    let value = value.trim();
    let Some((addr, prefix)) = value.split_once('/') else {
        return Err(format!(
            "'{value}' has no network prefix, use e.g. 192.168.1.5/24"
        ));
    };

    let addr: IpAddr = addr
        .parse()
        .map_err(|_| format!("'{addr}' is not a valid IP address"))?;

    let len: u8 = match prefix.parse::<u8>() {
        Ok(len) => len,
        Err(_) => {
            let mask: Ipv4Addr = prefix
                .parse()
                .map_err(|_| format!("'{prefix}' is not a valid prefix or netmask"))?;
            netmask_to_prefix(mask).ok_or(format!("'{prefix}' is not a valid netmask"))?
        }
    };

    IpInet::new(addr, len).map_err(|_| format!("'{value}' has an invalid network prefix"))
}

/// Parses a single IP address without prefix.
pub fn parse_ip(value: &str) -> Result<IpAddr, String> {
    let value = value.trim();
    value
        .parse()
        .map_err(|_| format!("'{value}' is not a valid IP address"))
}

/// Splits a list separated by commas or spaces.
pub fn split_list(value: &str) -> Vec<&str> {
    value
        .split(|c: char| c == ',' || c.is_whitespace())
        .filter(|s| !s.is_empty())
        .collect()
}

/// Converts an IPv4 netmask to a prefix length, `None` if the mask is not contiguous.
pub fn netmask_to_prefix(mask: Ipv4Addr) -> Option<u8> {
    let bits = u32::from(mask);
    let len = bits.leading_ones();
    (bits.checked_shl(len).unwrap_or(0) == 0).then_some(len as u8)
}

/// Converts a prefix length to an IPv4 netmask.
pub fn prefix_to_netmask(len: u8) -> Ipv4Addr {
    let bits = u32::MAX
        .checked_shl(32 - u32::from(len.min(32)))
        .unwrap_or(0);
    Ipv4Addr::from(bits)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_address_with_prefix() {
        let addr = parse_address("192.168.1.5/24").unwrap();
        assert_eq!(addr.to_string(), "192.168.1.5/24");
    }

    #[test]
    fn test_parse_address_with_netmask() {
        let addr = parse_address(" 10.1.2.3/255.255.0.0 ").unwrap();
        assert_eq!(addr.to_string(), "10.1.2.3/16");
    }

    #[test]
    fn test_parse_ipv6_address() {
        let addr = parse_address("2001:db8::5/64").unwrap();
        assert_eq!(addr.to_string(), "2001:db8::5/64");
    }

    #[test]
    fn test_parse_address_errors() {
        assert!(parse_address("192.168.1.5").is_err());
        assert!(parse_address("192.168.1.500/24").is_err());
        assert!(parse_address("192.168.1.5/33").is_err());
        assert!(parse_address("192.168.1.5/255.0.255.0").is_err());
    }

    #[test]
    fn test_netmask_conversions() {
        assert_eq!(
            netmask_to_prefix("255.255.255.0".parse().unwrap()),
            Some(24)
        );
        assert_eq!(
            netmask_to_prefix("255.255.255.255".parse().unwrap()),
            Some(32)
        );
        assert_eq!(netmask_to_prefix("0.0.0.0".parse().unwrap()), Some(0));
        assert_eq!(netmask_to_prefix("255.0.255.0".parse().unwrap()), None);
        assert_eq!(prefix_to_netmask(24).to_string(), "255.255.255.0");
        assert_eq!(prefix_to_netmask(0).to_string(), "0.0.0.0");
        assert_eq!(prefix_to_netmask(32).to_string(), "255.255.255.255");
    }

    #[test]
    fn test_split_list() {
        assert_eq!(split_list("a, b c,,d"), vec!["a", "b", "c", "d"]);
        assert!(split_list("  ").is_empty());
    }

    #[test]
    fn test_apply_static_ipv4_only() {
        let config = StaticConfig {
            addresses: vec![parse_address("10.0.0.5/24").unwrap()],
            gateway4: Some(parse_ip("10.0.0.1").unwrap()),
            nameservers: vec![parse_ip("10.0.0.2").unwrap()],
            search: vec!["example.com".to_string()],
            ..Default::default()
        };
        let mut ip = IpConfig::default();
        Method::Static(config).apply_to(&mut ip);
        assert_eq!(ip.method4, Some(Ipv4Method::Manual));
        assert_eq!(ip.method6, Some(Ipv6Method::Auto));
        assert_eq!(ip.addresses.len(), 1);
        assert_eq!(ip.dns_searchlist, vec!["example.com".to_string()]);
    }

    #[test]
    fn test_apply_dhcp_clears_static_values() {
        let mut ip = IpConfig {
            method4: Some(Ipv4Method::Manual),
            addresses: vec![parse_address("10.0.0.5/24").unwrap()],
            gateway4: Some(parse_ip("10.0.0.1").unwrap()),
            ..Default::default()
        };
        Method::Dhcp.apply_to(&mut ip);
        assert_eq!(ip.method4, Some(Ipv4Method::Auto));
        assert!(ip.addresses.is_empty());
        assert!(ip.gateway4.is_none());
    }
}
