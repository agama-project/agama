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
use agama_utils::api::users::config::{FirstUserConfig, RootUserConfig};
use agama_utils::api::users::Config;
use std::process::{Command, Stdio};
use std::io::Write;

/// Abstract the users-related configuration from the underlying system.
pub trait ModelAdapter: Send + 'static {
    /// Apply the changes to target system. It is expected to be called almost
    /// at the end of the installation.
    fn install(&self, _config: &Config) -> Result<(), service::Error> {
        Ok(())
    }

    fn add_first_user(&self, user: &FirstUserConfig) -> Result<(), service::Error> {
        Ok(())
    }

    fn add_root_user(&self, user: &RootUserConfig) -> Result<(), service::Error> {
        Ok(())
    }
}

/// [ModelAdapter] implementation for systemd-based systems.
pub struct Model {}

impl ModelAdapter for Model {
    fn install(&self, config: &Config) -> Result<(), service::Error> {
        tracing::info!("Users service - Model::install");

        if let Some(first_user) = &config.first_user {
            self.add_first_user(&first_user);
        }
        if let Some(root_user) = &config.root {
            self.add_root_user(&root_user);
        }

        Ok(())
    }

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

        // Set the password for the newly created user
        let mut passwd_cmd = Command::new("/usr/sbin/chpasswd");

        if user_password.hashed_password {
            passwd_cmd.arg("-e");
        }

        let mut passwd_process = passwd_cmd
            .stdin(Stdio::piped())
            .spawn()?;

        if let Some(mut stdin) = passwd_process.stdin.take() {
            writeln!(stdin, "{}:{}", user_name, user_password.password);
        }

        let passwd = passwd_process.wait_with_output()?;

        if !passwd.status.success() {
            tracing::error!("Setting passeord for user {} creation failed", user_name);
            return Err(service::Error::IO(std::io::Error::other(format!(
                "Cannot set password for user {}: {}",
                user_name,
                passwd.status
            ))));
        }

        Ok(())
    }

    fn add_root_user(&self, user: &RootUserConfig) -> Result<(), service::Error> {
        Ok(())
    }
}
