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

//! File transfer API for Agama.
//!
//! Implement a file transfer API which, at this point, partially supports Agama specific URLs. Check the
//! YaST document about [URL handling in the
//! installer](https://github.com/yast/yast-installation/blob/master/doc/url.md) for further
//! information.
//!
//! At this point, it only supports those schemes supported by CURL.

use std::{
    io::Write,
    path::{Path, PathBuf},
    process::Command,
};

use curl::easy::Easy;
use thiserror::Error;
use url::Url;

mod file_systems;

use file_systems::{FileSystem, FileSystemsList};

#[derive(Error, Debug)]
pub enum TransferError {
    #[error("Could not retrieve the file: {0}")]
    CurlError(#[from] curl::Error),
    #[error("Could not parse the URL: {0}")]
    ParseError(#[from] url::ParseError),
    #[error("File not found: {0}")]
    FileNotFound(String),
    #[error("IO error: {0}")]
    IO(#[from] std::io::Error),
    #[error("Could not mount the file system {0}")]
    FileSystemMount(String),
    #[error("Missing file path: {0}")]
    MissingPath(Url),
    #[error("Missing device: {0}")]
    MissingDevice(Url),
}
pub type TransferResult<T> = Result<T, TransferError>;

/// File transfer API
pub struct Transfer {}

impl Transfer {
    /// Retrieves and writes the data from an URL
    ///
    /// * `url`: URL to get the data from.
    /// * `out_fd`: where to write the data.
    pub fn get(url: &str, out_fd: &mut impl Write) -> TransferResult<()> {
        let url = Url::parse(url)?;
        match url.scheme() {
            "device" | "label" | "usb" => DeviceHandler::default().get(url, out_fd),
            "cd" | "dvd" | "hd" => HdHandler::default().get(url, out_fd),
            _ => GenericHandler::default().get(url, out_fd),
        }
    }
}

/// Generic handler to retrieve any URL.
///
/// It uses curl under the hood.
#[derive(Default)]
pub struct GenericHandler {}

impl GenericHandler {
    pub fn get(&self, url: Url, out_fd: &mut impl Write) -> TransferResult<()> {
        let mut handle = Easy::new();
        handle.follow_location(true)?;
        handle.fail_on_error(true)?;
        handle.url(&url.to_string())?;

        let mut transfer = handle.transfer();
        transfer.write_function(|buf| Ok(out_fd.write(buf).unwrap()))?;
        transfer.perform()?;
        Ok(())
    }
}

/// Handler for the cd:, dvd: and hd: schemes
///
/// It converts those schemes to a regular DeviceHandler.
#[derive(Default)]
pub struct HdHandler {}

impl HdHandler {
    pub fn get(&self, url: Url, out_fd: &mut impl Write) -> TransferResult<()> {
        let device = url.query_pairs().find(|(key, _value)| key == "devices");

        let Some((_, device_name)) = device else {
            return Err(TransferError::MissingDevice(url));
        };
        let device_name = device_name.strip_prefix("/dev/").unwrap();
        let device_url = format!("device://{}{}", &device_name, url.path());
        let device_url = Url::parse(&device_url)?;

        DeviceHandler::default().get(device_url, out_fd)
    }
}

/// Handler to process AutoYaST-like URLs of type "device" and "usb".
///
/// * If the URL contains a "host", it is used as the device name.
/// * If the URL does not contain a "host", it searches in all
///   known file systems.
#[derive(Default)]
pub struct DeviceHandler {}

impl DeviceHandler {
    pub fn get(&self, url: Url, out_fd: &mut impl Write) -> TransferResult<()> {
        if url.path().is_empty() {
            return Err(TransferError::MissingPath(url));
        }

        let mut file_systems = FileSystemsList::from_system();

        if url.scheme() == "usb" {
            file_systems = file_systems.by_transport("usb");
        }

        let Some(host) = url.host_str() else {
            return self.get_from_any_device(&mut file_systems, url.path(), out_fd);
        };

        if url.scheme() == "label" {
            self.get_by_label(&mut file_systems, host, url.path(), out_fd)
        } else {
            self.get_by_partial_names(
                &mut file_systems,
                &format!("{}{}", host, url.path()),
                out_fd,
            )
        }
    }

    /// Gets a file from the file system using the given label.
    ///
    /// * `file_systems`: list of file systems to search.
    /// * `label`: file system label.
    /// * `out_fd`: file to write to
    fn get_by_label(
        &self,
        file_systems: &mut FileSystemsList,
        label: &str,
        file_name: &str,
        out_fd: &mut impl Write,
    ) -> TransferResult<()> {
        let candidates = file_systems.by_label(label);
        FileFinder::default().copy_from_file_systems(&candidates, &file_name, out_fd)
    }

    /// Gets a file trying to guess the name from the device and the file itself.
    ///
    /// Given a URL like `device://a/b/c/d.json`, it will try:
    ///
    /// * device `a` and file `b/c/d.json`,
    /// * device `a/b` and file `c/d.json`
    /// * and device `a/b/c` and file `d.json`.
    ///
    /// See https://github.com/yast/yast-installation/blob/master/src/lib/transfer/file_from_url.rb#L483
    ///
    /// * `file_systems`: list of file systems to search.
    /// * `full_path`: full path to decompose and search for.
    /// * `out_fd`: file to write to
    fn get_by_partial_names(
        &self,
        file_systems: &mut FileSystemsList,
        full_path: &str,
        out_fd: &mut impl Write,
    ) -> TransferResult<()> {
        let mut path = full_path.to_string();
        let mut dev = "".to_string();
        let finder = FileFinder::default();

        while let Some((device_name, file_name)) = path.split_once('/') {
            dev = format!("{}/{}", dev, device_name)
                .trim_start_matches('/')
                .to_string();
            if let Some(file_system) = file_systems.by_name(&dev) {
                if finder
                    .copy_from_file_system(&file_system, file_name, out_fd)
                    .is_ok()
                {
                    return Ok(());
                }
            }
            path = file_name.to_string();
        }
        Err(TransferError::FileNotFound(full_path.to_string()))
    }

    /// Try to search in all devices.
    ///
    /// * `file_systems`: list of file systems to search.
    /// * `file_name`: full path to decompose and search for.
    /// * `out_fd`: file to write to
    fn get_from_any_device(
        &self,
        file_systems: &mut FileSystemsList,
        file_name: &str,
        out_fd: &mut impl Write,
    ) -> TransferResult<()> {
        FileFinder::default().copy_from_file_systems(&file_systems, &file_name, out_fd)
    }
}

/// Finds a file in a set of file systems and copies its content.
#[derive(Default)]
struct FileFinder {}

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
            .unwrap_or(default_mount_point);

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
    fn umount_file_system(mount_point: &PathBuf) -> TransferResult<()> {
        Command::new("umount")
            .arg(mount_point.display().to_string())
            .output()?;
        Ok(())
    }
}
