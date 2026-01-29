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

/// Module to search for file systems.
use std::{path::PathBuf, process::Command};

use regex::Regex;

use super::{Error, TransferResult};

/// Represents a file system from the underlying system.
///
/// It only includes the elements that are relevant for the transfer API.
#[derive(Clone, Debug, Default)]
pub struct FileSystem {
    pub block_device: String,
    pub fstype: Option<String>,
    pub mount_point: Option<PathBuf>,
    pub transport: Option<String>,
    pub label: Option<String>,
}

impl FileSystem {
    /// Whether the file system was mounted.
    pub fn is_mounted(&self) -> bool {
        self.mount_point.is_some()
    }

    /// Kernel name of the block device containing the file system.
    pub fn device(&self) -> String {
        format!("/dev/{}", &self.block_device)
    }

    /// Mounts the file system and runs the given function.
    ///
    /// It does not try to mount the file system if it is already mounted.
    ///
    /// * `func`: function to run. It receives the mount point.
    ///
    /// TODO: TransferResult and Error should not be visible from this
    /// struct.
    pub fn ensure_mounted<F>(&self, func: F) -> TransferResult<()>
    where
        F: FnOnce(&PathBuf) -> TransferResult<()>,
    {
        const DEFAULT_MOUNT_PATH: &str = "/run/agama/mount";
        let default_mount_point = PathBuf::from(DEFAULT_MOUNT_PATH);
        let mount_point = self.mount_point.clone().unwrap_or(default_mount_point);

        if !self.is_mounted() {
            self.mount(&mount_point)?;
        }
        let result = func(&mount_point);
        if !self.is_mounted() {
            self.umount(&mount_point)?;
        }

        result
    }

    /// Whether the file system can be mounted.
    ///
    /// File systems that cannot be mounted are ignored.
    fn can_be_mounted(&self) -> bool {
        let Some(fstype) = &self.fstype else {
            return false;
        };

        match fstype.as_str() {
            "" | "crypto_LUKS" | "swap" => false,
            _ => true,
        }
    }

    /// Mounts file system from the given mount point.
    fn mount(&self, mount_point: &PathBuf) -> TransferResult<()> {
        std::fs::create_dir_all(mount_point)?;
        let output = Command::new("mount")
            .args([
                "-o",
                "ro",
                &self.device(),
                &mount_point.display().to_string(),
            ])
            .output()?;
        if !output.status.success() {
            return Err(Error::FileSystemMount(self.device()));
        }
        Ok(())
    }

    /// Umounts file system from the given mount point.
    fn umount(&self, mount_point: &PathBuf) -> TransferResult<()> {
        Command::new("umount")
            .arg(mount_point.display().to_string())
            .output()?;
        Ok(())
    }
}

/// Holds a list of file systems.
///
/// It offers a set of convenience method to search within the list.
#[derive(Debug, Default)]
pub struct FileSystemsList {
    file_systems: Vec<FileSystem>,
}

impl FileSystemsList {
    /// Creates a list of file systems.
    pub fn new(file_systems: Vec<FileSystem>) -> Self {
        Self { file_systems }
    }

    /// Creates a list for the file systems in the underlying system.
    pub fn from_system() -> Self {
        let file_systems = FileSystemsReader::read_from_system();
        Self::new(file_systems)
    }

    pub fn to_vec(&self) -> Vec<FileSystem> {
        self.file_systems.clone()
    }

    /// Returns the file system with the given block device name.
    ///
    /// * `name`: block device name.
    pub fn find_by_name(&self, name: &str) -> Option<&FileSystem> {
        self.file_systems.iter().find(|fs| name == &fs.block_device)
    }

    /// Returns the file systems with the given label name.
    ///
    /// * `label`: device label.
    pub fn with_label(&mut self, label: &str) -> Self {
        let label = Some(label.to_string());
        let file_systems = self
            .file_systems
            .iter()
            .filter(|fs| fs.label == label)
            .cloned()
            .collect();

        FileSystemsList { file_systems }
    }

    /// Returns the file systems using the given transport.
    ///
    /// * `transport`: transport of the device (e.g., "usb").
    pub fn with_transport(&mut self, transport: &str) -> Self {
        let transport = Some(transport.to_string());
        let file_systems = self
            .file_systems
            .iter()
            .filter(|fs| fs.transport == transport)
            .cloned()
            .collect();

        FileSystemsList { file_systems }
    }
}

/// Implements the logic to read the file systems from the underlying system.
///
/// This struct relies on lsblk to find the file systems. It is extracted to
/// a separate struct to make testing easier.
struct FileSystemsReader {}

impl FileSystemsReader {
    /// Returns the file systems from the underlying system.
    pub fn read_from_system() -> Vec<FileSystem> {
        let lsblk = Command::new("lsblk")
            .args([
                "--output",
                "KNAME,FSTYPE,MOUNTPOINTS,TRAN,LABEL",
                "--pairs",
                "--path",
            ])
            .output()
            .unwrap();
        let output = String::from_utf8_lossy(&lsblk.stdout);
        Self::read_from_string(&output)
    }

