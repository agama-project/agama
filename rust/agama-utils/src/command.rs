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

use std::{
    fs::{self, File},
    ops::{Deref, DerefMut},
    os::unix::fs::{symlink, OpenOptionsExt},
    path::{Path, PathBuf},
    process::Output,
    time::Duration,
};

use tokio::{io, process::Command, time::sleep};

const OS_ERROR_BUSY: i32 = 26;
const RETRY_ATTEMPTS: u8 = 5;
const RETRY_INTERVAL: u64 = 50;

/// Runs a command but retrying if a "Text file busy" (error 26) happens.
///
/// When writing and running a script, it might happen that the script is not ready to run.
/// Although we only had seen this behavior in CI, this function offers a way to running a
/// command and retry after a short period of time (50 ms) if that problem occurs. It will
/// do 5 attempts at most.
pub async fn run_with_retry(mut command: Command) -> io::Result<Output> {
    let mut attempt = 0;
    loop {
        // Using the output() function in tokio::process::Command unconditionlly
        // configures stdout/stderr to be pipes. That's why we use spawn() +
        // wait_with_output().
        match command.spawn() {
            Ok(child) => return child.wait_with_output().await,
            Err(error) => {
                if let Some(code) = error.raw_os_error() {
                    if code == OS_ERROR_BUSY && attempt < RETRY_ATTEMPTS {
                        attempt += 1;
                        tracing::info!(
                            "Command failed with OS error {OS_ERROR_BUSY} (attempt {attempt}). Retrying."
                        );
                        sleep(Duration::from_millis(RETRY_INTERVAL)).await;
                        continue;
                    } else {
                        return Err(error);
                    }
                } else {
                    return Err(error);
                }
            }
        }
    }
}

#[derive(thiserror::Error, Debug)]
pub enum ChrootError {
    #[error("Target directory for chroot does not exists: {0}")]
    DirectoreNotExist(String),
}

