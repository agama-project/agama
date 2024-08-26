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

use std::{
    io::{self, Read},
    path::PathBuf,
    process::Command,
};

use crate::show_progress;
use agama_lib::{
    connection,
    install_settings::InstallSettings, Store as SettingsStore,
    base_http_client::BaseHTTPClient,
};
use anyhow::anyhow;
use clap::Subcommand;
use std::io::Write;
use tempfile::Builder;

const DEFAULT_EDITOR: &str = "/usr/bin/vi";

#[derive(Subcommand, Debug)]
pub enum ConfigCommands {
    /// Generate an installation profile with the current settings.
    ///
    /// It is possible that many configuration settings do not have a value. Those settings
    /// are not included in the output.
    ///
    /// The output of command can be used as input for the "agama config load".
    Show,

    /// Read and load a profile from the standard input.
    Load,

    /// Edit and update installation option using an external editor.
    ///
    /// The changes are not applied if the editor exits with an error code.
    ///
    /// If an editor is not specified, it honors the EDITOR environment variable. It falls back to
    /// `/usr/bin/vi` as a last resort.
    Edit {
        /// Editor command (including additional arguments if needed)
        #[arg(short, long)]
        editor: Option<String>,
    },
}

pub async fn run(http_client: BaseHTTPClient, subcommand: ConfigCommands) -> anyhow::Result<()> {
    let store = SettingsStore::new(connection().await?, http_client).await?;

    match subcommand {
        ConfigCommands::Show => {
            let model = store.load().await?;
            let json = serde_json::to_string_pretty(&model)?;
            println!("{}", json);
            Ok(())
        }
        ConfigCommands::Load => {
            let mut stdin = io::stdin();
            let mut contents = String::new();
            stdin.read_to_string(&mut contents)?;
            let result: InstallSettings = serde_json::from_str(&contents)?;
            Ok(store.store(&result).await?)
        }
        ConfigCommands::Edit { editor } => {
            let model = store.load().await?;
            let editor = editor
                .or_else(|| std::env::var("EDITOR").ok())
                .unwrap_or(DEFAULT_EDITOR.to_string());
            let result = edit(&model, &editor)?;
            tokio::spawn(async move {
                show_progress().await.unwrap();
            });
            store.store(&result).await?;
            Ok(())
        }
    }
}

/// Edit the installation settings using an external editor.
///
/// If the editor does not return a successful error code, it returns an error.
///
/// * `model`: current installation settings.
/// * `editor`: editor command.
fn edit(model: &InstallSettings, editor: &str) -> anyhow::Result<InstallSettings> {
    let content = serde_json::to_string_pretty(model)?;
    let mut file = Builder::new().suffix(".json").tempfile()?;
    let path = PathBuf::from(file.path());
    write!(file, "{}", content)?;

    let mut command = editor_command(editor);
    let status = command.arg(path.as_os_str()).status()?;
    if status.success() {
        return Ok(InstallSettings::from_file(path)?);
    }

    Err(anyhow!(
        "Ignoring the changes becase the editor was closed with an error code."
    ))
}

/// Return the Command to run the editor.
///
/// Separate the program and the arguments and build a Command struct.
///
/// * `command`: command to run as editor.
fn editor_command(command: &str) -> Command {
    let mut parts = command.split_whitespace();
    let program = parts.next().unwrap_or(DEFAULT_EDITOR);

    let mut command = Command::new(program);
    command.args(parts.collect::<Vec<&str>>());
    command
}
