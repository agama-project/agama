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
//! Implements a data model for Bootloader configuration.

use merge::Merge;
use serde::{Deserialize, Deserializer, Serialize};

/// Security settings for installation
#[derive(Clone, Debug, Default, Serialize, Deserialize, Merge, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    /// List of user selected patterns to install.
    #[serde(skip_serializing_if = "Option::is_none")]
    // when we add support for remote URL here it should be vector of SSL
    // certificates which will include flatten fingerprint
    #[merge(strategy = merge::option::overwrite_none)]
    pub ssl_certificates: Option<Vec<SSLFingerprint>>,
}

#[derive(Default, Clone, Copy, Debug, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
pub enum SSLFingerprintAlgorithm {
    #[serde(alias = "sha1", alias = "SHA1")]
    SHA1,
    #[serde(alias = "sha256", alias = "SHA256")]
    #[default]
    SHA256,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
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
    pub fn new(fingerprint: &str, algorithm: SSLFingerprintAlgorithm) -> Self {
        Self {
            fingerprint: normalize_fingerprint(fingerprint),
            algorithm,
        }
    }

    /// Helper function to creaate a SHA1 fingerprint.
    pub fn sha1(fingerprint: &str) -> Self {
        Self::new(fingerprint, SSLFingerprintAlgorithm::SHA1)
    }

    /// Helper function to creaate a SHA256 fingerprint.
    pub fn sha256(fingerprint: &str) -> Self {
        Self::new(fingerprint, SSLFingerprintAlgorithm::SHA256)
    }
}

impl ToString for SSLFingerprint {
    fn to_string(&self) -> String {
        self.fingerprint.clone()
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
