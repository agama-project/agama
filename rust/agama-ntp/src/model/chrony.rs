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

//! This module defines a chrony-based module for the agama-ntp service.

use agama_software::{Resolvable, ResolvableType};
use agama_utils::api::ntp::{Config, Source, SourceType};
use agama_utils::command::enable_service;
use async_trait::async_trait;
use std::path::{Path, PathBuf};
use std::process::Output;
use std::str::FromStr;
use std::{fs, io};
use tokio::process::Command;

use crate::model::{Error, ModelAdapter};

const CHRONY_CONFIG_DIR: &str = "etc/chrony.d";
const CHRONY_CONFIG_FILE: &str = "99-installer.conf";
const CHRONY_MAX_TRIES: &str = "1";
const CHRONY_SERVICE_NAME: &str = "chronyd";
const DEFAULT_WORKDIR: &str = "/";
const DEFAULT_INSTALL_DIR: &str = "/mnt";
const DRACUT_CHRONY_CONFIG: &str = "run/chrony/dracut.sources.d/dracut.sources";

pub struct Model {
    workdir: PathBuf,
    install_dir: PathBuf,
}

impl Model {
    pub fn new() -> Self {
        Self {
            workdir: PathBuf::from(DEFAULT_WORKDIR),
            install_dir: PathBuf::from(DEFAULT_INSTALL_DIR),
        }
    }

    /// Sets the work directory (usually "/").
    pub fn with_workdir<P: AsRef<Path>>(mut self, workdir: P) -> Self {
        self.workdir = PathBuf::from(workdir.as_ref());
        self
    }

    /// Sets the install directory (usually "/mnt").
    pub fn with_install_dir<P: AsRef<Path>>(mut self, install_dir: P) -> Self {
        self.install_dir = PathBuf::from(install_dir.as_ref());
        self
    }

    /// Chrony configuration path.
    fn config_path(&self) -> PathBuf {
        self.workdir
            .join(CHRONY_CONFIG_DIR)
            .join(CHRONY_CONFIG_FILE)
    }

    /// Chrony configuration path in the installed system.
    fn install_config_path(&self) -> PathBuf {
        self.install_dir
            .join(CHRONY_CONFIG_DIR)
            .join(CHRONY_CONFIG_FILE)
    }

    async fn reload_chrony(&self) -> Result<(), Error> {
        tracing::info!("Reloading chronyc sources");

        let output = Command::new("chronyc")
            .args(["reload", "sources"])
            .output()
            .await
            .map_err(Error::Reload)?;

        if output.status.success() {
            return Ok(());
        }

        Err(Error::Reload(command_output_to_error(&output)))
    }
}

impl Default for Model {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ModelAdapter for Model {
    fn get_config(&self) -> Result<Config, Error> {
        let sources_path = self.workdir.join(DRACUT_CHRONY_CONFIG);
        parse_chrony_config(sources_path).map_err(Error::ReadConfig)
    }

    async fn write_config(&self, config: &Config) -> Result<(), Error> {
        let path = self.config_path();

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(Error::WriteConfig)?;
        }

        let content = generate_chrony_config(config);
        fs::write(&path, content).map_err(Error::WriteConfig)?;

        self.reload_chrony().await?;
        Ok(())
    }

    async fn sync(&self) -> Result<(), Error> {
        tracing::info!("Synchronizing with NTP");

        // Limit the attempts to avoid getting blocked.
        let output = Command::new("chronyc")
            .args(["waitsync", CHRONY_MAX_TRIES])
            .output()
            .await
            .map_err(Error::Sync)?;

        if output.status.success() {
            return Ok(());
        }

        Err(Error::Sync(command_output_to_error(&output)))
    }

    async fn install(&self, config: &Config) -> Result<(), Error> {
        let path = self.install_config_path();

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(Error::WriteConfig)?;
        }

        // FIXME: copying the configuration would be enough.
        let content = generate_chrony_config(config);

        fs::write(path, content).map_err(Error::WriteConfig)?;

        enable_service(&self.install_dir, CHRONY_SERVICE_NAME);
        Ok(())
    }

    fn resolvables(&self) -> Vec<Resolvable> {
        vec![Resolvable::new("chrony", ResolvableType::Package)]
    }

    async fn remove_config(&self) -> Result<(), Error> {
        let path = self.config_path();

        if fs::exists(&path).map_err(Error::RemoveConfig)? {
            fs::remove_file(&path).map_err(Error::RemoveConfig)?;
        }

        Ok(())
    }
}

fn generate_chrony_config(config: &Config) -> String {
    let mut lines = vec!["# Generated by Agama".to_string()];

    for source in config.sources.as_deref().unwrap_or_default() {
        let mut parts = vec![source.source_type.to_string(), source.address.clone()];

        if source.iburst {
            parts.push("iburst".to_string());
        }

        if source.offline {
            parts.push("offline".to_string());
        }

        lines.push(parts.join(" "));
    }

    lines.push(String::new());
    lines.join("\n")
}

