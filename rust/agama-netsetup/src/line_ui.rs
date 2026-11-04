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

//! Line oriented user interface.
//!
//! It only writes whole lines and reads whole lines, without any escape sequence, so it works on
//! consoles that cannot run full-screen applications, like the s390x 3270 and 3215 consoles,
//! the same way linuxrc did. Menus are numbered and the user types the number of the option.

use crate::{
    checks::{Check, Outcome},
    engine::{Backend, DeviceInfo},
    proxy::{mask_password, ProxyStore},
    settings::{parse_address, parse_ip, split_list, Method, StaticConfig},
};
use std::{
    fmt::Display,
    io::{self, BufRead, Write},
    net::IpAddr,
};

const INPUT_HELP: &str =
    "Press Enter to keep the value in brackets, '-' to clear it, '<' to go back.";

/// Answer to a text prompt.
#[derive(Debug, PartialEq)]
enum Input {
    Value(String),
    Back,
}

pub struct LineUi<'a, R, W, B> {
    input: R,
    output: W,
    backend: B,
    proxy: &'a ProxyStore,
    test_url: String,
}

impl<'a, R: BufRead, W: Write, B: Backend> LineUi<'a, R, W, B> {
    pub fn new(input: R, output: W, backend: B, proxy: &'a ProxyStore, test_url: &str) -> Self {
        Self {
            input,
            output,
            backend,
            proxy,
            test_url: test_url.to_string(),
        }
    }

    /// Runs the main menu until the user decides to continue.
    ///
    /// Reaching the end of the input is handled as "continue".
    pub fn run(&mut self) -> io::Result<()> {
        match self.main_menu() {
            Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => {
                self.say("")?;
                Ok(())
            }
            result => result,
        }
    }

    fn main_menu(&mut self) -> io::Result<()> {
        let items = [
            "Configure a network device",
            "Test the network connection",
            "Configure the proxy",
            "Show the boot options for this setup",
            "Refresh the status",
        ];
        loop {
            self.title("Network setup")?;
            self.status()?;
            match self.menu(&items, "Continue the installation")? {
                None => return Ok(()),
                Some(0) => self.configure_device()?,
                Some(1) => self.test_connection()?,
                Some(2) => self.configure_proxy()?,
                Some(3) => self.show_boot_params()?,
                _ => {}
            }
        }
    }

    /// Prints the devices, gateways, DNS servers and proxy.
    fn status(&mut self) -> io::Result<()> {
        let devices = match self.backend.devices() {
            Ok(devices) => devices,
            Err(e) => return self.error(e),
        };

        if devices.is_empty() {
            self.say("No network device found.")?;
        } else {
            self.say(&format!(
                "{:<15} {:<9} {:<13} {:<4} Addresses",
                "Device", "Type", "State", "Link"
            ))?;
            for device in &devices {
                let link = match device.carrier {
                    Some(true) => "yes",
                    Some(false) => "no",
                    None => "-",
                };
                // interface names have up to 15 characters (IFNAMSIZ)
                let mut addresses = device.addresses.iter().map(ToString::to_string);
                self.say(&format!(
                    "{:<15} {:<9} {:<13} {:<4} {}",
                    device.name,
                    device.kind,
                    device.state,
                    link,
                    addresses.next().unwrap_or("-".to_string())
                ))?;
                for addr in addresses {
                    self.say(&format!("{:45}{addr}", ""))?;
                }
            }
        }

        self.say("")?;
        let gateways: Vec<String> = devices
            .iter()
            .flat_map(|d| {
                [d.gateway4, d.gateway6]
                    .into_iter()
                    .flatten()
                    .map(move |gw| format!("{gw} ({})", d.name))
            })
            .collect();
        self.say(&format!("Gateway:     {}", list_or_none(&gateways)))?;
        let mut nameservers: Vec<IpAddr> = vec![];
        for ns in devices.iter().flat_map(|d| &d.nameservers) {
            if !nameservers.contains(ns) {
                nameservers.push(*ns);
            }
        }
        self.say(&format!("DNS servers: {}", list_or_none(&nameservers)))?;
        let proxy = self.proxy.read().map(|p| mask_password(&p));
        self.say(&format!(
            "Proxy:       {}",
            proxy.as_deref().unwrap_or("none")
        ))
    }