    /// Turns the output of lsblk into a list of file systems.
    pub fn read_from_string(lsblk_string: &str) -> Vec<FileSystem> {
        let mut file_systems = vec![];
        let mut parent_transport: Option<String> = None;
        let re =
            Regex::new(r#"KNAME="(.+)" FSTYPE="(.*)" MOUNTPOINTS="(.*)" TRAN="(.*)" LABEL="(.*)""#)
                .unwrap();

        for (_, [block_device, fstype, mount_points, transport, label]) in
            re.captures_iter(lsblk_string).map(|c| c.extract())
        {
            // Use the shorter path as the canonical mount point.
            let mount_point = if mount_points.is_empty() {
                None
            } else {
                let mut mounts = mount_points.split("\\x0a").collect::<Vec<_>>();
                mounts.sort_by_key(|a| a.len());
                mounts.first().map(PathBuf::from)
            };

            let mut file_system = FileSystem {
                block_device: block_device
                    .strip_prefix("/dev/")
                    .unwrap_or(block_device)
                    .to_string(),
                fstype: if fstype.is_empty() {
                    None
                } else {
                    Some(fstype.to_string())
                },
                mount_point,
                transport: if transport.is_empty() {
                    None
                } else {
                    Some(transport.to_string())
                },
                label: if label.is_empty() {
                    None
                } else {
                    Some(label.to_string())
                },
            };
            if file_system.transport.is_none() {
                file_system.transport = parent_transport.clone();
            } else {
                parent_transport = file_system.transport.clone();
            }
            if file_system.can_be_mounted() {
                file_systems.push(file_system);
            }
        }

        file_systems
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::{FileSystem, FileSystemsList, FileSystemsReader};

    fn build_file_systems() -> Vec<FileSystem> {
        let vda1 = FileSystem {
            block_device: "vda1".to_string(),
            fstype: Some("ext4".to_string()),
            mount_point: Some(PathBuf::from("/")),
            ..Default::default()
        };
        let vdb1 = FileSystem {
            block_device: "vdb1".to_string(),
            fstype: Some("xfs".to_string()),
            mount_point: Some(PathBuf::from("/home")),
            ..Default::default()
        };
        let usb = FileSystem {
            block_device: "sr0".to_string(),
            fstype: Some("vfat".to_string()),
            mount_point: None,
            transport: Some("usb".to_string()),
            label: Some("OEMDRV".to_string()),
            ..Default::default()
        };
        vec![vda1, vdb1, usb]
    }

    #[test]
    fn test_find_file_system_by_name() {
        let file_systems = build_file_systems();
        let list = FileSystemsList::new(file_systems);
        let vdb1 = list.find_by_name("vdb1").unwrap();
        assert_eq!(&vdb1.block_device, "vdb1");
    }

    #[test]
    fn test_find_file_system_by_label() {
        let file_systems = build_file_systems();
        let mut list = FileSystemsList::new(file_systems);
        let found = list.with_label("OEMDRV").to_vec();
        let usb = found.first().unwrap();
        assert_eq!(&usb.block_device, "sr0");
    }

    #[test]
    fn test_find_file_system_by_transport() {
        let file_systems = build_file_systems();
        let mut list = FileSystemsList::new(file_systems);
        let found = list.with_transport("usb").to_vec();
        let usb = found.first().unwrap();
        assert_eq!(&usb.block_device, "sr0");
    }

    #[test]
    fn test_find_all() {
        let file_systems = build_file_systems();
        let finder = FileSystemsList::new(file_systems);
        let all = finder.to_vec();
        assert_eq!(all.len(), 3);
    }

    #[test]
    fn test_parse_file_systems() {
        let lsblk = r#"KNAME="sda" FSTYPE="" MOUNTPOINT="" TRAN="usb" LABEL=""
KNAME="/dev/sda1" FSTYPE="iso9660" MOUNTPOINTS="/run/media/user/agama-installer" TRAN="" LABEL="agama-installer"
KNAME="/dev/sda2" FSTYPE="vfat" MOUNTPOINTS="" TRAN="" LABEL="BOOT"
KNAME="/dev/nvme0n1" FSTYPE="" MOUNTPOINTS="" TRAN="nvme" LABEL=""
KNAME="/dev/nvme0n1p1" FSTYPE="vfat" MOUNTPOINTS="/boot/efi" TRAN="nvme" LABEL=""
KNAME="/dev/nvme0n1p2" FSTYPE="crypto_LUKS" MOUNTPOINT="" TRAN="nvme" LABEL=""
KNAME="/dev/dm-0" FSTYPE="btrfs" MOUNTPOINTS="/home\x0a/\x0a/var" TRAN="" LABEL=""
KNAME="/dev/nvme0n1p3" FSTYPE="crypto_LUKS" MOUNTPOINTS="" TRAN="nvme" LABEL=""
KNAME="/dev/dm-1" FSTYPE="swap" MOUNTPOINTS="[SWAP]" TRAN="" LABEL=""
"#;
        let file_systems = FileSystemsReader::read_from_string(lsblk);
        assert_eq!(file_systems.len(), 4);

        let dm0 = file_systems
            .iter()
            .find(|fs| &fs.block_device == "dm-0")
            .unwrap();
        assert_eq!(dm0.mount_point.as_ref().unwrap(), &PathBuf::from("/"));

        let sda2 = file_systems
            .iter()
            .find(|fs| &fs.block_device == "sda2")
            .unwrap();
        assert_eq!(sda2.mount_point, None);
    }
}
