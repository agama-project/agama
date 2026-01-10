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
//! This API supports the following URLs from YaST: `device:`, `usb:`, `label:`, ! `hd:`, `dvd:` and
//! `cd:`. The support for well-known URLs (e.g., `file:`, `http:`, `https:`, ! `ftp:`, `nfs:`,
//!  etc.) is implemented using CURL.
//!
//! ## SSL
//!
//! YaST support for HTTPS used a custom certificate which was located in
//! `/etc/sssl/clientcerts/client-cert.pem`. Agama does not use such a certificate and it only
//! relies on those that are installed in the installation media.
//!
//! ## Examples
//! Requires working localectl.
//!
//! ```no_run
//! use agama_transfer::Transfer;
//! Transfer::get("label://OEMDRV/autoinst.xml", &mut std::io::stdout(), false).unwrap();
//! ````

use std::io::Write;

use url::Url;

mod file_finder;
mod file_systems;
mod handlers;

use handlers::{DeviceHandler, GenericHandler, HdHandler, LabelHandler};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Could not retrieve the file")]
    CurlError(#[from] curl::Error),
    #[error("Could not retrieve {0}")]
    CurlTransferError(String, #[source] curl::Error),
    #[error("Could not parse the URL")]
    ParseError(#[from] url::ParseError),
    #[error("File not found {0}")]
    FileNotFound(String),
    #[error("IO error: {0}")]
    IO(#[from] std::io::Error),
    #[error("Could not mount the file system {0}")]
    FileSystemMount(String),
    #[error("Missing file path {0}")]
    MissingPath(Url),
    #[error("Missing device {0}")]
    MissingDevice(Url),
    #[error("Missing file system label {0}")]
    MissingLabel(Url),
}
pub type TransferResult<T> = Result<T, Error>;

/// File transfer API
pub struct Transfer {}

impl Transfer {
    /// Retrieves and writes the data from an URL
    ///
    /// * `url`: URL to get the data from.
    /// * `out_fd`: where to write the data.
    /// * `insecure`: ignore SSL problems in HTTPS downloads.
    pub fn get(url: &str, out_fd: &mut impl Write, insecure: bool) -> TransferResult<()> {
        let url = Url::parse(url)?;
        match url.scheme() {
            "device" | "usb" => DeviceHandler::default().get(url, out_fd),
            "label" => LabelHandler::default().get(url, out_fd),
            "cd" | "dvd" | "hd" => HdHandler::default().get(url, out_fd),
            _ => GenericHandler::default().get(url, out_fd, insecure),
        }
    }
}
