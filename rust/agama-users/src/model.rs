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
use std::fs::{self, OpenOptions, Permissions};
use std::io::Write;
use std::ops::{Deref, DerefMut};
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
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

/// A wrapper for common std::process::Command for use in chroot
///
/// It basically creates Command for chroot and command to be run
/// in chrooted environment is passed as an argument.
///
/// Example use:
/// ```
/// # use agama_users::ChrootCommand;
/// # use agama_users::service;
/// # fn main() -> Result<(), service::Error> {
/// let cmd = ChrootCommand::new("/tmp".into())?
///   .cmd("echo")
///   .args(["Hello world!"]);
/// # Ok(())
/// # }
/// ```
#[derive(Debug)]
pub struct ChrootCommand {
    command: Command,
}

impl ChrootCommand {
    pub fn new(chroot: PathBuf) -> Result<Self, service::Error> {
        if !chroot.is_dir() {
            return Err(service::Error::CommandFailed(String::from(
                "Failed to chroot",
            )));
        }

        let mut cmd = Command::new("chroot");

        cmd.arg(chroot);

        Ok(Self { command: cmd })
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

    fn useradd(&self, user_name: &str) -> Result<(), service::Error> {
        let useradd = ChrootCommand::new(self.install_dir.clone())?
            .cmd("useradd")
            // Explicitly enforce creating home here, so even if some product has as default no
            // home, we need it to be able to support user ssh keys.
            .args(["-m", user_name])
            .output()?;

        if !useradd.status.success() {
            tracing::error!("User {} creation failed", user_name);
            return Err(service::Error::CommandFailed(format!(
                "User creation failed: {}",
                useradd.status
            )));
        }

        Ok(())
    }

    /// Reads first user's data from given config and updates its setup accordingly
    fn add_first_user(&self, user: &FirstUserConfig) {
        let Some(ref user_name) = user.user_name else {
            tracing::warn!("user name is missing in first user config");
            return;
        };

        if let Err(err) = self.useradd(user_name) {
            tracing::error!("Failed to create first user: {:?}", err);
            return;
        }

        let ssh_keys = user
            .ssh_public_keys
            .as_ref()
            .map(|k| k.to_vec())
            .unwrap_or_default();

        let keys_path = PathBuf::from(format!("home/{}/.ssh/authorized_keys", user_name));
        self.activate_ssh(&keys_path, &ssh_keys, Some(user_name));

        self.set_user_group(user_name);
        if let Some(ref user_password) = user.password {
            if let Err(e) = self.set_user_password(user_name, user_password) {
                tracing::error!("Failed to set user password: {e}");
            }
        };
        if let Err(e) = self.update_user_fullname(user) {
            tracing::error!("Failed to set user fullname: {e}");
        }
    }

    /// Reads root's data from given config and updates root setup accordingly
    fn add_root_user(&self, root: &RootUserConfig) {
        if root.password.is_none() && root.ssh_public_keys.is_none() {
            return;
        };

        // set password for root if any
        if let Some(ref root_password) = root.password {
            if let Err(e) = self.set_user_password("root", root_password) {
                tracing::error!("Failed to set root password: {e}");
            }
        }

        // store sshPublicKeys for root if any
        let ssh_keys = root
            .ssh_public_keys
            .as_ref()
            .map(|k| k.to_vec())
            .unwrap_or_default();

        self.activate_ssh(Path::new("root/.ssh/authorized_keys"), &ssh_keys, None);
    }

    fn activate_ssh(&self, path: &Path, ssh_keys: &[String], user: Option<&str>) {
        if ssh_keys.is_empty() {
            return;
        }

        // if some SSH keys were defined
        // - update authorized_keys file
        // - open SSH port and enable SSH service
        if let Err(e) = self.update_authorized_keys(path, ssh_keys, user) {
            tracing::error!("Failed to update authorized_keys file: {e}");
        }
        if let Err(e) = self.enable_sshd_service() {
            tracing::error!("Failed to enable sshd service: {e}");
        }
        if let Err(e) = self.open_ssh_port() {
            tracing::error!("Failed to open sshd port in firewall: {e}");
        }
    }

    /// Sets password for given user name
    ///
    /// echo "<user_name>:<password>" | chpasswd
    fn set_user_password(
        &self,
        user_name: &str,
        user_password: &UserPassword,
    ) -> Result<(), service::Error> {
        let mut passwd_cmd = ChrootCommand::new(self.install_dir.clone())?.cmd("chpasswd");

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

    /// Add user into the wheel group on best effort basis.
    /// If the group doesn't exist, log the error and continue.
    fn set_user_group(&self, user_name: &str) {
        let chroot = ChrootCommand::new(self.install_dir.clone());
        let Ok(chroot) = chroot else {
            tracing::error!("Failed to chroot: {:?}", chroot);
            return;
        };

        let usermod = chroot
            .cmd("usermod")
            .args(["-a", "-G", "wheel", user_name])
            .output();
        let Ok(usermod) = usermod else {
            tracing::error!("Failed to execute usermod {:?}", usermod);
            return;
        };

        if !usermod.status.success() {
            tracing::warn!(
                "Adding user {} into the \"wheel\" group failed, code={}",
                user_name,
                usermod.status
            );
        }
    }

    /// Changes the owner and group of the target path inside the chroot environment.
    fn chown(&self, user_name: &str, path: &Path) -> Result<(), service::Error> {
        let abs_path = Path::new("/").join(path);
        // unwrap here can be questionable if we want to support
        // non-utf8 paths, but I expect more problems with that idea
        let target_path = abs_path.to_str().unwrap().to_string();

        let chown = ChrootCommand::new(self.install_dir.clone())?
            .cmd("chown")
            .args([format!("{}:", user_name), target_path])
            .output()?;

        if !chown.status.success() {
            tracing::error!("chown failed {:?}", chown.stderr);
            return Err(service::Error::CommandFailed(format!(
                "Cannot set user for {:?}: {:?}",
                path, chown.stderr
            )));
        }

        Ok(())
    }

    /// Updates root's authorized_keys file with SSH key
    fn update_authorized_keys(
        &self,
        keys_path: &Path,
        ssh_keys: &[String],
        user: Option<&str>,
    ) -> Result<(), service::Error> {
        let file_name = self.install_dir.join(keys_path);
        // unwrap is safe here, because we always use absolute paths
        let dir = file_name.parent().unwrap();

        // if .ssh does not exist we need to create it, with proper user and perms
        if !dir.exists() {
            fs::create_dir_all(dir)?;
            fs::set_permissions(dir, Permissions::from_mode(0o700))?;

            if let Some(user_name) = user {
                self.chown(user_name, keys_path.parent().unwrap())?;
            }
        }

        let mode = 0o644;
        let mut authorized_keys_file = OpenOptions::new()
            .create(true)
            .append(true)
            // sets mode only for a new file
            .mode(mode)
            .open(&file_name)?;

        // sets mode also for an existing file
        fs::set_permissions(&file_name, Permissions::from_mode(mode))?;

        for ssh_key in ssh_keys {
            writeln!(authorized_keys_file, "{}", ssh_key.trim())?;
        }

        authorized_keys_file.flush()?;

        if let Some(user_name) = user {
            self.chown(user_name, keys_path)?;
        }

        Ok(())
    }

    /// Enables sshd service in the target system
    fn enable_sshd_service(&self) -> Result<(), service::Error> {
        let systemctl = ChrootCommand::new(self.install_dir.clone())?
            .cmd("systemctl")
            .args(["enable", "sshd.service"])
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
        let firewall_cmd = ChrootCommand::new(self.install_dir.clone())?
            .cmd("firewall-offline-cmd")
            .args(["--add-service=ssh"])
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

        let chfn = ChrootCommand::new(self.install_dir.clone())?
            .cmd("chfn")
            .args(["-f", full_name, user_name])
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
            self.add_first_user(first_user);
        }
        if let Some(root_user) = &config.root {
            self.add_root_user(root_user);
        }

        Ok(())
    }
}
