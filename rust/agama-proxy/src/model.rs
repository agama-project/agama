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

use std::{
    os::unix::fs::OpenOptionsExt,
    path::{Path, PathBuf},
};

use agama_utils::kernel_cmdline::KernelCmdline;
use strum::{Display, EnumIter, EnumString, IntoEnumIterator};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("The URL looks wrong")]
    WrongUrl,
    #[error("Failed to write configuration: {0}")]
    Io(#[from] std::io::Error),
}

#[derive(Clone, Debug, Default, Display, PartialEq, EnumIter, EnumString)]
#[strum(serialize_all = "camelCase")]
pub enum Protocol {
    FTP,
    #[default]
    HTTP,
    HTTPS,
    GOPHER,
    SOCKS,
    SOCKS5,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct ProxyConfig {
    pub proxies: Vec<Proxy>,
    pub enabled: Option<bool>,
    pub no_proxy: Option<String>,
}

const WORK_DIR: &str = "/";
const PROXY_PATH: &str = "etc/sysconfig/proxy";

impl ProxyConfig {
    pub fn from_cmdline() -> Option<Self> {
        let paths = ["/run/agama/cmdline.d/kernel.conf", "/etc/cmdline-menu.conf"];

        for path in paths {
            if !Path::new(path).exists() {
                continue;
            }

            if let Ok(cmdline) = KernelCmdline::parse_file(path) {
                if let Some(config) = Self::from_kernel_cmdline(&cmdline) {
                    return Some(config);
                }
            }
        }
        None
    }

    pub fn from_kernel_cmdline(cmdline: &KernelCmdline) -> Option<Self> {
        if let Some(url) = cmdline.get_last("proxy") {
            let mut proxies = vec![];
            for protocol in Protocol::iter() {
                if [Protocol::GOPHER, Protocol::SOCKS, Protocol::SOCKS5].contains(&protocol) {
                    continue;
                }
                proxies.push(Proxy::new(url.clone(), protocol));
            }
            return Some(ProxyConfig {
                enabled: Some(true),
                proxies,
                ..Default::default()
            });
        }
        None
    }

    pub fn config_path() -> PathBuf {
        PathBuf::from(WORK_DIR).join(PROXY_PATH)
    }

