// Copyright (c) [2025] SUSE LLC
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
    fs,
    io::{self, Write},
    os::unix::fs::OpenOptionsExt,
    path::{Path, PathBuf},
};

use agama_lib::auth::AuthToken;
use serde::{Deserialize, Serialize};

const HOST_CONFIG_FILE: &str = ".local/share/agama/hosts.json";

/// Hosts configuration file.
///
/// It contains the configuration from each host. At this point, only the authentication tokens are
/// stored in this file. It is not supposed to be modified by hand.
#[derive(Debug, Default)]
pub struct HostsConfigFile {
    hosts: Vec<HostConfig>,
}

impl HostsConfigFile {
    /// Default path for the hosts configuration file in user's home directory.
    pub fn default_path() -> io::Result<PathBuf> {
        let Some(path) = home::home_dir() else {
            return Err(io::Error::new(
                io::ErrorKind::Other,
                "Cannot find the user's home directory",
            ));
        };

        Ok(path.join(HOST_CONFIG_FILE))
    }

    /// Reads the hosts configuration file from the default path.
    ///
    /// * `path`: path to read the file from.
    pub fn read() -> io::Result<Self> {
        Self::read_from_path(Self::default_path()?)
    }

    /// Reads the hosts configuration file from the given path.
    pub fn read_from_path<P: AsRef<Path>>(path: P) -> io::Result<Self> {
        let content = fs::read_to_string(&path)?;
        let hosts: Vec<HostConfig> = serde_json::from_str(&content).unwrap();
        Ok(Self { hosts })
    }

    /// Writes the hosts configuration file from the default path.
    pub fn write(&self) -> io::Result<()> {
        self.write_to_path(Self::default_path()?)
    }

    /// Writes the hosts configuration file to the given path.
    ///
    /// * `path`: path to write the file to.
    pub fn write_to_path<P: AsRef<Path>>(&self, path: P) -> io::Result<()> {
        if let Some(parent) = path.as_ref().parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut file = fs::OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .mode(0o600)
            .open(path)?;
        let content = serde_json::to_string_pretty(&self.hosts).unwrap();
        file.write_all(content.as_bytes())?;
        Ok(())
    }

    /// Returns the authentication token for the given host.
    ///
    /// * `host`: host name.
    pub fn get_token(&self, host: &str) -> Option<AuthToken> {
        self.get_host(host).map(|h| AuthToken(h.token.to_string()))
    }

    /// Returns the authentication token for the given host.
    ///
    /// * `host`: host name.
    /// * `token': authentication token.`
    pub fn update_token(&mut self, host: &str, token: &AuthToken) {
        match self.get_host_mut(host) {
            Some(api_config) => {
                api_config.token = token.to_string();
            }
            None => {
                let api_config = HostConfig {
                    host: host.to_string(),
                    token: token.to_string(),
                };
                self.hosts.push(api_config)
            }
        }
    }

    /// Removes the configuration for the given host.
    ///
    /// * `host`: host name.
    pub fn remove_host(&mut self, host: &str) {
        self.hosts.retain(|h| h.host != host)
    }

    fn get_host(&self, host: &str) -> Option<&HostConfig> {
        self.hosts.iter().find(|h| h.host == host)
    }

    fn get_host_mut(&mut self, host: &str) -> Option<&mut HostConfig> {
        self.hosts.iter_mut().find(|h| h.host == host)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HostConfig {
    host: String,
    token: String,
}

#[cfg(test)]
mod tests {
    use agama_lib::auth::AuthToken;

    use super::{HostConfig, HostsConfigFile};
    use std::{fs, path::Path};

    #[test]
    fn test_read_api_config() {
        let path = Path::new("tests/hosts.json");
        let file = HostsConfigFile::read_from_path(path).unwrap();
        let host = file.get_host("my-server.lan").unwrap();
        assert_eq!(host.token, "abcdefghi");
    }

    #[test]
    fn test_handle_token() {
        let path = Path::new("tests/hosts.json");
        let mut file = HostsConfigFile::read_from_path(path).unwrap();
        file.update_token("my-server.lan", &AuthToken("123456".to_string()));
        assert_eq!(
            file.get_token("my-server.lan"),
            Some(AuthToken("123456".to_string()))
        );
    }

    #[test]
    fn test_write_api_config() {
        let path = Path::new("tests/hosts.json");
        let tmpdir = tempfile::TempDir::with_prefix("agama-tests-").unwrap();
        let file = HostsConfigFile::read_from_path(path).unwrap();

        let path2 = tmpdir.path().join("hosts.json");
        file.write_to_path(&path2).unwrap();

        let content = fs::read_to_string(path2).unwrap();
        let config: Result<Vec<HostConfig>, _> = serde_json::from_str(&content);
        assert!(config.is_ok());
    }

    #[test]
    fn test_remove_host() {
        let path = Path::new("tests/hosts.json");
        let mut file = HostsConfigFile::read_from_path(&path).unwrap();
        assert!(file.get_token("my-server.lan").is_some());

        file.remove_host("my-server.lan");
        assert!(file.get_token("my-server.lan").is_none());
    }
}
