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
use std::fs;
use std::io;
use std::path::Path;
use std::str::FromStr;

/// NTP configuration.
#[derive(Clone, Debug, Default, Merge, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(rename = "ntp.Config")]
pub struct Config {
    #[serde(skip_serializing_if = "Vec::is_empty")]
    #[serde(default)]
    #[merge(strategy = overwrite_non_empty)]
    pub sources: Vec<Source>,
}

impl Config {
    /// Read NTP configuration from a chrony configuration file.
    ///
    /// # Arguments
    ///
    /// * `path` - Path to the chrony configuration file
    ///
    /// # Returns
    ///
    /// A `Config` instance with the parsed sources, or an error if reading/parsing fails.
    pub fn from_chrony_conf<P: AsRef<Path>>(path: P) -> io::Result<Self> {
        let content = fs::read_to_string(path)?;
        Self::from_chrony_conf_str(&content)
    }

    /// Parse NTP configuration from a chrony configuration string.
    ///
    /// # Arguments
    ///
    /// * `content` - The chrony configuration content
    ///
    /// # Returns
    ///
    /// A `Config` instance with the parsed sources, or an error if parsing fails.
    pub fn from_chrony_conf_str(content: &str) -> io::Result<Self> {
        let mut sources = Vec::new();

        for line in content.lines() {
            let line = line.trim();

            // Skip empty lines and comments
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 2 {
                continue;
            }

            let source_type = match SourceType::from_str(parts[0]) {
                Ok(st) => st,
                Err(_) => continue, // Skip unknown source types
            };

            let address = parts[1].to_string();
            let mut iburst = false;
            let mut offline = false;

            // Parse options
            for option in &parts[2..] {
                match *option {
                    "iburst" => iburst = true,
                    "offline" => offline = true,
                    _ => {} // Ignore unknown options
                }
            }

            sources.push(Source {
                source_type,
                address,
                iburst,
                offline,
            });
        }

        Ok(Config { sources })
    }

    /// Determines whether the configuration is empty.
    pub fn is_empty(&self) -> bool {
        self.sources.is_empty()
    }
}

fn overwrite_non_empty<T>(left: &mut Vec<T>, mut right: Vec<T>) {
    if !right.is_empty() {
        left.clear();
        left.append(&mut right);
    }
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
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, JsonSchema, strum::Display)]
#[serde(rename_all = "lowercase")]
#[strum(serialize_all = "lowercase")]
pub enum SourceType {
    Pool,
    Server,
    Peer,
}

