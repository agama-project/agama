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

use agama_software::{Resolvable, ResolvableType};
use agama_utils::api::ntp::{Config, Source};
use async_trait::async_trait;
use std::path::{Path, PathBuf};
use std::process::Output;
use std::{fs, io};
use tokio::process::Command;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Failed to write chronyd configuration")]
    WriteConfig(#[source] io::Error),
    #[error("Failed to reload chronyd")]
    Reload(#[source] io::Error),
    #[error("Failed to enable the chronyd service")]
    EnableService(#[source] io::Error),
    #[error("Failed to clean-up the chronyd configuration")]
    RemoveConfig(#[source] io::Error),
    #[error("Failed to synchronize with the NTP server")]
    Sync(#[source] io::Error),
}

const CHRONY_CONFIG_DIR: &str = "etc/chrony.d";
const CHRONY_CONFIG_FILE: &str = "99-installer.conf";
const CHRONY_MAX_TRIES: &str = "1";
const DEFAULT_WORKDIR: &str = "/";
const DEFAULT_INSTALL_DIR: &str = "/mnt";

#[async_trait]
pub trait ModelAdapter: Send + 'static {
    /// Apply the configuration to the current system.
    ///
    /// - `config`: configuration to apply.
    async fn write_config(&self, config: &Config) -> Result<(), Error>;

    /// Synchronize the time using the current configuration.
    ///
    /// Wait until the synchronization is done.
    async fn sync(&self) -> Result<(), Error>;

    /// Write the configuration to the target system.
    ///
    /// - `config`: configuration to apply.
    async fn install(&self, config: &Config) -> Result<(), Error>;

    /// Return the list of required resolvables.
    fn resolvables(&self) -> Vec<Resolvable> {
        vec![]
    }

    /// Remove the configuration from the current system.
    async fn remove_config(&self) -> Result<(), Error>;
}

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

    pub fn with_workdir<P: AsRef<Path>>(mut self, workdir: P) -> Self {
        self.workdir = PathBuf::from(workdir.as_ref());
        self
    }

    pub fn with_install_dir<P: AsRef<Path>>(mut self, install_dir: P) -> Self {
        self.install_dir = PathBuf::from(install_dir.as_ref());
        self
    }

    fn config_path(&self) -> PathBuf {
        self.workdir
            .join(CHRONY_CONFIG_DIR)
            .join(CHRONY_CONFIG_FILE)
    }

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

    async fn enable_service(&self) -> Result<(), Error> {
        tracing::info!("Enabling chronyd service on target system");

        let mut command = Command::new("chroot");
        let command = command
            .arg(&self.install_dir)
            .args(["systemctl", "enable", "chronyd"]);
        let output = command.output().await.map_err(Error::EnableService)?;

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
    async fn write_config(&self, config: &Config) -> Result<(), Error> {
        let path = self.config_path();

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(Error::WriteConfig)?;
        }

        let content = generate_chrony_config(&config.sources);
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
        let content = generate_chrony_config(&config.sources);
        fs::write(path, content).map_err(Error::WriteConfig)?;

        self.enable_service().await?;
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

fn generate_chrony_config(sources: &[Source]) -> String {
    let mut lines = vec!["# Generated by Agama".to_string()];

    for source in sources {
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

    #[test]
    fn test_generate_chrony_config_empty() {
        let sources = vec![];
        let config = generate_chrony_config(&sources);
        assert_eq!(config, "# Generated by Agama\n");
    }

    #[test]
    fn test_generate_chrony_config_single_pool() {
        let sources = vec![Source {
            source_type: SourceType::Pool,
            address: "0.opensuse.pool.ntp.org".to_string(),
            iburst: true,
            offline: false,
        }];

        let config = generate_chrony_config(&sources);
        assert_eq!(
            config,
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

        let config = generate_chrony_config(&sources);
        let expected = "# Generated by Agama\n\
                        pool 0.opensuse.pool.ntp.org iburst\n\
                        server ntp.example.com offline\n\
                        peer ntp-peer.local\n";
        assert_eq!(config, expected);
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_model_write_config(_ctx: &mut Context) {
        let tempdir = tempfile::tempdir().unwrap();
        let model = Model::new().with_workdir(tempdir.path());

        let config = Config {
            sources: vec![Source {
                source_type: SourceType::Pool,
                address: "ntp.example.com".to_string(),
                iburst: true,
                offline: false,
            }],
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
            sources: vec![Source {
                source_type: SourceType::Server,
                address: "ntp.server.com".to_string(),
                iburst: false,
                offline: true,
            }],
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
}
