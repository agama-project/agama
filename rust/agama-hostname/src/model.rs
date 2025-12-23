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

use crate::service;
use agama_utils::api::hostname::SystemInfo;
use std::{fs, path::PathBuf, process::Command};

/// Abstract the hostname-related configuration from the underlying system.
///
/// It offers an API to query and set the transient or static hostname of a
/// system. This trait can be implemented to replace the real system during
/// tests.
pub trait ModelAdapter: Send + 'static {
    /// Reads the system info.
    fn system_info(&self) -> SystemInfo {
        SystemInfo {
            r#static: self.static_hostname().unwrap_or_default(),
            hostname: self.hostname().unwrap_or_default(),
        }
    }

    /// Current system hostname.
    fn hostname(&self) -> Result<String, service::Error>;

    /// Current system static hostname.
    fn static_hostname(&self) -> Result<String, service::Error>;

    /// Change the system static hostname.
    fn set_static_hostname(&mut self, name: String) -> Result<(), service::Error>;

    /// Change the system hostname
    fn set_hostname(&mut self, name: String) -> Result<(), service::Error>;

    /// Apply the changes to target system. It is expected to be called almost
    /// at the end of the installation.
    fn install(&self) -> Result<(), service::Error>;

    // Target directory to copy the static hostname at the end of the installation
    fn static_target_dir(&self) -> &str;
}

/// [ModelAdapter] implementation for systemd-based systems.
pub struct Model;

impl ModelAdapter for Model {
    fn static_hostname(&self) -> Result<String, service::Error> {
        let output = Command::new("hostnamectl")
            .args(["hostname", "--static"])
            .output()?;
        let output = String::from_utf8_lossy(&output.stdout).trim().parse();

        Ok(output.unwrap_or_default())
    }

    fn hostname(&self) -> Result<String, service::Error> {
        let output = Command::new("hostnamectl")
            .args(["hostname", "--transient"])
            .output()?;
        let output = String::from_utf8_lossy(&output.stdout).trim().parse();

        Ok(output.unwrap_or_default())
    }

    fn set_static_hostname(&mut self, name: String) -> Result<(), service::Error> {
        Command::new("hostnamectl")
            .args(["set-hostname", "--static", name.as_str()])
            .output()?;

        Ok(())
    }

    fn set_hostname(&mut self, name: String) -> Result<(), service::Error> {
        Command::new("hostnamectl")
            .args(["set-hostname", "--transient", name.as_str()])
            .output()?;
        Ok(())
    }

    fn static_target_dir(&self) -> &str {
        "/mnt"
    }

    /// Copy the static hostname to the target system
    fn install(&self) -> Result<(), service::Error> {
        const HOSTNAME_PATH: &str = "/etc/hostname";
        let from = PathBuf::from(HOSTNAME_PATH);
        if from.exists() {
            let to = PathBuf::from(self.static_target_dir()).join(HOSTNAME_PATH);
            fs::create_dir_all(to.parent().unwrap())?;
            fs::copy(from, to)?;
        }
        Ok(())
    }
}
#[cfg(test)]
pub mod tests {
    use super::*;
    use tempfile::{tempdir, TempDir};

    #[derive(Clone)]
    pub struct TestModel {
        pub source_dir: PathBuf,
        pub target_dir: PathBuf,
    }

    impl ModelAdapter for TestModel {
        fn hostname(&self) -> Result<String, service::Error> {
            Ok("test-hostname".to_string())
        }

        fn static_hostname(&self) -> Result<String, service::Error> {
            let path = self.source_dir.join("etc/hostname");
            fs::read_to_string(path).map_err(service::Error::from)
        }

        fn set_static_hostname(&mut self, name: String) -> Result<(), service::Error> {
            let path = self.source_dir.join("etc/hostname");
            fs::write(path, name).map_err(service::Error::from)
        }

        fn set_hostname(&mut self, _name: String) -> Result<(), service::Error> {
            Ok(())
        }

        fn install(&self) -> Result<(), service::Error> {
            let from = self.source_dir.join("etc/hostname");
            if from.exists() {
                let to = self.target_dir.join("etc/hostname");
                fs::create_dir_all(to.parent().unwrap())?;
                fs::copy(from, to)?;
            }
            Ok(())
        }

        fn static_target_dir(&self) -> &str {
            self.target_dir.to_str().unwrap()
        }
    }

    #[test]
    fn test_install() -> Result<(), service::Error> {
        let temp_source = tempdir()?;
        let temp_target = tempdir()?;
        let hostname_path = temp_source.path().join("etc");
        fs::create_dir_all(&hostname_path)?;
        fs::write(hostname_path.join("hostname"), "test-hostname")?;

        let model = TestModel {
            source_dir: temp_source.path().to_path_buf(),
            target_dir: temp_target.path().to_path_buf(),
        };

        model.install()?;

        let installed_hostname_path = temp_target.path().join("etc/hostname");
        assert!(fs::exists(&installed_hostname_path)?);
        let content = fs::read_to_string(installed_hostname_path)?;
        assert_eq!(content, "test-hostname");

        Ok(())
    }
}