    fn configure_device(&mut self) -> io::Result<()> {
        let devices = match self.backend.devices() {
            Ok(devices) => devices,
            Err(e) => return self.error(e),
        };
        if devices.is_empty() {
            return self.say("No network device found.");
        }

        self.title("Select the device to configure")?;
        let items: Vec<String> = devices.iter().map(device_label).collect();
        let Some(index) = self.menu(&items, "Back")? else {
            return Ok(());
        };
        let device = &devices[index];

        self.title(&format!("Configuration of {}", device.name))?;
        let methods = ["Automatic (DHCP)", "Static addresses"];
        let method = match self.menu(&methods, "Back")? {
            Some(0) => Method::Dhcp,
            Some(1) => match self.static_form(device)? {
                Some(config) => Method::Static(config),
                None => return Ok(()),
            },
            _ => return Ok(()),
        };

        self.title("Summary")?;
        self.say(&format!("Device:      {}", device.name))?;
        self.show_method(&method)?;
        self.say("")?;
        if self.menu(&["Apply"], "Cancel")?.is_none() {
            return Ok(());
        }

        self.say(&format!(
            "Applying the configuration to {}, please wait...",
            device.name
        ))?;
        match self.backend.configure(&device.name, &method) {
            Ok(result) => {
                if result.connected {
                    self.say(&format!("{} is connected.", result.name))?;
                } else {
                    self.say(&format!(
                        "Warning: {} is not connected (state: {}).",
                        result.name, result.state
                    ))?;
                }
                let addresses: Vec<String> =
                    result.addresses.iter().map(ToString::to_string).collect();
                self.say(&format!("Addresses:   {}", list_or_none(&addresses)))?;
            }
            Err(e) => return self.error(e),
        }

        self.say("")?;
        if self
            .menu(&["Test the network connection"], "Back")?
            .is_some()
        {
            self.test_connection()?;
        }
        Ok(())
    }

    /// Asks for the static configuration, `None` if the user goes back.
    fn static_form(&mut self, device: &DeviceInfo) -> io::Result<Option<StaticConfig>> {
        self.title(&format!("Static configuration of {}", device.name))?;
        self.say(INPUT_HELP)?;
        let current = device.as_static();
        let mut config = StaticConfig::default();

        self.say("")?;
        self.say("IP addresses with network prefix, separated by commas.")?;
        self.say("Example: 192.168.1.5/24, 2001:db8::5/64")?;
        let Some(addresses) =
            self.ask_list("Addresses", &current.addresses, true, parse_address)?
        else {
            return Ok(None);
        };
        config.addresses = addresses;

        if config.has_ipv4() {
            let Some(gw) = self.ask_optional_ip("IPv4 gateway", current.gateway4)? else {
                return Ok(None);
            };
            config.gateway4 = gw;
        }

        if config.has_ipv6() {
            let Some(gw) = self.ask_optional_ip("IPv6 gateway", current.gateway6)? else {
                return Ok(None);
            };
            config.gateway6 = gw;
        }

        let Some(nameservers) =
            self.ask_list("DNS servers", &current.nameservers, false, parse_ip)?
        else {
            return Ok(None);
        };
        config.nameservers = nameservers;

        let Some(search) = self.ask_list("DNS search domains", &current.search, false, |s| {
            Ok::<_, String>(s.to_string())
        })?
        else {
            return Ok(None);
        };
        config.search = search;

        Ok(Some(config))
    }

    /// Asks for a list of values, `None` if the user goes back.
    fn ask_list<T: Display>(
        &mut self,
        label: &str,
        current: &[T],
        required: bool,
        parse: impl Fn(&str) -> Result<T, String>,
    ) -> io::Result<Option<Vec<T>>> {
        let default = join(current);
        loop {
            let value = match self.input(label, &default)? {
                Input::Back => return Ok(None),
                Input::Value(value) => value,
            };
            let parsed: Result<Vec<T>, String> =
                split_list(&value).into_iter().map(&parse).collect();
            match parsed {
                Ok(list) if list.is_empty() && required => {
                    self.say("At least one value is required.")?;
                }
                Ok(list) => return Ok(Some(list)),
                Err(e) => self.say(&format!("Error: {e}"))?,
            }
        }
    }

