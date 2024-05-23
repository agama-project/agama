//! Handles Agama web server configuration.
//!
//! The configuration can be written in YAML or JSON formats, although we plan to choose just one
//! of them in the future. It is read from the following locations:
//!
//! * `/usr/etc/agama.d/server.{json/yaml}`
//! * `/etc/agama.d/server.{json/yaml}`
//! * `./agama-dbus-server/share/server.{json/yaml}`
//!
//! All the settings are merged into a single configuration. The values in the latter locations
//! take precedence.

use config::{Config, ConfigError, File};
use rand::distributions::{Alphanumeric, DistString};
use serde::Deserialize;

/// Web service configuration.
#[derive(Clone, Debug, Deserialize)]
pub struct ServiceConfig {
    /// Key to sign the JSON Web Tokens.
    pub jwt_secret: String,
}

impl ServiceConfig {
    pub fn load() -> Result<Self, ConfigError> {
        const JWT_SECRET_SIZE: usize = 30;
        let jwt_secret: String =
            Alphanumeric.sample_string(&mut rand::thread_rng(), JWT_SECRET_SIZE);

        let config = Config::builder()
            .set_default("jwt_secret", jwt_secret)?
            .add_source(File::with_name("/usr/etc/agama.d/server").required(false))
            .add_source(File::with_name("/etc/agama.d/server").required(false))
            .add_source(File::with_name("etc/agama.d/server").required(false))
            .build()?;
        config.try_deserialize()
    }
}

impl Default for ServiceConfig {
    fn default() -> Self {
        Self {
            jwt_secret: "".to_string(),
        }
    }
}