/// A wrapper for common std::process::Command for use in chroot
///
/// It basically creates Command for chroot and command to be run
/// in chrooted environment is passed as an argument.
///
/// Example use:
/// ```
/// # use agama_utils::command::ChrootCommand;
/// # use agama_utils::command::ChrootError;
/// # fn main() -> Result<(), ChrootError> {
/// let cmd = ChrootCommand::new("/tmp")?
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
    pub fn new<P: AsRef<Path>>(chroot: P) -> Result<Self, ChrootError> {
        if !chroot.as_ref().is_dir() {
            return Err(ChrootError::DirectoreNotExist(
                chroot.as_ref().display().to_string(),
            ));
        }

        let mut cmd = Command::new("chroot");

        cmd.arg(chroot.as_ref());

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

/// Convenience function to create a file to be used as to save command artifacts
/// (stdout, stderr or exit code).
pub fn create_log_file(path: &Path) -> io::Result<File> {
    let file = fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .mode(0o600)
        .open(path)?;
    Ok(file)
}

#[derive(thiserror::Error, Debug)]
pub enum ServiceError {
    #[error("Failed to enable service - systemctl error: {0}")]
    SystemctlFailed(String),
    #[error("Failed to enable service - chroot error: {0}")]
    ChrootFailed(#[from] ChrootError),
    #[error("Failed to enable service - io error: {0}")]
    IOError(#[from] std::io::Error),
}

/// Convenience function to enable a service and return result of operation
pub async fn try_enable_service<P: AsRef<Path>>(
    root_dir: P,
    name: &str,
) -> Result<(), ServiceError> {
    let mut command = ChrootCommand::new(root_dir)?;
    command.args(["systemctl", "enable", name]);

    let output = command.output().await?;

    if output.status.success() {
        tracing::info!("Enabled the {name} service");
        Ok(())
    } else {
        Err(ServiceError::SystemctlFailed(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ))
    }
}

/// Convenience function to enable a service and only logs error if it failed
pub async fn enable_service<P: AsRef<Path>>(root_dir: P, name: &str) {
    if let Err(error) = try_enable_service(root_dir, name).await {
        tracing::error!("Failed to enable the {name} service: {error}");
    }
}

#[derive(thiserror::Error, Debug)]
pub enum FirewallError {
    #[error("Failed to open firewall port - firewall-offline-cmd error: {0}")]
    FirewallCmdFailed(String),
    #[error("Failed to open firewall port - chroot error: {0}")]
    ChrootFailed(#[from] ChrootError),
    #[error("Failed to open firewall port - io error: {0}")]
    IOError(#[from] std::io::Error),
}

pub async fn open_firewall<P: AsRef<Path>>(
    install_dir: P,
    name: &str,
) -> Result<(), FirewallError> {
    let firewall_cmd = ChrootCommand::new(&install_dir)?
        .cmd("firewall-offline-cmd")
        .args([format!("--add-service={}", name)])
        .output()
        .await?;

    // ignore error if the firewall is not installed, in that case we do need to open the port,
    // chroot returns exit status 127 if the command is not found
    if firewall_cmd.status.code() == Some(127) {
        tracing::warn!("Command firewall-offline-cmd not found, firewall not installed?");
        return Ok(());
    }

    if !firewall_cmd.status.success() {
        return Err(FirewallError::FirewallCmdFailed(
            firewall_cmd.stderr.try_into().unwrap_or_default(),
        ));
    }

    Ok(())
}

/// Relative path to the resolv.conf file in target.
pub const RESOLV_CONF_PATH: &str = "etc/resolv.conf";
/// Relative path to the NetworkManager resolv.conf file in host.
pub const NM_RESOLV_CONF_PATH: &str = "run/NetworkManager/resolv.conf";

/// Helper to link and unlink resolv.conf for chroot environments.
#[derive(Debug)]
pub struct ResolvConfLink {
    link_path: PathBuf,
    is_linked: bool,
}

impl ResolvConfLink {
    /// Makes sure that the resolv.conf is linked into the chroot target.
    ///
    /// * `root_dir`: root directory of the host system.
    /// * `install_dir`: target directory where the chrooted system is installed.
    pub fn new<P: AsRef<Path>, Q: AsRef<Path>>(root_dir: P, install_dir: Q) -> io::Result<Self> {
        let original = root_dir.as_ref().join(NM_RESOLV_CONF_PATH);
        let link = install_dir.as_ref().join(RESOLV_CONF_PATH);

        if link.exists() || !original.exists() {
            return Ok(Self {
                link_path: link,
                is_linked: false,
            });
        }

        if let Some(parent) = link.parent() {
            fs::create_dir_all(parent)?;
        }

        symlink(original.as_path(), link.as_path())?;
        Ok(Self {
            link_path: link,
            is_linked: true,
        })
    }

    /// Returns whether the resolv.conf link was created by this helper.
    pub fn is_linked(&self) -> bool {
        self.is_linked
    }

    /// Removes the resolv.conf link from the chroot if it was created by this helper.
    pub fn unlink(&mut self) {
        if self.is_linked {
            if let Err(error) = fs::remove_file(&self.link_path) {
                tracing::warn!("Could not remove the resolv.conf link: {error}");
            }
            self.is_linked = false;
        }
    }
}

impl Drop for ResolvConfLink {
    fn drop(&mut self) {
        self.unlink();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    #[test]
    fn test_resolv_conf_link_lifecycle() {
        let host_temp = TempDir::new().unwrap();
        let target_temp = TempDir::new().unwrap();

        let nm_dir = host_temp.path().join("run/NetworkManager");
        fs::create_dir_all(&nm_dir).unwrap();
        let nm_resolv = nm_dir.join("resolv.conf");
        let mut f = File::create(&nm_resolv).unwrap();
        writeln!(f, "nameserver 1.1.1.1").unwrap();

        let target_etc = target_temp.path().join("etc");
        fs::create_dir_all(&target_etc).unwrap();

        {
            let link = ResolvConfLink::new(host_temp.path(), target_temp.path()).unwrap();
            assert!(link.is_linked());
            let target_resolv = target_etc.join("resolv.conf");
            assert!(target_resolv.is_symlink());
            assert!(target_resolv.exists());
            let content = fs::read_to_string(&target_resolv).unwrap();
            assert!(content.contains("nameserver 1.1.1.1"));
        }

        // Dropping the guard should automatically remove the link
        let target_resolv = target_etc.join("resolv.conf");
        assert!(!target_resolv.exists());
    }
}