    /// Asks for an optional IP address. The outer `None` means going back.
    fn ask_optional_ip(
        &mut self,
        label: &str,
        current: Option<IpAddr>,
    ) -> io::Result<Option<Option<IpAddr>>> {
        let default = current.map(|ip| ip.to_string()).unwrap_or_default();
        loop {
            let value = match self.input(label, &default)? {
                Input::Back => return Ok(None),
                Input::Value(value) => value,
            };
            if value.trim().is_empty() {
                return Ok(Some(None));
            }
            match parse_ip(&value) {
                Ok(ip) => return Ok(Some(Some(ip))),
                Err(e) => self.say(&format!("Error: {e}"))?,
            }
        }
    }

    fn show_method(&mut self, method: &Method) -> io::Result<()> {
        match method {
            Method::Dhcp => self.say("Method:      automatic (DHCP)"),
            Method::Static(config) => {
                self.say("Method:      static")?;
                self.say(&format!("Addresses:   {}", list_or_none(&config.addresses)))?;
                if config.has_ipv4() {
                    let gw: Vec<_> = config.gateway4.into_iter().collect();
                    self.say(&format!("IPv4 gateway: {}", list_or_none(&gw)))?;
                }
                if config.has_ipv6() {
                    let gw: Vec<_> = config.gateway6.into_iter().collect();
                    self.say(&format!("IPv6 gateway: {}", list_or_none(&gw)))?;
                }
                self.say(&format!(
                    "DNS servers: {}",
                    list_or_none(&config.nameservers)
                ))?;
                self.say(&format!("DNS search:  {}", list_or_none(&config.search)))
            }
        }
    }

    fn test_connection(&mut self) -> io::Result<()> {
        let devices = match self.backend.devices() {
            Ok(devices) => devices,
            Err(e) => return self.error(e),
        };
        let gateway = devices
            .iter()
            .filter(|d| d.connected)
            .find_map(|d| d.gateway4.or(d.gateway6));
        let proxy = self.proxy.read();

        self.title("Network connection test")?;
        self.say("Testing, this can take a while...")?;
        let mut failed = false;
        for check in Check::plan(gateway, &self.test_url, proxy.as_deref()) {
            let outcome = self.backend.run_check(&check);
            failed |= outcome.is_failed();
            let result = match outcome {
                Outcome::Ok(details) if details.is_empty() => "OK".to_string(),
                Outcome::Ok(details) => format!("OK ({details})"),
                Outcome::Failed(details) => format!("FAILED: {details}"),
                Outcome::Skipped(details) => format!("skipped: {details}"),
            };
            self.say(&format!("{}: {result}", check.label()))?;
        }

        self.say("")?;
        if failed {
            self.say("The test failed. Check the network configuration and the proxy.")?;
        } else {
            self.say("The test succeeded.")?;
        }
        self.pause()
    }

    fn configure_proxy(&mut self) -> io::Result<()> {
        self.title("Proxy configuration")?;
        self.say(INPUT_HELP)?;
        self.say("Example: http://proxy.example.com:3128 or http://user:password@proxy:3128")?;
        let current = self.proxy.read().unwrap_or_default();
        loop {
            let value = match self.input("Proxy URL", &current)? {
                Input::Back => return Ok(()),
                Input::Value(value) => value.trim().to_string(),
            };
            if !value.is_empty() && !value.contains("://") {
                self.say("Error: the URL must start with http:// or https://")?;
                continue;
            }
            let proxy = Some(value.as_str()).filter(|v| !v.is_empty());
            if let Err(e) = self.proxy.write(proxy) {
                return self.error(anyhow::anyhow!(
                    "Cannot write {}: {e}",
                    self.proxy.target().display()
                ));
            }
            return match proxy {
                Some(_) => self.say("Proxy saved."),
                None => self.say("Proxy removed."),
            };
        }
    }

    fn show_boot_params(&mut self) -> io::Result<()> {
        let proxy = self.proxy.read();
        let params = match self.backend.boot_params(proxy.as_deref()) {
            Ok(params) => params,
            Err(e) => return self.error(e),
        };

        self.title("Boot options")?;
        if params.is_empty() {
            self.say("There is no active network configuration.")?;
        } else {
            self.say("To set up the network this way without this dialog, add these")?;
            self.say("options to the boot command line or to the parmfile:")?;
            self.say("")?;
            for param in params {
                self.say(&format!("  {param}"))?;
            }
        }
        self.pause()
    }

    // Basic input and output

    fn say(&mut self, line: &str) -> io::Result<()> {
        writeln!(self.output, "{line}")
    }

    fn title(&mut self, title: &str) -> io::Result<()> {
        self.say("")?;
        self.say(&format!("=== {title} ==="))?;
        self.say("")
    }

