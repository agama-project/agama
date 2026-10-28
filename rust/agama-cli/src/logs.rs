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

use agama_lib::http::BaseHTTPClient;
use agama_lib::manager::http_client::ManagerHTTPClient;
use agama_utils::make_long;
use clap::{Arg, ArgMatches, Command};
use gettextrs::gettext;
use std::io;
use std::path::PathBuf;

pub fn build_logs_cmd() -> Command {
    // TRANSLATORS: CLI help for: agama logs
    let about = gettext("Collect the installer logs");
    let long_about = make_long(
        &about,
        &gettext(
            // TRANSLATORS: CLI help for: agama logs (details)
            "\
        The installer logs are stored in a compressed archive for further inspection. The file \
        includes system and Agama-specific logs and configuration files. They are crucial to \
        troubleshoot and debug problems.",
        ),
    );
    Command::new("logs")
        .subcommand_required(true)
        .arg_required_else_help(true)
        .about(&about)
        .long_about(long_about)
        .subcommand(
            Command::new("store")
                // TRANSLATORS: CLI help for: agama logs store
                .about(gettext("Collect and store the logs in a tar archive"))
                .arg(
                    Arg::new("destination")
                .value_name("DESTINATION")
                        .short('d')
                        .long("destination")
                        .value_parser(clap::value_parser!(PathBuf))
                        // TRANSLATORS: CLI help for: agama logs store --destination <DESTINATION>
                        .help(gettext("Path to destination directory and, optionally, the archive file name. The extension will \
                                       be added automatically"))
                )
        )
        .subcommand(
            Command::new("list")
                // TRANSLATORS: CLI help for: agama logs list
                .about(gettext("List the logs to collect"))
        )
}

/// Main entry point called from agama CLI main loop
pub async fn run(client: BaseHTTPClient, sub_matches: &ArgMatches) -> anyhow::Result<()> {
    let client = ManagerHTTPClient::new(client);

    match sub_matches.subcommand() {
        Some(("store", matches)) => {
            let destination = matches.get_one::<PathBuf>("destination").cloned();
            let dst_file = parse_destination(destination)?;
            let result = client.store(dst_file.as_path()).await?;

            println!("{}", result.clone().display());

            Ok(())
        }
        Some(("list", _)) => {
            let logs_list = client
                .list()
                .await
                .map_err(|_| anyhow::Error::msg("Cannot get the logs list"))?;

            println!("Log files:");
            for f in logs_list.files.iter() {
                println!("\t{}", f);
            }

            println!("Log commands:");
            for c in logs_list.commands.iter() {
                println!("\t{}", c);
            }

            Ok(())
        }
        _ => Ok(()),
    }
}

/// Whatewer passed in destination formed into an absolute path with archive name
///
/// # Arguments:
/// * destination
///     - if None then a default is returned
///     - if a path to a directory then a default file name for the archive will be appended to the
///       path
///     - if path with a file name then it is used as is for resulting archive, just extension will
///       be appended later on (depends on used compression)
fn parse_destination(destination: Option<PathBuf>) -> Result<PathBuf, io::Error> {
    let err = io::Error::new(io::ErrorKind::InvalidInput, "Invalid destination path");
    let mut buffer = destination.unwrap_or(PathBuf::from(format!(
        "{}-{}",
        DEFAULT_RESULT,
        chrono::prelude::Utc::now().timestamp()
    )));
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
