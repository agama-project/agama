// Copyright (c) [2024] SUSE LLC
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
use agama_utils::api::users::config::{FirstUserConfig, RootUserConfig, UserPassword};
use agama_utils::api::users::Config;
use std::fs;
use std::fs::{OpenOptions, Permissions};
use std::io::Write;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// Abstract the users-related configuration from the underlying system.
pub trait ModelAdapter: Send + 'static {
    /// Apply the changes to target system. It is expected to be called almost
    /// at the end of the installation.
    fn install(&self, _config: &Config) -> Result<(), service::Error> {
        Ok(())
    }
}

/// [ModelAdapter] implementation for systemd-based systems.
pub struct Model {
    install_dir: PathBuf,
}

impl Model {
    pub fn new<P: AsRef<Path>>(install_dir: P) -> Self {
        Self {
            install_dir: PathBuf::from(install_dir.as_ref()),
        }
    }

    /// Wrapper for creating Command which works in installation chroot
    fn chroot_command(&self) -> Command {
        let mut cmd = Command::new("chroot");

        cmd.arg(&self.install_dir);

        cmd
    }

    /// Reads first user's data from given config and updates its setup accordingly
    fn add_first_user(&self, user: &FirstUserConfig) -> Result<(), service::Error> {
        let Some(ref user_name) = user.user_name else {
            return Err(service::Error::MissingUserData);
        };
        let Some(ref user_password) = user.password else {
            return Err(service::Error::MissingUserData);
        };

        let useradd = self
            .chroot_command()
            .args([
                "useradd",
                "-G",
                "wheel",
                &user_name])
            .output()?;

        if !useradd.status.success() {
            tracing::error!("User {} creation failed", user_name);
            return Err(service::Error::CommandFailed(format!(
                "User creation failed: {}",
                useradd.status
            )));
        }

        self.set_user_password(user_name, user_password)?;
        self.update_user_fullname(user)
    }

    /// Reads root's data from given config and updates root setup accordingly
    fn add_root_user(&self, root: &RootUserConfig) -> Result<(), service::Error> {
        if root.password.is_none() && root.ssh_public_key.is_none() {
            return Err(service::Error::MissingRootData);
        };

        // set password for root if any
        if let Some(ref root_password) = root.password {
            self.set_user_password("root", root_password)?;
        }

        // store ssh key for root if any
        if let Some(ref root_ssh_key) = root.ssh_public_key {
            self.update_authorized_keys(root_ssh_key)?;
        }

        Ok(())
    }

    /// Sets password for given user name
    ///
    /// echo "<user_name>:<password>" | chpasswd
    fn set_user_password(
        &self,
        user_name: &str,
        user_password: &UserPassword,
    ) -> Result<(), service::Error> {
        let mut passwd_cmd = self.chroot_command();
        passwd_cmd.arg("chpasswd");

        if user_password.hashed_password {
            passwd_cmd.arg("-e");
        }

        // Spawn process for passwd, listens for data from pipe
        let mut passwd_process = passwd_cmd.stdin(Stdio::piped()).spawn()?;

        // push user name and password into the pipe
        if let Some(mut stdin) = passwd_process.stdin.take() {
            writeln!(stdin, "{}:{}", user_name, user_password.password)?;
        }

        // proceed with the result
        let passwd = passwd_process.wait_with_output()?;

        if !passwd.status.success() {
            tracing::error!("Failed to set password for user {}", user_name);
            return Err(service::Error::CommandFailed(format!(
                "Cannot set password for user {}: {}",
                user_name, passwd.status
            )));
        }

        Ok(())
    }

    /// Updates root's authorized_keys file with SSH key
    fn update_authorized_keys(&self, ssh_key: &str) -> Result<(), service::Error> {
        let file_name = self.install_dir.join("root/.ssh/authorized_keys");
        let mut authorized_keys_file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&file_name)?;

        fs::set_permissions(&file_name, Permissions::from_mode(0o600))?;

        writeln!(authorized_keys_file, "{}", ssh_key.trim())?;

        Ok(())
    }

    fn update_user_fullname(&self, user: &FirstUserConfig) -> Result<(), service::Error> {
        let Some(ref user_name) = user.user_name else {
            return Ok(());
        };
        let Some(ref full_name) = user.full_name else {
            return Ok(());
        };

        let chfn = self
            .chroot_command()
            .args(["chfn", "-f", &full_name, &user_name])
            .output()?;

        if !chfn.status.success() {
            tracing::error!(
                "Setting full name {} for user {} failed",
                full_name,
                user_name
            );
            return Err(service::Error::CommandFailed(format!(
                "Cannot set full name {} for user {}: {}",
                full_name, user_name, chfn.status
            )));
        }

        Ok(())
    }
}

impl ModelAdapter for Model {
    fn install(&self, config: &Config) -> Result<(), service::Error> {
        if let Some(first_user) = &config.first_user {
            self.add_first_user(&first_user)?;
        }
        if let Some(root_user) = &config.root {
            self.add_root_user(&root_user)?;
        }

        Ok(())
    }
}