/// Parse NTP configuration from a chrony configuration file.
///
/// # Arguments
///
/// * `path` - Path to the chrony configuration file
///
/// # Returns
///
/// A `Config` instance with the parsed sources, or an error if reading/parsing fails.
pub fn parse_chrony_config<P: AsRef<Path>>(path: P) -> io::Result<Config> {
    let content = fs::read_to_string(path)?;
    parse_chrony_config_str(&content)
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
pub fn parse_chrony_config_str(content: &str) -> io::Result<Config> {
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

    let sources = if sources.is_empty() {
        None
    } else {
        Some(sources)
    };

    Ok(Config { sources })
}

// Errors from chronyc are logged to stdout. This ancillary function turns an Output object into a
// std::io::Error::Other error.
fn command_output_to_error(output: &Output) -> io::Error {
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let message = format!(
        "stdout={}; stderr={}; exit={}",
        stdout, stderr, output.status
    );
    io::Error::other(message)
}

#[cfg(test)]
mod tests {
    use std::fs::File;

    use agama_utils::api::ntp::SourceType;
    use test_context::{test_context, AsyncTestContext};

    use super::*;

    struct Context;

    impl AsyncTestContext for Context {
        async fn setup() -> Self {
            let old_path = std::env::var("PATH").unwrap();
            let bin_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../share/bin");
            std::env::set_var("PATH", format!("{}:{}", &bin_dir.display(), &old_path));
            Self
        }
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_get_config(_ctx: &mut Context) {
        let tempdir = tempfile::tempdir().unwrap();
        let dracut_chrony_dir = tempdir.path().join("run/chrony/dracut.sources.d");
        std::fs::create_dir_all(&dracut_chrony_dir).unwrap();
        let content = "pool pool.ntp.org iburst";
        std::fs::write(dracut_chrony_dir.join("dracut.sources"), content).unwrap();

        let model = Model::new().with_workdir(tempdir.path());
        let config = model.get_config().unwrap();

        assert_eq!(config.sources.as_ref().unwrap().len(), 1);
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_model_write_config(_ctx: &mut Context) {
        let tempdir = tempfile::tempdir().unwrap();
        let model = Model::new().with_workdir(tempdir.path());

        let config = Config {
            sources: Some(vec![Source {
                source_type: SourceType::Pool,
                address: "ntp.example.com".to_string(),
                iburst: true,
                offline: false,
            }]),
        };

        model.write_config(&config).await.unwrap();

        let written_path = tempdir
            .path()
            .join(CHRONY_CONFIG_DIR)
            .join(CHRONY_CONFIG_FILE);
        assert!(written_path.exists());

        let content = std::fs::read_to_string(&written_path).unwrap();
        assert!(content.contains("# Generated by Agama"));
        assert!(content.contains("pool ntp.example.com iburst"));
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_model_install(_ctx: &mut Context) {
        let tempdir = tempfile::tempdir().unwrap();
        let model = Model::new().with_install_dir(tempdir.path());

        let config = Config {
            sources: Some(vec![Source {
                source_type: SourceType::Server,
                address: "ntp.server.com".to_string(),
                iburst: false,
                offline: true,
            }]),
        };

        model.install(&config).await.unwrap();

        let install_path = tempdir
            .path()
            .join(CHRONY_CONFIG_DIR)
            .join(CHRONY_CONFIG_FILE);
        assert!(install_path.exists());

        let content = std::fs::read_to_string(&install_path).unwrap();
        assert!(content.contains("server ntp.server.com offline"));
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_model_remove_config(_ctx: &mut Context) {
        let tempdir = tempfile::tempdir().unwrap();
        let model = Model::new().with_workdir(tempdir.path());

        let config_dir = tempdir.path().join(CHRONY_CONFIG_DIR);
        let written_path = config_dir.join(CHRONY_CONFIG_FILE);
        std::fs::create_dir_all(&config_dir)
            .expect("Failed to create the directory for chrony configuration");
        File::create(&written_path).unwrap();

        assert!(written_path.exists());
        model
            .remove_config()
            .await
            .expect("Failed to remove the chrony configuration");
        assert!(!written_path.exists());
    }

    #[test]
    fn test_generate_chrony_config_empty() {
        let config = Config {
            sources: Some(vec![]),
        };
        let output = generate_chrony_config(&config);
        assert_eq!(output, "# Generated by Agama\n");
    }

    #[test]
    fn test_generate_chrony_config_single_pool() {
        let sources = vec![Source {
            source_type: SourceType::Pool,
            address: "0.opensuse.pool.ntp.org".to_string(),
            iburst: true,
            offline: false,
        }];

        let config = Config {
            sources: Some(sources),
        };
        let output = generate_chrony_config(&config);
        assert_eq!(
            output,
            "# Generated by Agama\npool 0.opensuse.pool.ntp.org iburst\n"
        );
    }

    #[test]
    fn test_generate_chrony_config_multiple_sources() {
        let sources = vec![
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
            Source {
                source_type: SourceType::Peer,
                address: "ntp-peer.local".to_string(),
                iburst: false,
                offline: false,
            },
        ];

        let config = Config {
            sources: Some(sources),
        };
        let output = generate_chrony_config(&config);
        let expected = "# Generated by Agama\n\
                        pool 0.opensuse.pool.ntp.org iburst\n\
                        server ntp.example.com offline\n\
                        peer ntp-peer.local\n";
        assert_eq!(output, expected);
    }

    #[test]
    fn test_parse_chrony_config_str_simple() {
        let content = "pool 0.opensuse.pool.ntp.org iburst\n";
        let config = parse_chrony_config_str(content).unwrap();

        let sources = config.sources.as_ref().unwrap();
        assert_eq!(sources.len(), 1);
        assert_eq!(sources[0].source_type, SourceType::Pool);
        assert_eq!(sources[0].address, "0.opensuse.pool.ntp.org");
        assert_eq!(sources[0].iburst, true);
        assert_eq!(sources[0].offline, false);
    }

    #[test]
    fn test_parse_chrony_config_str_multiple_sources() {
        let content = r#"# Generated by Agama
pool 0.opensuse.pool.ntp.org iburst
server ntp.example.com offline
peer ntp-peer.local
"#;
        let config = parse_chrony_config_str(content).unwrap();

        let sources = config.sources.as_ref().unwrap();
        assert_eq!(sources.len(), 3);

        assert_eq!(sources[0].source_type, SourceType::Pool);
        assert_eq!(sources[0].address, "0.opensuse.pool.ntp.org");
        assert_eq!(sources[0].iburst, true);
        assert_eq!(sources[0].offline, false);

        assert_eq!(sources[1].source_type, SourceType::Server);
        assert_eq!(sources[1].address, "ntp.example.com");
        assert_eq!(sources[1].iburst, false);
        assert_eq!(sources[1].offline, true);

        assert_eq!(sources[2].source_type, SourceType::Peer);
        assert_eq!(sources[2].address, "ntp-peer.local");
        assert_eq!(sources[2].iburst, false);
        assert_eq!(sources[2].offline, false);
    }

    #[test]
    fn test_parse_chrony_config_str_with_both_options() {
        let content = "server ntp.example.com iburst offline\n";
        let config = parse_chrony_config_str(content).unwrap();

        let sources = config.sources.as_ref().unwrap();
        assert_eq!(sources.len(), 1);
        assert_eq!(sources[0].iburst, true);
        assert_eq!(sources[0].offline, true);
    }

    #[test]
    fn test_parse_chrony_config_str_ignores_comments_and_empty_lines() {
        let content = r#"
# This is a comment
pool ntp1.org

# Another comment
server ntp2.org iburst

"#;
        let config = parse_chrony_config_str(content).unwrap();

        let sources = config.sources.as_ref().unwrap();
        assert_eq!(sources.len(), 2);
        assert_eq!(sources[0].address, "ntp1.org");
        assert_eq!(sources[1].address, "ntp2.org");
    }

    #[test]
    fn test_parse_chrony_config_str_empty_content() {
        let content = "# Only comments\n\n";
        let config = parse_chrony_config_str(content).unwrap();

        assert!(config.sources.is_none());
    }

    #[test]
    fn test_parse_chrony_config_str_invalid_lines_skipped() {
        let content = r#"pool ntp.org iburst
invalid_line
server ntp2.org
just_one_word
"#;
        let config = parse_chrony_config_str(content).unwrap();

        let sources = config.sources.as_ref().unwrap();
        assert_eq!(sources.len(), 2);
        assert_eq!(sources[0].address, "ntp.org");
        assert_eq!(sources[1].address, "ntp2.org");
    }

    #[test]
    fn test_parse_chrony_config_str_unknown_options_ignored() {
        let content = "pool ntp.org iburst unknown_option offline another_unknown\n";
        let config = parse_chrony_config_str(content).unwrap();

        let sources = config.sources.as_ref().unwrap();
        assert_eq!(sources.len(), 1);
        assert_eq!(sources[0].iburst, true);
        assert_eq!(sources[0].offline, true);
    }

    #[test]
    fn test_parse_chrony_config_file() {
        use std::io::Write;
        use tempfile::NamedTempFile;

        let content = r#"# Test config
pool 0.opensuse.pool.ntp.org iburst
server ntp.example.com offline
"#;

        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file.write_all(content.as_bytes()).unwrap();

        let config = parse_chrony_config(temp_file.path()).unwrap();

        let sources = config.sources.as_ref().unwrap();
        assert_eq!(sources.len(), 2);
        assert_eq!(sources[0].source_type, SourceType::Pool);
        assert_eq!(sources[1].source_type, SourceType::Server);
    }
}
