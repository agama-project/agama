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
    os::unix::fs::OpenOptionsExt,
    path::Path,
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
