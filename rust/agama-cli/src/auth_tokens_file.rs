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
    collections::HashMap,
    fs,
    io::{self, Write},
    os::unix::fs::OpenOptionsExt,
    path::{Path, PathBuf},
};

use agama_lib::auth::AuthToken;

const AUTH_TOKENS_FILE: &str = ".local/share/agama/tokens.json";

/// Authentication tokens file.
///
/// It contains the authentication tokens for each host. This file is not supposed
/// to be modified by hand, but using the `agama auth` commands.
#[derive(Debug, Default)]
pub struct AuthTokensFile {
    tokens: HashMap<String, String>,
}

impl AuthTokensFile {
    /// Default path for the tokens file in user's home directory.
    pub fn default_path() -> io::Result<PathBuf> {
        let Some(path) = home::home_dir() else {
            return Err(io::Error::new(
                io::ErrorKind::Other,
                "Cannot find the user's home directory",
            ));
        };

        Ok(path.join(AUTH_TOKENS_FILE))
    }

    /// Reads the tokens file from the default path.
    ///
    /// * `path`: path to read the file from.
    pub fn read() -> io::Result<Self> {
        Self::read_from_path(Self::default_path()?)
    }

    /// Reads the tokens file from the given path.
    pub fn read_from_path<P: AsRef<Path>>(path: P) -> io::Result<Self> {
        let content = fs::read_to_string(&path)?;
        let tokens: HashMap<String, String> = serde_json::from_str(&content).unwrap();
        Ok(Self { tokens })
    }

    /// Writes the tokens file from the default path.
    pub fn write(&self) -> io::Result<()> {
        self.write_to_path(Self::default_path()?)
    }

    /// Writes the tokens file to the given path.
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
        let content = serde_json::to_string_pretty(&self.tokens).unwrap();
        file.write_all(content.as_bytes())?;
        Ok(())
    }

    /// Returns the authentication token for the given host.
    ///
    /// * `host`: host name.
    pub fn get_token(&self, host: &str) -> Option<AuthToken> {
        self.tokens.get(host).map(|t| AuthToken(t.to_string()))
    }

    /// Returns the authentication token for the given host.
    ///
    /// * `host`: host name.
    /// * `token': authentication token.`
    pub fn update_token(&mut self, host: &str, token: &AuthToken) {
        self.tokens.insert(host.to_string(), token.to_string());
    }

    /// Removes the configuration for the given host.
    ///
    /// * `host`: host name.
    pub fn remove_host(&mut self, host: &str) {
        self.tokens.remove(host);
    }
}

#[cfg(test)]
mod tests {
    use agama_lib::auth::AuthToken;

    use super::AuthTokensFile;
    use std::path::Path;

    #[test]
    fn test_get_token() {
        let path = Path::new("tests/tokens.json");
        let file = AuthTokensFile::read_from_path(path).unwrap();
        let token = file.get_token("my-server.lan").unwrap();
        assert_eq!(token, AuthToken("abcdefghij".to_string()));
    }

    #[test]
    fn test_update_token() {
        let path = Path::new("tests/tokens.json");
        let mut file = AuthTokensFile::read_from_path(path).unwrap();
        file.update_token("my-server.lan", &AuthToken("123456".to_string()));
        assert_eq!(
            file.get_token("my-server.lan"),
            Some(AuthToken("123456".to_string()))
        );
    }

    #[test]
    fn test_remove_host() {
        let path = Path::new("tests/tokens.json");
        let mut file = AuthTokensFile::read_from_path(&path).unwrap();
        assert!(file.get_token("my-server.lan").is_some());

        file.remove_host("my-server.lan");
        assert!(file.get_token("my-server.lan").is_none());
    }

    #[test]
    fn test_write_file() {
        let path = Path::new("tests/tokens.json");
        let tmpdir = tempfile::TempDir::with_prefix("agama-tests-").unwrap();
        let file = AuthTokensFile::read_from_path(path).unwrap();

        let path2 = tmpdir.path().join("tokens.json");
        file.write_to_path(&path2).unwrap();

        assert!(AuthTokensFile::read_from_path(path2).is_ok());
    }
}