    fn error(&mut self, error: anyhow::Error) -> io::Result<()> {
        self.say(&format!("Error: {error:#}"))?;
        self.pause()
    }

    fn pause(&mut self) -> io::Result<()> {
        self.say("")?;
        self.prompt("Press Enter to continue")?;
        self.read_line().map(|_| ())
    }

    fn prompt(&mut self, text: &str) -> io::Result<()> {
        write!(self.output, "{text}")?;
        self.output.flush()
    }

    fn read_line(&mut self) -> io::Result<String> {
        let mut line = String::new();
        if self.input.read_line(&mut line)? == 0 {
            return Err(io::ErrorKind::UnexpectedEof.into());
        }
        Ok(line.trim().to_string())
    }

    /// Shows a numbered menu and returns the index of the selected item, `None` for 0.
    fn menu<T: AsRef<str>>(&mut self, items: &[T], zero: &str) -> io::Result<Option<usize>> {
        for (i, item) in items.iter().enumerate() {
            self.say(&format!("{}) {}", i + 1, item.as_ref()))?;
        }
        self.say(&format!("0) {zero}"))?;
        loop {
            self.say("")?;
            self.prompt("> ")?;
            let line = self.read_line()?;
            match line.parse::<usize>() {
                Ok(0) => return Ok(None),
                Ok(n) if n <= items.len() => return Ok(Some(n - 1)),
                _ => self.say(&format!("Enter a number between 0 and {}.", items.len()))?,
            }
        }
    }

    /// Asks for a value.
    fn input(&mut self, label: &str, default: &str) -> io::Result<Input> {
        if default.is_empty() {
            self.prompt(&format!("{label}: "))?;
        } else {
            self.prompt(&format!("{label} [{default}]: "))?;
        }
        let line = self.read_line()?;
        Ok(match line.as_str() {
            "" => Input::Value(default.to_string()),
            "-" => Input::Value(String::new()),
            "<" => Input::Back,
            _ => Input::Value(line),
        })
    }
}

fn device_label(device: &DeviceInfo) -> String {
    let mut label = format!("{} ({}, {}", device.name, device.kind, device.state);
    if device.carrier == Some(false) {
        label.push_str(", no link");
    }
    if let Some(addr) = device.addresses.first() {
        label.push_str(&format!(", {addr}"));
    }
    label.push(')');
    label
}

fn join<T: Display>(values: &[T]) -> String {
    values
        .iter()
        .map(ToString::to_string)
        .collect::<Vec<_>>()
        .join(", ")
}

