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
    pub fn get(url: &str, mut out_fd: impl Write) -> TransferResult<()> {
        let mut handle = Easy::new();
        handle.url(url)?;

        let mut transfer = handle.transfer();
        transfer.write_function(|buf| Ok(out_fd.write(buf).unwrap()))?;
        transfer.perform()?;
        Ok(())
    }
}
