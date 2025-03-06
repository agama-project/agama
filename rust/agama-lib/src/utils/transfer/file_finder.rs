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
    io::Write,
    path::{Path, PathBuf},
    process::Command,
};

use super::{
    file_systems::{FileSystem, FileSystemsList},
    TransferError, TransferResult,
};

/// Finds a file in a set of file systems and copies its content.
#[derive(Default)]
pub struct FileFinder {}

impl FileFinder {
    /// Searchs for a file in the given file systems and copies its content to the given writer.
    ///
    /// * `file_systems`: file systems to search in.
    /// * `file_name`: file name.
    /// * `writer`: where to write the contents.
    pub fn copy_from_file_systems(
        &self,
        file_systems: &FileSystemsList,
        file_name: &str,
        writer: &mut impl Write,
    ) -> TransferResult<()> {
        for fs in file_systems.to_vec().iter() {
            if self.copy_from_file_system(fs, &file_name, writer).is_ok() {
                return Ok(());
            }
        }
        Err(TransferError::FileNotFound(file_name.to_string()))
    }

    /// Copies the file from the file system to the given writer.
    ///
    /// * `file_systems`: file systems to search in.
    /// * `file_name`: file name.
    /// * `writer`: where to write the contents.
    pub fn copy_from_file_system(
        &self,
        file_system: &FileSystem,
        file_name: &str,
        writer: &mut impl Write,
    ) -> TransferResult<()> {
        const DEFAULT_MOUNT_PATH: &str = "/run/agama/mount";
        let default_mount_point = PathBuf::from(DEFAULT_MOUNT_PATH);
        let mount_point = file_system
            .mount_point
            .clone()
            .unwrap_or_else(|| default_mount_point);

        println!("Searching {} in {}", &file_name, &file_system.block_device);

        if !file_system.is_mounted() {
            Self::mount_file_system(&file_system, &mount_point)?;
        }

        let file_name = file_name.strip_prefix("/").unwrap_or(file_name);
        let source = mount_point.join(&file_name);
        let result = Self::copy_file(source, writer);

        if !file_system.is_mounted() {
            Self::umount_file_system(&mount_point)?;
        }

        result
    }

    /// Mounts the file system on a given point.
    ///
    /// TODO: move this logic to the FileSystem struct.
    fn mount_file_system(file_system: &FileSystem, mount_point: &PathBuf) -> TransferResult<()> {
        std::fs::create_dir_all(mount_point)?;
        let output = Command::new("mount")
            .args([file_system.device(), mount_point.display().to_string()])
            .output()?;
        if !output.status.success() {
            return Err(TransferError::FileSystemMount(file_system.device()));
        }
        Ok(())
    }

    /// Reads and write the file content to the given writer.
    fn copy_file<P: AsRef<Path>>(source: P, out_fd: &mut impl Write) -> TransferResult<()> {
        let mut reader = std::fs::File::open(source)?;
        std::io::copy(&mut reader, out_fd)?;
        Ok(())
    }

    /// Umounts file system from the given mount point.
    ///
    /// TODO: move this logic to the FileSystem struct.
    fn umount_file_system(mount_point: &PathBuf) -> TransferResult<()> {
        Command::new("umount")
            .arg(mount_point.display().to_string())
            .output()?;
        Ok(())
    }
}