fn list_or_none<T: Display>(values: &[T]) -> String {
    if values.is_empty() {
        "none".to_string()
    } else {
        join(values)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{cell::RefCell, rc::Rc};

    #[derive(Default)]
    struct Calls {
        configured: Vec<(String, Method)>,
        checks: Vec<Check>,
    }

    struct FakeBackend {
        devices: Vec<DeviceInfo>,
        calls: Rc<RefCell<Calls>>,
    }

    impl Backend for FakeBackend {
        fn devices(&mut self) -> anyhow::Result<Vec<DeviceInfo>> {
            Ok(self.devices.clone())
        }

        fn configure(&mut self, interface: &str, method: &Method) -> anyhow::Result<DeviceInfo> {
            self.calls
                .borrow_mut()
                .configured
                .push((interface.to_string(), method.clone()));
            let mut device = self
                .devices
                .iter()
                .find(|d| d.name == interface)
                .unwrap()
                .clone();
            device.connected = true;
            device.state = "connected".to_string();
            Ok(device)
        }

        fn boot_params(&mut self, proxy: Option<&str>) -> anyhow::Result<Vec<String>> {
            Ok(vec!["ip=eth0:dhcp".to_string()]
                .into_iter()
                .chain(proxy.map(|p| format!("proxy={p}")))
                .collect())
        }

        fn run_check(&mut self, check: &Check) -> Outcome {
            self.calls.borrow_mut().checks.push(check.clone());
            Outcome::Ok(String::new())
        }
    }

    struct Fixture {
        _dir: tempfile::TempDir,
        proxy: ProxyStore,
        calls: Rc<RefCell<Calls>>,
    }

    impl Fixture {
        fn new() -> Self {
            let dir = tempfile::tempdir().unwrap();
            let target = dir.path().join("proxy.conf");
            Self {
                proxy: ProxyStore::new(vec![target.clone()], target),
                _dir: dir,
                calls: Default::default(),
            }
        }

        fn run(&self, input: &str) -> String {
            let backend = FakeBackend {
                devices: vec![
                    DeviceInfo {
                        name: "eth0".to_string(),
                        kind: "ethernet".to_string(),
                        state: "disconnected".to_string(),
                        carrier: Some(true),
                        addresses: vec![parse_address("10.0.0.9/24").unwrap()],
                        ..Default::default()
                    },
                    DeviceInfo {
                        name: "eth1".to_string(),
                        kind: "ethernet".to_string(),
                        state: "unavailable".to_string(),
                        carrier: Some(false),
                        ..Default::default()
                    },
                ],
                calls: self.calls.clone(),
            };
            let mut output = vec![];
            let mut ui = LineUi::new(
                input.as_bytes(),
                &mut output,
                backend,
                &self.proxy,
                "http://www.example.com",
            );
            ui.run().unwrap();
            String::from_utf8(output).unwrap()
        }
    }

    #[test]
    fn test_status_and_continue() {
        let fixture = Fixture::new();
        let output = fixture.run("0\n");
        assert!(output.contains("eth0            ethernet  disconnected  yes  10.0.0.9/24"));
        assert!(output.contains("eth1            ethernet  unavailable   no   -"));
        assert!(output.contains("Proxy:       none"));
        assert!(fixture.calls.borrow().configured.is_empty());
    }

    #[test]
    fn test_end_of_input_continues() {
        let fixture = Fixture::new();
        fixture.run("1\n");
    }

    #[test]
    fn test_configure_dhcp() {
        let fixture = Fixture::new();
        // configure, eth1, DHCP, apply, back, continue
        let output = fixture.run("1\n2\n1\n1\n0\n0\n");
        assert_eq!(
            fixture.calls.borrow().configured,
            vec![("eth1".to_string(), Method::Dhcp)]
        );
        assert!(output.contains("eth1 is connected."));
    }

    #[test]
    fn test_configure_static_with_retries() {
        let fixture = Fixture::new();
        let input = [
            "1",        // configure
            "1",        // eth0
            "2",        // static
            "10.0.0.5", // missing prefix, asked again
            "10.0.0.5/24, 2001:db8::5/64",
            "10.0.0.1",          // IPv4 gateway
            "",                  // IPv6 gateway, no default
            "10.0.0.2 10.0.0.3", // DNS
            "example.com",       // search
            "7",                 // invalid choice, asked again
            "1",                 // apply
            "1",                 // test
            "",                  // pause
            "0",                 // continue
        ]
        .join("\n");
        let output = fixture.run(&input);
        assert!(output.contains("Error: '10.0.0.5' has no network prefix"));
        assert!(output.contains("Enter a number between 0 and 1."));

        let calls = fixture.calls.borrow();
        let (name, method) = &calls.configured[0];
        assert_eq!(name, "eth0");
        let Method::Static(config) = method else {
            panic!("static configuration expected");
        };
        assert_eq!(config.addresses.len(), 2);
        assert_eq!(config.gateway4, Some(parse_ip("10.0.0.1").unwrap()));
        assert_eq!(config.gateway6, None);
        assert_eq!(config.nameservers.len(), 2);
        assert_eq!(config.search, vec!["example.com".to_string()]);
        assert_eq!(calls.checks.len(), 3);
    }

    #[test]
    fn test_static_defaults_and_back() {
        let fixture = Fixture::new();
        // keep the current address, then go back at the gateway
        let output = fixture.run("1\n1\n2\n\n<\n0\n");
        assert!(output.contains("Addresses [10.0.0.9/24]: "));
        assert!(fixture.calls.borrow().configured.is_empty());
    }

    #[test]
    fn test_proxy_and_boot_params() {
        let fixture = Fixture::new();
        // invalid proxy, valid proxy, show boot options, pause, continue
        let output = fixture.run("3\nproxy:3128\nhttp://u:pw@proxy:3128\n4\n\n0\n");
        assert!(output.contains("Error: the URL must start with"));
        assert!(output.contains("Proxy:       http://*****@proxy:3128"));
        assert!(output.contains("  proxy=http://u:pw@proxy:3128"));
        assert_eq!(
            fixture.proxy.read().as_deref(),
            Some("http://u:pw@proxy:3128")
        );

        // remove it again
        fixture.run("3\n-\n0\n");
        assert_eq!(fixture.proxy.read(), None);
    }
}
