//! This module implements an API to deal with authentication tokens.
//!
//! Agama web server relies on JSON Web Tokens (JWT) for authentication purposes.
//! This module implements a simple API to perform the common operations.
//!
//! ## The master token
//!
//! When Agama web server starts, it writes a master token (which is just a regular
//! JWT) in `/run/agama/token`. That file is only readable by the root user and
//! can be used by any Agama component.
//!
//! ## The user token
//!
//! When a user does not have access to the master token it needs to authenticate
//! with the server. In that process, it obtains a new token that should be stored
//! in user's home directory (`$HOME/.local/agama/token`).
//!
//! ## A simplistic API
//!
//! The current API is rather limited and it does not support, for instance,
//! keeping tokens for different servers. We might extend this API if needed
//! in the future.

const USER_TOKEN_PATH: &str = ".local/agama/token";
const AGAMA_TOKEN_FILE: &str = "/run/agama/token";

use std::{
    fmt::Display,
    fs::{self, File},
    io::{self, BufRead, BufReader, Write},
    os::unix::fs::OpenOptionsExt,
    path::{Path, PathBuf},
};

use chrono::{Duration, Utc};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
#[error("Invalid authentication token: {0}")]
pub struct AuthTokenError(#[from] jsonwebtoken::errors::Error);

/// Represents an authentication token (JWT).
pub struct AuthToken(String);

impl AuthToken {
    /// Creates a new token with the given content.
    ///
    /// * `content`: token raw content.
    pub fn new(content: &str) -> Self {
        Self(content.to_string())
    }

    /// Generates a new token using the given secret.
    ///
    /// * `secret`: secret to encode the token.
    pub fn generate(secret: &str) -> Result<Self, AuthTokenError> {
        let claims = TokenClaims::default();
        let token = jsonwebtoken::encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(secret.as_ref()),
        )?;
        Ok(AuthToken(token))
    }

    /// Finds an usable token for the current user.
    ///
    /// It searches for a token in user's home directory and, if it does not exists,
    /// it tries to read the master token.
    pub fn find() -> Option<Self> {
        if let Ok(path) = Self::user_token_path() {
            if let Ok(token) = Self::read(path) {
                return Some(token);
            }
        }

        Self::read(AGAMA_TOKEN_FILE).ok()
    }

    /// Reads the token from the given path.
    ///
    /// * `path`: file's path to read the token from.
    pub fn read<P: AsRef<Path>>(path: P) -> io::Result<Self> {
        let file = File::open(path)?;
        let mut reader = BufReader::new(file);
        let mut buf = String::new();
        reader.read_line(&mut buf)?;
        Ok(AuthToken(buf))
    }

    /// Writes the token to the given path.
    ///
    /// It takes care of setting the right permissions (0400).
    ///
    /// * `path`: file's path to write the token to.
    pub fn write<P: AsRef<Path>>(&self, path: P) -> io::Result<()> {
        if let Some(parent) = path.as_ref().parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut file = fs::OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .mode(0o400)
            .open(path)?;
        file.write_all(self.0.as_bytes())?;
        Ok(())
    }

    /// Removes the user token.
    pub fn remove_user_token() -> io::Result<()> {
        let path = Self::user_token_path()?;
        if path.exists() {
            fs::remove_file(path)?;
        }
        Ok(())
    }

    /// Returns the claims from the token.
    ///
    /// * `secret`: secret to decode the token.
    pub fn claims(&self, secret: &str) -> Result<TokenClaims, AuthTokenError> {
        let decoding = DecodingKey::from_secret(secret.as_ref());
        let token_data = jsonwebtoken::decode(&self.0, &decoding, &Validation::default())?;
        Ok(token_data.claims)
    }

    /// Returns a reference to the token's content.
    pub fn as_str(&self) -> &str {
        self.0.as_str()
    }

    /// Writes the token to the user's home directory.
    pub fn write_user_token(&self) -> io::Result<()> {
        let path = Self::user_token_path()?;
        self.write(path)
    }

    /// Writes the token to Agama's run directory.
    ///
    /// For this function to succeed the run directory should exist and the user needs write
    /// permissions.
    pub fn write_master_token(&self) -> io::Result<()> {
        self.write(AGAMA_TOKEN_FILE)
    }

    fn user_token_path() -> io::Result<PathBuf> {
        let Some(path) = home::home_dir() else {
            return Err(io::Error::new(
                io::ErrorKind::Other,
                "Cannot find the user's home directory",
            ));
        };

        Ok(path.join(USER_TOKEN_PATH))
    }
}

impl Display for AuthToken {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Claims that are included in the token.
///
/// See https://datatracker.ietf.org/doc/html/rfc7519 for reference.
#[derive(Debug, Serialize, Deserialize)]
pub struct TokenClaims {
    pub exp: i64,
}

impl Default for TokenClaims {
    fn default() -> Self {
        let mut exp = Utc::now();

        if let Some(days) = Duration::try_days(1) {
            exp += days;
        }

        Self {
            exp: exp.timestamp(),
        }
    }
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::AuthToken;

    #[test]
    fn test_generate_token() {
        let token = AuthToken::generate("nots3cr3t").unwrap();
        let decoded = token.claims("nots3cr3t");
        assert!(decoded.is_ok());

        let wrong = token.claims("wrong");
        assert!(wrong.is_err())
    }

    #[test]
    fn test_write_and_read_token() {
        // let token = AuthToken::from_path<P: AsRef<Path>>(path: P)
        // let token = AuthToken::from_path()
        let token = AuthToken::generate("nots3cr3t").unwrap();

        let tmp_dir = tempdir().unwrap();
        let path = tmp_dir.path().join("token");
        token.write(&path).unwrap();

        let read_token = AuthToken::read(&path).unwrap();
        let decoded = read_token.claims("nots3cr3t");
        assert!(decoded.is_ok());
    }
}
