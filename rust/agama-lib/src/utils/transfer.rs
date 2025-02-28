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

//! File transfer API for Agama.
//!
//! Implement a file transfer API which, in the future, will support Agama specific URLs. Check the
//! YaST document about [URL handling in the
//! installer](https://github.com/yast/yast-installation/blob/master/doc/url.md) for further
//! information.
//!
//! At this point, it only supports those schemes supported by CURL.

use std::io::Write;

use curl::easy::Easy;
use thiserror::Error;

#[derive(Error, Debug)]
#[error(transparent)]
pub struct TransferError(#[from] curl::Error);
pub type TransferResult<T> = Result<T, TransferError>;

/// File transfer API
pub struct Transfer {}

impl Transfer {
    /// Retrieves and writes the data from an URL
    ///
    /// * `url`: URL to get the data from.
    /// * `out_fd`: where to write the data.
    pub fn get(url: &str, out_fd: impl Write) -> TransferResult<()> {
        GenericHandler::get(url, out_fd)
    }
}

/// Generic handler to retrieve any URL.
///
/// It uses curl under the hood.
pub struct GenericHandler {}

impl GenericHandler {
    pub fn get(url: &str, mut out_fd: impl Write) -> TransferResult<()> {
        let mut handle = Easy::new();
        handle.follow_location(true)?;
        handle.fail_on_error(true)?;
        handle.url(url)?;

        let mut transfer = handle.transfer();
        transfer.write_function(|buf| Ok(out_fd.write(buf).unwrap()))?;
        transfer.perform()?;
        Ok(())
    }
}