impl FromStr for SourceType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "pool" => Ok(SourceType::Pool),
            "server" => Ok(SourceType::Server),
            "peer" => Ok(SourceType::Peer),
            _ => Err(format!("Unknown source type: {}", s)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_serialization() {
        let config = Config {
            sources: vec![
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
            ],
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

    #[test]
    fn test_empty_sources_not_serialized() {
        let config = Config { sources: vec![] };
        let json = serde_json::to_string(&config).unwrap();
        assert_eq!(json, "{}");
    }

    #[test]
    fn test_merge_overwrite_non_empty() {
        let mut config1 = Config {
            sources: vec![Source {
                source_type: SourceType::Pool,
                address: "old.ntp.org".to_string(),
                iburst: true,
                offline: false,
            }],
        };

        let config2 = Config {
            sources: vec![Source {
                source_type: SourceType::Server,
                address: "new.ntp.org".to_string(),
                iburst: false,
                offline: true,
            }],
        };

        config1.merge(config2);
        assert_eq!(config1.sources.len(), 1);
        assert_eq!(config1.sources[0].address, "new.ntp.org");
    }

    #[test]
    fn test_merge_empty_keeps_original() {
        let mut config1 = Config {
            sources: vec![Source {
                source_type: SourceType::Pool,
                address: "original.ntp.org".to_string(),
                iburst: true,
                offline: false,
            }],
        };

        let config2 = Config { sources: vec![] };

        config1.merge(config2);
        assert_eq!(config1.sources.len(), 1);
        assert_eq!(config1.sources[0].address, "original.ntp.org");
    }

    #[test]
    fn test_from_chrony_conf_str_simple() {
        let content = "pool 0.opensuse.pool.ntp.org iburst\n";
        let config = Config::from_chrony_conf_str(content).unwrap();

        assert_eq!(config.sources.len(), 1);
        assert_eq!(config.sources[0].source_type, SourceType::Pool);
        assert_eq!(config.sources[0].address, "0.opensuse.pool.ntp.org");
        assert_eq!(config.sources[0].iburst, true);
        assert_eq!(config.sources[0].offline, false);
    }

    #[test]
    fn test_from_chrony_conf_str_multiple_sources() {
        let content = r#"# Generated by Agama
pool 0.opensuse.pool.ntp.org iburst
server ntp.example.com offline
peer ntp-peer.local
"#;
        let config = Config::from_chrony_conf_str(content).unwrap();

        assert_eq!(config.sources.len(), 3);

        assert_eq!(config.sources[0].source_type, SourceType::Pool);
        assert_eq!(config.sources[0].address, "0.opensuse.pool.ntp.org");
        assert_eq!(config.sources[0].iburst, true);
        assert_eq!(config.sources[0].offline, false);

        assert_eq!(config.sources[1].source_type, SourceType::Server);
        assert_eq!(config.sources[1].address, "ntp.example.com");
        assert_eq!(config.sources[1].iburst, false);
        assert_eq!(config.sources[1].offline, true);

        assert_eq!(config.sources[2].source_type, SourceType::Peer);
        assert_eq!(config.sources[2].address, "ntp-peer.local");
        assert_eq!(config.sources[2].iburst, false);
        assert_eq!(config.sources[2].offline, false);
    }

    #[test]
    fn test_from_chrony_conf_str_with_both_options() {
        let content = "server ntp.example.com iburst offline\n";
        let config = Config::from_chrony_conf_str(content).unwrap();

        assert_eq!(config.sources.len(), 1);
        assert_eq!(config.sources[0].iburst, true);
        assert_eq!(config.sources[0].offline, true);
    }

    #[test]
    fn test_from_chrony_conf_str_ignores_comments_and_empty_lines() {
        let content = r#"
# This is a comment
pool ntp1.org

# Another comment
server ntp2.org iburst

"#;
        let config = Config::from_chrony_conf_str(content).unwrap();

        assert_eq!(config.sources.len(), 2);
        assert_eq!(config.sources[0].address, "ntp1.org");
        assert_eq!(config.sources[1].address, "ntp2.org");
    }

    #[test]
    fn test_from_chrony_conf_str_empty_content() {
        let content = "# Only comments\n\n";
        let config = Config::from_chrony_conf_str(content).unwrap();

        assert_eq!(config.sources.len(), 0);
    }

    #[test]
    fn test_from_chrony_conf_str_invalid_lines_skipped() {
        let content = r#"pool ntp.org iburst
invalid_line
server ntp2.org
just_one_word
"#;
        let config = Config::from_chrony_conf_str(content).unwrap();

        assert_eq!(config.sources.len(), 2);
        assert_eq!(config.sources[0].address, "ntp.org");
        assert_eq!(config.sources[1].address, "ntp2.org");
    }

    #[test]
    fn test_from_chrony_conf_str_unknown_options_ignored() {
        let content = "pool ntp.org iburst unknown_option offline another_unknown\n";
        let config = Config::from_chrony_conf_str(content).unwrap();

        assert_eq!(config.sources.len(), 1);
        assert_eq!(config.sources[0].iburst, true);
        assert_eq!(config.sources[0].offline, true);
    }

    #[test]
    fn test_source_type_from_str() {
        assert_eq!(SourceType::from_str("pool").unwrap(), SourceType::Pool);
        assert_eq!(SourceType::from_str("server").unwrap(), SourceType::Server);
        assert_eq!(SourceType::from_str("peer").unwrap(), SourceType::Peer);
        assert_eq!(SourceType::from_str("Pool").unwrap(), SourceType::Pool);
        assert_eq!(SourceType::from_str("SERVER").unwrap(), SourceType::Server);
        assert!(SourceType::from_str("unknown").is_err());
    }

    #[test]
    fn test_from_chrony_conf_file() {
        use std::io::Write;
        use tempfile::NamedTempFile;

        let content = r#"# Test config
pool 0.opensuse.pool.ntp.org iburst
server ntp.example.com offline
"#;

        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file.write_all(content.as_bytes()).unwrap();

        let config = Config::from_chrony_conf(temp_file.path()).unwrap();

        assert_eq!(config.sources.len(), 2);
        assert_eq!(config.sources[0].source_type, SourceType::Pool);
        assert_eq!(config.sources[1].source_type, SourceType::Server);
    }
}
