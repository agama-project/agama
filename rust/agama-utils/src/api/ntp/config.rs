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

use merge::Merge;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// NTP configuration.
#[derive(Clone, Debug, Default, Merge, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(rename = "ntp.Config")]
pub struct Config {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub sources: Option<Vec<Source>>,
}

/// NTP source configuration.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    #[serde(rename = "type")]
    pub source_type: SourceType,
    pub address: String,
    #[serde(default)]
    pub iburst: bool,
    #[serde(default)]
    pub offline: bool,
}

/// NTP source type (pool, server, or peer).
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum SourceType {
    Pool,
    Server,
    Peer,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_serialization() {
        let config = Config {
            sources: Some(vec![
                Source {
                    source_type: SourceType::Pool,
                    address: "0.opensuse.pool.ntp.org".to_string(),
                    iburst: true,
                    offline: false,
                },
                Source {
                    source_type: SourceType::Server,
                    address: "ntp.example.com".to_string(),
                    iburst: false,
                    offline: true,
                },
            ]),
        };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"pool\""));
        assert!(json.contains("\"server\""));
        assert!(json.contains("0.opensuse.pool.ntp.org"));
        assert!(json.contains("ntp.example.com"));

        let deserialized: Config = serde_json::from_str(&json).unwrap();
        assert_eq!(config, deserialized);
    }

    #[test]
    fn test_source_type_serialization() {
        let pool = SourceType::Pool;
        let server = SourceType::Server;
        let peer = SourceType::Peer;

        assert_eq!(serde_json::to_string(&pool).unwrap(), "\"pool\"");
        assert_eq!(serde_json::to_string(&server).unwrap(), "\"server\"");
        assert_eq!(serde_json::to_string(&peer).unwrap(), "\"peer\"");
    }

    #[test]
    fn test_default_values() {
        let json = r#"{"type": "pool", "address": "ntp.org"}"#;
        let source: Source = serde_json::from_str(json).unwrap();
        assert_eq!(source.iburst, false);
        assert_eq!(source.offline, false);
    }
}
