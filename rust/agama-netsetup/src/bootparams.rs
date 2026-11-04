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

//! Builds the dracut boot parameters equivalent to a network configuration, so the user can
//! put them in the parmfile or the boot loader next time and skip the interactive setup.
//!
//! See dracut.cmdline(7). NetworkManager's nm-initrd-generator implements the same syntax.

use crate::settings::prefix_to_netmask;
use agama_network::types::{IpConfig, Ipv4Method, Ipv6Method};
use std::net::IpAddr;

/// Returns the boot parameters for the given interfaces and proxy.
///
/// * `interfaces`: interface names with their configuration.
/// * `proxy`: proxy URL, if any.
pub fn boot_params(interfaces: &[(&str, &IpConfig)], proxy: Option<&str>) -> Vec<String> {
    let mut params = vec![];
    let mut nameservers: Vec<IpAddr> = vec![];

    for (name, ip) in interfaces {
        params.extend(interface_params(name, ip));
        for ns in &ip.nameservers {
            if !nameservers.contains(ns) {
                nameservers.push(*ns);
            }
        }
    }

    // dracut needs to know which interface to use when there are several ip= options.
    if interfaces.len() > 1 {
        if let Some((name, _)) = interfaces.first() {
            params.push(format!("bootdev={name}"));
        }
    }

    params.extend(nameservers.iter().map(|ns| format!("nameserver={ns}")));

    if let Some(proxy) = proxy.filter(|p| !p.is_empty()) {
        params.push(format!("proxy={proxy}"));
    }

    params
}

fn interface_params(name: &str, ip: &IpConfig) -> Vec<String> {
    let method4 = ip.method4.unwrap_or_default();
    let method6 = ip.method6.unwrap_or_default();
    let mut params = vec![];

    if method4 == Ipv4Method::Auto {
        params.push(format!("ip={name}:dhcp"));
    }
    if method6 == Ipv6Method::Dhcp {
        params.push(format!("ip={name}:dhcp6"));
    }

    let mut gateway4 = ip.gateway4.filter(|_| method4 == Ipv4Method::Manual);
    let mut gateway6 = ip.gateway6.filter(|_| method6 == Ipv6Method::Manual);

    for addr in &ip.addresses {
        let line = match addr.address() {
            IpAddr::V4(v4) if method4 == Ipv4Method::Manual => {
                let gw = gateway4.take().map(|g| g.to_string()).unwrap_or_default();
                let mask = prefix_to_netmask(addr.network_length());
                format!("ip={v4}::{gw}:{mask}::{name}:none")
            }
            IpAddr::V6(v6) if method6 == Ipv6Method::Manual => {
                let gw = gateway6
                    .take()
                    .map(|g| format!("[{g}]"))
                    .unwrap_or_default();
                let len = addr.network_length();
                format!("ip=[{v6}]::{gw}:{len}::{name}:none")
            }
            _ => continue,
        };
        params.push(line);
    }

    params
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::{parse_address, parse_ip};

    #[test]
    fn test_dhcp() {
        let ip = IpConfig {
            method4: Some(Ipv4Method::Auto),
            method6: Some(Ipv6Method::Auto),
            ..Default::default()
        };
        assert_eq!(boot_params(&[("eth0", &ip)], None), vec!["ip=eth0:dhcp"]);
    }

    #[test]
    fn test_static_dual_stack() {
        let ip = IpConfig {
            method4: Some(Ipv4Method::Manual),
            method6: Some(Ipv6Method::Manual),
            addresses: vec![
                parse_address("10.0.0.5/24").unwrap(),
                parse_address("10.0.1.5/24").unwrap(),
                parse_address("2001:db8::5/64").unwrap(),
            ],
            gateway4: Some(parse_ip("10.0.0.1").unwrap()),
            gateway6: Some(parse_ip("2001:db8::1").unwrap()),
            nameservers: vec![
                parse_ip("10.0.0.2").unwrap(),
                parse_ip("2001:db8::2").unwrap(),
            ],
            ..Default::default()
        };
        assert_eq!(
            boot_params(&[("eth0", &ip)], Some("http://proxy:3128")),
            vec![
                "ip=10.0.0.5::10.0.0.1:255.255.255.0::eth0:none",
                "ip=10.0.1.5:::255.255.255.0::eth0:none",
                "ip=[2001:db8::5]::[2001:db8::1]:64::eth0:none",
                "nameserver=10.0.0.2",
                "nameserver=2001:db8::2",
                "proxy=http://proxy:3128",
            ]
        );
    }

    #[test]
    fn test_several_interfaces() {
        let dhcp = IpConfig::default();
        let ip = IpConfig {
            method4: Some(Ipv4Method::Manual),
            method6: Some(Ipv6Method::Disabled),
            addresses: vec![parse_address("10.0.0.5/24").unwrap()],
            nameservers: vec![parse_ip("10.0.0.2").unwrap()],
            ..Default::default()
        };
        let other = ip.clone();
        assert_eq!(
            boot_params(
                &[("eth1", &ip), ("eth0", &dhcp), ("eth2", &other)],
                Some("")
            ),
            vec![
                "ip=10.0.0.5:::255.255.255.0::eth1:none",
                "ip=eth0:dhcp",
                "ip=10.0.0.5:::255.255.255.0::eth2:none",
                "bootdev=eth1",
                "nameserver=10.0.0.2",
            ]
        );
    }
}
