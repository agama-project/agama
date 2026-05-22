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
//! Implements a data model for Security configuration.

use std::fmt;

use merge::Merge;
use schemars::JsonSchema;
use serde::{Deserialize, Deserializer, Serialize};

/// Config handled by agama-security
#[derive(Clone, Debug, Default, Serialize, Deserialize, Merge, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    /// Security specific configuration
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub security: Option<SecurityConfig>,
    /// Remote access configuration
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    remote_access: Option<RemoteAccessConfig>,
}

/// Allows to specify explicit enablement of remote access for supported services
#[derive(Default, Clone, Copy, Debug, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum AccessEnum {
    /// Explicitly enabled
    Enabled,
    /// Default system configuration behavior that is product specific
    #[default]
    Default,
}

/// Remote Access configuration
#[derive(Clone, Debug, Default, Serialize, Deserialize, Merge, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(rename = "remoteAccess.Config")]
pub struct RemoteAccessConfig {
    /// Remote access to SSH
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub ssh: Option<AccessEnum>,
    /// Remote access to Cockpit
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub cockpit: Option<AccessEnum>,
}

/// Security settings for installation
#[derive(Clone, Debug, Default, Serialize, Deserialize, Merge, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(rename = "security.Config")]
pub struct SecurityConfig {
    /// List of trusted SSL certificates.

    // when we add support for remote URL here it should be vector of SSL
    // certificates which will include flatten fingerprint
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub ssl_certificates: Option<Vec<SSLFingerprint>>,
}

/// Algorithm used for SSL certificate fingerprint
#[derive(Default, Clone, Copy, Debug, Serialize, Deserialize, PartialEq, JsonSchema)]
pub enum SSLFingerprintAlgorithm {
    /// SHA1 algorithm
    #[serde(alias = "sha1", alias = "SHA1")]
    SHA1,
    /// SHA256 algorithm
    #[serde(alias = "sha256", alias = "SHA256")]
    #[default]
    SHA256,
}

/// Representation of an SSL certificate fingerprint
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, JsonSchema)]
pub struct SSLFingerprint {
    /// The string value for SSL certificate fingerprint.
    /// Example value is "F6:7A:ED:BB:BC:94:CF:55:9D:B3:BA:74:7A:87:05:EF:67:4E:C2:DB"
    #[serde(deserialize_with = "serialize_fingerprint")]
    fingerprint: String,
    /// Algorithm used to compute SSL certificate fingerprint.
    /// Supported options are "SHA1" and "SHA256"
    #[serde(default)]
    pub algorithm: SSLFingerprintAlgorithm,
}

impl SSLFingerprint {
    /// Creates a new `SSLFingerprint` with the provided string and algorithm.
    pub fn new(fingerprint: &str, algorithm: SSLFingerprintAlgorithm) -> Self {
        Self {
            fingerprint: normalize_fingerprint(fingerprint),
            algorithm,
        }
    }

    /// Helper function to create a SHA1 fingerprint.
    pub fn sha1(fingerprint: &str) -> Self {
        Self::new(fingerprint, SSLFingerprintAlgorithm::SHA1)
    }

    /// Helper function to create a SHA256 fingerprint.
    pub fn sha256(fingerprint: &str) -> Self {
        Self::new(fingerprint, SSLFingerprintAlgorithm::SHA256)
    }
}

impl fmt::Display for SSLFingerprint {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.fingerprint)
    }
}

fn serialize_fingerprint<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: Deserializer<'de>,
{
    let s: String = Deserialize::deserialize(deserializer)?;
    Ok(normalize_fingerprint(s.as_str()))
}

/// Remove spaces and convert to uppercase
fn normalize_fingerprint(fingerprint: &str) -> String {
    fingerprint.replace(' ', "").to_uppercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deserialize_fingerprint() {
        let json = r#"
          { "fingerprint": "f6:7a:ED:BB:BC:94:CF:55:9D:B3:BA:74:7A:87:05:EF:67:4E:C2:DB", "algorithm": "sha256" }
        "#;

        let fingerprint: SSLFingerprint = serde_json::from_str(json).unwrap();
        assert_eq!(
            &fingerprint.fingerprint,
            "F6:7A:ED:BB:BC:94:CF:55:9D:B3:BA:74:7A:87:05:EF:67:4E:C2:DB"
        );
        assert_eq!(fingerprint.algorithm, SSLFingerprintAlgorithm::SHA256);
    }
}
