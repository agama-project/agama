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

use curl::easy::Easy;
use url::Url;

use crate::{Error, TransferResult};

/// Generic handler to retrieve any URL.
///
/// It uses curl under the hood.
#[derive(Default)]
pub struct GenericHandler {}

impl GenericHandler {
    pub fn get(&self, url: Url, out_fd: &mut impl Write, insecure: bool) -> TransferResult<()> {
        let mut handle = Easy::new();
        handle.follow_location(true)?;
        handle.fail_on_error(true)?;
        handle.url(url.as_ref())?;

        if insecure {
            // allow self-signed certificate, ignore verification failures
            handle.ssl_verify_peer(false)?;
            // allow not matching hostname
            handle.ssl_verify_host(false)?;
        }

        let mut transfer = handle.transfer();
        transfer.write_function(|buf| Ok(out_fd.write(buf).unwrap()))?;
        transfer
            .perform()
            .map_err(|e| Error::CurlTransferError(url.to_string(), e))?;
        Ok(())
    }
}