    pub fn read() -> Result<Option<Self>, Error> {
        let path = Self::config_path();
        match Self::read_from(&path) {
            Ok(config) => Ok(Some(config)),
            Err(Error::Io(e)) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn read_from(path: &PathBuf) -> Result<Self, Error> {
        use std::io::BufRead;

        let file = std::fs::OpenOptions::new().read(true).open(path)?;
        let reader = std::io::BufReader::new(file);

        let mut proxies = Vec::new();
        let mut enabled = None;
        let mut no_proxy = None;

        for line in reader.lines() {
            let line = line?;
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            if let Some((key, value)) = line.split_once('=') {
                let key = key.trim();
                let value = value.trim().trim_matches('"');

                match key {
                    "PROXY_ENABLED" => {
                        enabled = Some(value == "yes");
                    }
                    "SOCKS5_SERVER" => {
                        if !value.is_empty() {
                            proxies.push(Proxy::new(value.to_string(), Protocol::SOCKS5));
                        }
                    }
                    "NO_PROXY" => {
                        no_proxy = Some(value.to_string());
                    }
                    k if k.ends_with("_PROXY") => {
                        let protocol_str = k.trim_end_matches("_PROXY");
                        if let Ok(protocol) = protocol_str.to_lowercase().parse::<Protocol>() {
                            if !value.is_empty() {
                                proxies.push(Proxy::new(value.to_string(), protocol));
                            }
                        }
                    }
                    _ => {}
                }
            }
        }

        Ok(ProxyConfig {
            proxies,
            enabled,
            no_proxy,
        })
    }

    pub fn write(&self) -> Result<(), Error> {
        self.write_to(&Self::config_path())
    }

    pub fn write_to(&self, path: &PathBuf) -> Result<(), Error> {
        use std::collections::{HashMap, HashSet};
        use std::io::{BufRead, Write};

        let mut settings = HashMap::new();

        if let Some(enabled) = self.enabled {
            let enabled = if enabled { "yes" } else { "no" };
            settings.insert("PROXY_ENABLED".to_string(), enabled.to_string());
        }

        for proxy in &self.proxies {
            let key = if proxy.protocol == Protocol::SOCKS5 {
                "SOCKS5_SERVER".to_string()
            } else {
                format!("{}_PROXY", proxy.protocol.to_string().to_uppercase())
            };
            settings.insert(key, proxy.url.to_string());
        }

        if let Some(no_proxy) = &self.no_proxy {
            settings.insert("NO_PROXY".to_string(), no_proxy.to_string());
        }

        let mut lines = Vec::new();

        match std::fs::OpenOptions::new().read(true).open(path) {
            Ok(file) => {
                let reader = std::io::BufReader::new(file);
                for line in reader.lines() {
                    lines.push(line?);
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.into()),
        }

        let mut new_lines = Vec::new();
        let mut processed_keys = HashSet::new();

        for line in lines {
            let mut replaced = false;
            let trimmed = line.trim_start();
            for (key, val) in &settings {
                if trimmed.starts_with(&format!("{}=", key)) {
                    new_lines.push(format!("{}=\"{}\"", key, val));
                    processed_keys.insert(key.to_string());
                    replaced = true;
                    break;
                }
            }
            if !replaced {
                new_lines.push(line);
            }
        }

        // All the key settings should be processed but ensure the lines are written in
        // case they are not.
        for (key, val) in &settings {
            if !processed_keys.contains(key) {
                new_lines.push(format!("{}=\"{}\"", key, val));
            }
        }
        let mut file = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o644)
            .open(path)?;
        for line in new_lines {
            writeln!(file, "{}", line)?;
        }

        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Proxy {
    pub protocol: Protocol,
    pub url: String,
}

impl Proxy {
    pub fn new(url: String, protocol: Protocol) -> Self {
        Self { url, protocol }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agama_utils::kernel_cmdline::KernelCmdline;

    #[test]
    fn test_from_cmdline() {
        let content =
            "BOOT_IMAGE=/boot/vmlinuz root=/dev/sda1 proxy=http://proxy.example.com:8080 quiet";
        let cmdline = KernelCmdline::parse_str(content);
        let config = ProxyConfig::from_kernel_cmdline(&cmdline).unwrap();

        assert_eq!(config.proxies.len(), 3);
        assert!(config.proxies.contains(&Proxy::new(
            "http://proxy.example.com:8080".to_string(),
            Protocol::HTTP
        )));
        assert!(config.proxies.contains(&Proxy::new(
            "http://proxy.example.com:8080".to_string(),
            Protocol::HTTPS
        )));
        assert!(config.proxies.contains(&Proxy::new(
            "http://proxy.example.com:8080".to_string(),
            Protocol::FTP
        )));

        let content = "no_proxy_here";
        let cmdline = KernelCmdline::parse_str(content);
        assert_eq!(ProxyConfig::from_kernel_cmdline(&cmdline), None);
    }

    #[test]
    fn test_write() {
        let config = ProxyConfig {
            proxies: vec![
                Proxy::new("http://proxy.example.com".to_string(), Protocol::HTTP),
                Proxy::new("ftp://proxy.example.com".to_string(), Protocol::FTP),
                Proxy::new("socks.example.com".to_string(), Protocol::SOCKS5),
            ],
            enabled: Some(true),
            no_proxy: Some("".to_string()),
        };

        let tempdir = tempfile::tempdir().unwrap();
        let path = tempdir.path().join("proxy");
        config.write_to(&path).unwrap();

        let content = std::fs::read_to_string(&path).unwrap();

        assert!(content.contains("PROXY_ENABLED=\"yes\""));
        assert!(content.contains("HTTP_PROXY=\"http://proxy.example.com\""));
        assert!(content.contains("FTP_PROXY=\"ftp://proxy.example.com\""));
        assert!(content.contains("SOCKS5_SERVER=\"socks.example.com\""));
        assert!(content.contains("NO_PROXY=\"\""));
    }

    #[test]
    fn test_write_preserve_content() {
        let tempdir = tempfile::tempdir().unwrap();
        let path = tempdir.path().join("proxy");

        // Create initial file with some extra content
        {
            use std::io::Write;
            let mut file = std::fs::File::create(&path).unwrap();
            writeln!(file, "SOME_OTHER_VAR=\"value\"").unwrap();
            writeln!(file, "HTTP_PROXY=\"old_value\"").unwrap();
            writeln!(file, "# A comment").unwrap();
        }

        let config = ProxyConfig {
            proxies: vec![Proxy::new(
                "http://new.proxy.com".to_string(),
                Protocol::HTTP,
            )],
            enabled: Some(true),
            no_proxy: None,
        };

        config.write_to(&path).unwrap();

        let content = std::fs::read_to_string(&path).unwrap();

        assert!(content.contains("SOME_OTHER_VAR=\"value\""));
        assert!(content.contains("HTTP_PROXY=\"http://new.proxy.com\""));
        assert!(!content.contains("HTTP_PROXY=\"old_value\""));
        assert!(content.contains("# A comment"));
        assert!(content.contains("PROXY_ENABLED=\"yes\""));
    }

    #[test]
    fn test_read() {
        let tempdir = tempfile::tempdir().unwrap();
        let path = tempdir.path().join(PROXY_PATH);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        {
            use std::io::Write;
            let mut file = std::fs::File::create(&path).unwrap();
            writeln!(file, "PROXY_ENABLED=\"yes\"").unwrap();
            writeln!(file, "HTTP_PROXY=\"http://proxy.example.com\"").unwrap();
            writeln!(file, "FTP_PROXY=\"ftp://proxy.example.com\"").unwrap();
            writeln!(file, "SOCKS5_SERVER=\"socks.example.com\"").unwrap();
            writeln!(file, "NO_PROXY=\"localhost,127.0.0.1\"").unwrap();
            writeln!(file, "# Some comment").unwrap();
            writeln!(file, "OTHER_VAR=\"ignore\"").unwrap();
        }

        let config = ProxyConfig::read_from(&path).unwrap();

        assert_eq!(config.enabled, Some(true));
        assert!(config.proxies.contains(&Proxy::new(
            "http://proxy.example.com".to_string(),
            Protocol::HTTP
        )));
        assert!(config.proxies.contains(&Proxy::new(
            "ftp://proxy.example.com".to_string(),
            Protocol::FTP
        )));
        assert!(config.proxies.contains(&Proxy::new(
            "socks.example.com".to_string(),
            Protocol::SOCKS5
        )));
        assert_eq!(config.no_proxy, Some("localhost,127.0.0.1".to_string()));
    }
}
