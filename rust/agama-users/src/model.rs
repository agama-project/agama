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
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::ops::{Deref, DerefMut};

/// Abstract the users-related configuration from the underlying system.
pub trait ModelAdapter: Send + 'static {
    /// Apply the changes to target system. It is expected to be called almost
    /// at the end of the installation.
    fn install(&self, _config: &Config) -> Result<(), service::Error> {
        Ok(())
    }
}

struct ChrootCommand {
    command: Command,
}

impl ChrootCommand {
    pub fn new(chroot: PathBuf) -> Self {
        // TODO: check if the dir exists?
        let mut cmd = Command::new("chroot");

        cmd.arg(chroot);

        Self { command: cmd }
    }

    pub fn cmd(mut self, command: &str) -> Self {
        self.command.arg(command);

        self
    }
}

impl Deref for ChrootCommand {
    type Target = Command;

    fn deref(&self) -> &Self::Target {
        &self.command
    }
}

impl DerefMut for ChrootCommand {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.command
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

    /// Reads first user's data from given config and updates its setup accordingly
    fn add_first_user(&self, user: &FirstUserConfig) -> Result<(), service::Error> {
        let Some(ref user_name) = user.user_name else {
            return Err(service::Error::MissingUserData);
        };
        let Some(ref user_password) = user.password else {
            return Err(service::Error::MissingUserData);
        };

        let useradd = ChrootCommand::new(self.install_dir.clone())
                    .cmd("useradd")
                    .args(["-G", "wheel", &user_name])
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
            self.enable_sshd_service()?;
            self.open_ssh_port()?;
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
        let mut passwd_cmd = ChrootCommand::new(self.install_dir.clone())
                    .cmd("chpasswd");

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
        let mode = 0o644;
        let file_name = self.install_dir.join("root/.ssh/authorized_keys");
        let mut authorized_keys_file = OpenOptions::new()
            .create(true)
            .append(true)
            // sets mode only for a new file
            .mode(mode)
            .open(&file_name)?;

        // sets mode also for an existing file
        fs::set_permissions(&file_name, Permissions::from_mode(mode))?;

        writeln!(authorized_keys_file, "{}", ssh_key.trim())?;

        Ok(())
    }

    /// Enables sshd service in the target system
    fn enable_sshd_service(&self) -> Result<(), service::Error> {
        let systemctl = self
            .chroot_command()
            .args(["systemctl", "enable", "sshd.service"])
            .output()?;

        if !systemctl.status.success() {
            tracing::error!("Enabling the sshd service failed");
            return Err(service::Error::CommandFailed(format!(
                "Cannot enable the sshd service: {}",
                systemctl.status
            )));
        } else {
            tracing::info!("The sshd service has been successfully enabled");
        }

        Ok(())
    }

    /// Opens the SSH port in firewall in the target system
    fn open_ssh_port(&self) -> Result<(), service::Error> {
        let firewall_cmd = self
            .chroot_command()
            .args(["firewall-offline-cmd", "--add-service=ssh"])
            .output()?;

        // ignore error if the firewall is not installed, in that case we do need to open the port,
        // chroot returns exit status 127 if the command is not found
        if firewall_cmd.status.code() == Some(127) {
            tracing::warn!("Command firewall-offline-cmd not found, firewall not installed?");
            return Ok(());
        }

        if firewall_cmd.status.success() {
            tracing::info!("The SSH port has been successfully opened in the firewall");
        } else {
            tracing::error!(
                "Opening SSH port in firewall failed: exit: {}, stderr: {}",
                firewall_cmd.status,
                String::from_utf8_lossy(&firewall_cmd.stderr)
            );

            return Err(service::Error::CommandFailed(String::from(
                "Cannot open SSH port in firewall",
            )));
        }

        Ok(())
    }

    fn update_user_fullname(&self, user: &FirstUserConfig) -> Result<(), service::Error> {
        let Some(ref user_name) = user.user_name else {
            return Ok(());
        };
        let Some(ref full_name) = user.full_name else {
            return Ok(());
        };

        let chfn = ChrootCommand::new(self.install_dir.clone())
                    .cmd("chfn")
                    .args(["-f", &full_name, &user_name])
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
