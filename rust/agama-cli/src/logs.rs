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

use agama_lib::base_http_client::BaseHTTPClient;
use agama_lib::logs::http_client::HTTPClient;
use agama_lib::logs::set_archive_permissions;
use clap::Subcommand;
use std::io;
use std::path::PathBuf;

/// A wrapper around println which shows (or not) the text depending on the boolean variable
fn showln(show: bool, text: &str) {
    if !show {
        return;
    }

    println!("{}", text);
}

// definition of "agama logs" subcommands, see clap crate for details
#[derive(Subcommand, Debug)]
pub enum LogsCommands {
    /// Collect and store the logs in a tar archive.
    Store {
        #[clap(long, short = 'v')]
        /// Verbose output
        verbose: bool,
        #[clap(long, short = 'd')]
        /// Path to destination directory and, optionally, the archive file name. The extension will
        /// be added automatically.
        destination: Option<PathBuf>,
    },
    /// List the logs to collect
    List,
}

/// Main entry point called from agama CLI main loop
pub async fn run(client: BaseHTTPClient, subcommand: LogsCommands) -> anyhow::Result<()> {
    let client = HTTPClient::new(client)?;

    match subcommand {
        LogsCommands::Store {
            verbose,
            destination,
        } => {
            // feed internal options structure by what was received from user
            // for now we always use / add defaults if any
            let destination = parse_destination(destination)?;

            let destination = client
                .store(destination.as_path())
                .await
                .map_err(|_| anyhow::Error::msg("Downloading of logs failed"))?;

            set_archive_permissions(destination.clone())
                .map_err(|_| anyhow::Error::msg("Cannot store the logs"))?;

            showln(verbose, format!("{:?}", destination.clone()).as_str());

            Ok(())
        }
        LogsCommands::List => Ok(()),
    }
}

/// Whatewer passed in destination formed into an absolute path with archive name
///
/// # Arguments:
/// * destination
///     - if None then a default is returned
///     - if a path to a directory then a default file name for the archive will be appended to the
///     path
///     - if path with a file name then it is used as is for resulting archive, just extension will
///     be appended later on (depends on used compression)
fn parse_destination(destination: Option<PathBuf>) -> Result<PathBuf, io::Error> {
    let err = io::Error::new(io::ErrorKind::InvalidInput, "Invalid destination path");
    let mut buffer = destination.unwrap_or(PathBuf::from(DEFAULT_RESULT));
    let path = buffer.as_path();

    // existing directory -> append an archive name
    if path.is_dir() {
        buffer.push("agama-logs");
    // a path with file name
    // sadly, is_some_and is unstable
    } else if path.parent().is_some() {
        // validate if parent directory realy exists
        if !path.parent().unwrap().is_dir() {
            return Err(err);
        }
    }

    // buffer is <directory> or <directory>/<file_name> here
    // and we know that directory tree which leads to the <file_name> is valid.
    // <file_name> creation can still fail later on.
    Ok(buffer)
}

const DEFAULT_RESULT: &str = "/tmp/agama-logs";

/// Handler for the "agama logs list" subcommand
fn list() {
    // TODO: Needs new API too
}
