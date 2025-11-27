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

use std::io::Write;

use url::Url;

use crate::{file_finder::FileFinder, file_systems::FileSystemsList, Error, TransferResult};

/// Handler for the cd:, dvd: and hd: schemes
///
/// It converts those schemes to a regular DeviceHandler.
#[derive(Default)]
pub struct HdHandler {}

impl HdHandler {
    pub fn get(&self, url: Url, out_fd: &mut impl Write) -> TransferResult<()> {
        let device = url.query_pairs().find(|(key, _value)| key == "devices");

        let Some((_, device_name)) = device else {
            return Err(Error::MissingDevice(url));
        };
        let device_name = device_name.strip_prefix("/dev/").unwrap_or(&device_name);
        let device_url = format!("device://{}{}", &device_name, url.path());
        let device_url = Url::parse(&device_url)?;

        DeviceHandler::default().get(device_url, out_fd)
    }
}

/// Handler for the label: scheme
#[derive(Default)]
pub struct LabelHandler {}

impl LabelHandler {
    pub fn get(&self, url: Url, out_fd: &mut impl Write) -> TransferResult<()> {
        let file_name = url.path();
        if file_name.is_empty() {
            return Err(Error::MissingPath(url));
        }

        let Some(label) = url.host_str() else {
            return Err(Error::MissingLabel(url));
        };

        let file_systems = FileSystemsList::from_system().with_label(label);
        FileFinder::default().copy_from_file_systems(&file_systems, file_name, out_fd)
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
            return Err(Error::MissingPath(url));
        }

        let mut file_systems = FileSystemsList::from_system();

        if url.scheme() == "usb" {
            file_systems = file_systems.with_transport("usb");
        }

        if let Some(host) = url.host_str() {
            self.get_by_partial_names(
                &mut file_systems,
                &format!("{}{}", host, url.path()),
                out_fd,
            )
        } else {
            self.get_from_any_device(&mut file_systems, url.path(), out_fd)
        }
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
            if let Some(file_system) = file_systems.find_by_name(&dev) {
                if finder
                    .copy_from_file_system(file_system, file_name, out_fd)
                    .is_ok()
                {
                    return Ok(());
                }
            }
            path = file_name.to_string();
        }
        Err(Error::FileNotFound(full_path.to_string()))
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
        FileFinder::default().copy_from_file_systems(file_systems, file_name, out_fd)
    }
}
