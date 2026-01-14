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
use std::process::{Command, Stdio};

/// Abstract the users-related configuration from the underlying system.
pub trait ModelAdapter: Send + 'static {
    /// Apply the changes to target system. It is expected to be called almost
    /// at the end of the installation.
    fn install(&self, _config: &Config) -> Result<(), service::Error> {
        Ok(())
    }

    fn add_first_user(&self, _user: &FirstUserConfig) -> Result<(), service::Error> {
        Ok(())
    }

    fn add_root_user(&self, _root: &RootUserConfig) -> Result<(), service::Error> {
        Ok(())
    }

    fn set_user_password(
        &self,
        _user_name: &String,
        _user_password: &UserPassword,
    ) -> Result<(), service::Error> {
        Ok(())
    }

    fn update_authorized_keys(&self, _ssh_key: &String) -> Result<(), service::Error> {
        Ok(())
    }
}

/// [ModelAdapter] implementation for systemd-based systems.
pub struct Model {}

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

    /// Reads first user's data from given config and updates its setup accordingly
    fn add_first_user(&self, user: &FirstUserConfig) -> Result<(), service::Error> {
        let Some(ref user_name) = user.user_name else {
            return Err(service::Error::MissingUserData);
        };
        let Some(ref user_password) = user.password else {
            return Err(service::Error::MissingUserData);
        };

        let useradd = Command::new("/usr/sbin/useradd").arg(user_name).output()?;

        if !useradd.status.success() {
            tracing::error!("User {} creation failed", user_name);
            return Err(service::Error::IO(std::io::Error::other(format!(
                "User creation failed: {}",
                useradd.status
            ))));
        }

        self.set_user_password(user_name, user_password)
    }

    /// Reads root's data from given config and updates root setup accordingly
    fn add_root_user(&self, root: &RootUserConfig) -> Result<(), service::Error> {
        if root.password.is_none() || root.ssh_public_key.is_none() {
            return Err(service::Error::MissingRootData);
        };

        // set password for root if any
        if let Some(ref root_password) = root.password {
            self.set_user_password(&String::from("root"), root_password)?;
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
        user_name: &String,
        user_password: &UserPassword,
    ) -> Result<(), service::Error> {
        let mut passwd_cmd = Command::new("/usr/sbin/chpasswd");

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
            tracing::error!("Setting password for user {} creation failed", user_name);
            return Err(service::Error::IO(std::io::Error::other(format!(
                "Cannot set password for user {}: {}",
                user_name, passwd.status
            ))));
        }

        Ok(())
    }

    /// Updates root's authorized_keys file with SSH key
    fn update_authorized_keys(&self, ssh_key: &String) -> Result<(), service::Error> {
        let file_name = String::from("/root/.ssh/authorized_keys");
        let mut authorized_keys_file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&file_name)?;

        fs::set_permissions(&file_name, Permissions::from_mode(0o600))?;

        writeln!(authorized_keys_file, "{}", ssh_key.trim())?;

        Ok(())
    }
}
