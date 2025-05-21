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
    io::{self, Write},
    path::PathBuf,
    process::Command,
};

use crate::{cli_input::CliInput, show_progress};
use agama_lib::{
    base_http_client::BaseHTTPClient, context::InstallationContext,
    install_settings::InstallSettings, profile::ValidationOutcome, utils::FileFormat,
    Store as SettingsStore,
};
use anyhow::{anyhow, Context};
use clap::Subcommand;
use console::style;
use fluent_uri::Uri;
use tempfile::Builder;

const DEFAULT_EDITOR: &str = "/usr/bin/vi";

/// Represents the ways user can specify the output for the command line.
#[derive(Clone, Debug)]
pub enum CliOutput {
    Path(PathBuf),
    /// Specified as `-` by the user
    Stdout,
}

impl From<String> for CliOutput {
    fn from(path: String) -> Self {
        if path == "-" {
            Self::Stdout
        } else {
            Self::Path(path.into())
        }
    }
}

impl CliOutput {
    pub fn write(&self, contents: &str) -> anyhow::Result<()> {
        match self {
            Self::Stdout => {
                let mut stdout = io::stdout().lock();
                stdout.write_all(contents.as_bytes())?
            }
            Self::Path(path) => {
                let mut file = std::fs::OpenOptions::new()
                    .create(true)
                    .truncate(true)
                    .write(true)
                    .open(path)
                    .context(format!("Writing to {:?}", path))?;
                file.write_all(contents.as_bytes())?
            }
        }
        Ok(())
    }
}

#[derive(Subcommand, Debug)]
pub enum ConfigCommands {
    /// Generate an installation profile with the current settings.
    ///
    /// It is possible that many configuration settings do not have a value. Those settings
    /// are not included in the output.
    ///
    /// The output of command can be used as input for the "agama config load".
    Show {
        /// Save the output here (goes to stdout if not given)
        #[arg(short, long, value_name = "FILE_PATH")]
        output: Option<CliOutput>,
    },

    /// Read and load a profile
    Load {
        /// JSON file: URL or path or `-` for standard input
        url_or_path: Option<CliInput>,
    },

    /// Validate a profile using JSON Schema
    ///
    /// Schema is available at /usr/share/agama-cli/profile.schema.json
    /// TODO: Validation is automatic
    Validate {
        /// JSON file, URL or path or `-` for standard input
        url_or_path: CliInput,
    },

    /// Generate and print a native Agama JSON configuration from any kind and location.
    ///
    /// Kinds:
    /// - JSON
    /// - Jsonnet, injecting the hardware information
    /// - AutoYaST profile, including ERB and rules/classes
    ///
    /// Locations:
    /// - path
    /// - URL (including AutoYaST specific schemes)
    ///
    /// For an example of Jsonnet-based profile, see
    /// https://github.com/openSUSE/agama/blob/master/rust/agama-lib/share/examples/profile.jsonnet
    #[command(verbatim_doc_comment)]
    Generate {
        /// JSON file: URL or path or `-` for standard input
        url_or_path: Option<CliInput>,
    },

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

// FIXME: `agama profile` no longer exists as a command, but merge its descriptions into `agama config`
pub enum ProfileCommands {
    /// Download the autoyast profile and print resulting json
    Autoyast {
        /// AutoYaST profile's URL. Any AutoYaST scheme, ERB and rules/classes are supported.
        /// all schemas that autoyast supports.
        url: String,
    },

    /// Evaluate a profile, injecting the hardware information from D-Bus
    ///
    /// For an example of Jsonnet-based profile, see
    /// https://github.com/openSUSE/agama/blob/master/rust/agama-lib/share/examples/profile.jsonnet
    Evaluate {
        /// Jsonnet file, URL or path or `-` for standard input
        url_or_path: CliInput,
    },

    /// Process autoinstallation profile and loads it into agama
    ///
    /// This is top level command that do all autoinstallation processing beside starting
    /// installation. Unless there is a need to inject additional commands between processing
    /// use this command instead of set of underlying commands.
    Import {
        /// Profile's URL. Supports the same schemas as the "download" command plus
        /// AutoYaST specific ones. Supported files are json, jsonnet, sh for Agama profiles and ERB, XML, and rules/classes directories
        /// for AutoYaST support.
        url: String,
    },
}

pub async fn run(http_client: BaseHTTPClient, subcommand: ConfigCommands) -> anyhow::Result<()> {
    let store = SettingsStore::new(http_client.clone()).await?;

    match subcommand {
        ConfigCommands::Show { output } => {
            let model = store.load().await?;
            let json = serde_json::to_string_pretty(&model)?;

            let destination = output.unwrap_or(CliOutput::Stdout);
            destination.write(&json)?;
            Ok(())
        }
        ConfigCommands::Load { url_or_path } => {
            let url_or_path = url_or_path.unwrap_or(CliInput::Stdin);
            let contents = url_or_path.read_to_string()?;
            let result = InstallSettings::from_json(&contents, &InstallationContext::from_env()?)?;
            tokio::spawn(async move {
                show_progress().await.unwrap();
            });
            store.store(&result).await?;
            Ok(())
        }
        ConfigCommands::Validate { url_or_path } => validate(&http_client, url_or_path).await,
        ConfigCommands::Generate { url_or_path } => {
            let url_or_path = url_or_path.unwrap_or(CliInput::Stdin);

            generate(&http_client, url_or_path).await
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

/// Validate a JSON profile, by doing a HTTP client request.
async fn validate_client(
    client: &BaseHTTPClient,
    url_or_path: CliInput,
) -> anyhow::Result<ValidationOutcome> {
    let mut url = client.base_url.join("profile/validate").unwrap();
    url_or_path.add_query(&mut url)?;

    let body = url_or_path.body_for_web()?;
    // we use plain text .body instead of .json
    let response: Result<reqwest::Response, agama_lib::error::ServiceError> = client
        .client
        .request(reqwest::Method::POST, url)
        .body(body)
        .send()
        .await
        .map_err(|e| e.into());

    let result = client.deserialize_or_error(response?).await;
    result.map_err(|e| e.into())
}

async fn validate(client: &BaseHTTPClient, url_or_path: CliInput) -> anyhow::Result<()> {
    let validity = validate_client(client, url_or_path).await?;
    match validity {
        ValidationOutcome::Valid => {
            eprintln!("{} {}", style("\u{2713}").bold().green(), validity);
        }
        ValidationOutcome::NotValid(_) => {
            eprintln!("{} {}", style("\u{2717}").bold().red(), validity);
        }
    }
    Ok(())
}

fn is_autoyast(url_or_path: &CliInput) -> bool {
    let path = match url_or_path {
        CliInput::Path(pathbuf) => pathbuf.as_os_str().to_str().unwrap_or_default().to_string(),
        CliInput::Url(url_string) => {
            let url = Uri::parse(url_string.as_str()).unwrap_or_default();
            let path = url.path().to_string();
            path
        }
        _ => {
            return false;
        }
    };

    path.ends_with(".xml") || path.ends_with(".erb") || path.ends_with('/')
}

async fn generate(client: &BaseHTTPClient, url_or_path: CliInput) -> anyhow::Result<()> {
    let profile_json = if is_autoyast(&url_or_path) {
        // AutoYaST specific download and convert to JSON
        let config_string =
            match url_or_path {
                CliInput::Url(url_string) => {
                    let url = Uri::parse(url_string)?;
                    autoyast_client(client, &url).await?
                }
                _ => return Err(anyhow::Error::msg(
                    "FIXME: Path input not implemented yet for this command, use file://ABS_PATH",
                )),
            };
        config_string
    } else {
        from_json_or_jsonnet(&client, url_or_path).await?
    };

    println!("{}", &profile_json);
    validate(client, CliInput::Full(profile_json.clone())).await?;
    Ok(())
}

/// Process AutoYaST profile (*url* ending with .xml, .erb, or dir/) by doing a HTTP client request.
/// Note that this client does not act on this *url*, it passes it as a parameter
/// to our web backend.
/// Return well-formed Agama JSON on success.
async fn autoyast_client(client: &BaseHTTPClient, url: &Uri<String>) -> anyhow::Result<String> {
    // FIXME: how to escape it?
    let api_url = format!("/profile/autoyast?url={}", url);
    let output: Box<serde_json::value::RawValue> = client.post(&api_url, &()).await?;
    let config_string = format!("{}", output);
    Ok(config_string)
}

// Retrieve and preprocess the profile.
//
// The profile can be a JSON or a Jsonnet file.
//
// * If it is a JSON file, no preprocessing is needed.
// * If it is a Jsonnet file, it is converted to JSON.
// * If it is a script, it is an error (formerly a feature, deprecated in favor of in-profile scripts)
async fn from_json_or_jsonnet(
    client: &BaseHTTPClient,
    url_or_path: CliInput,
) -> anyhow::Result<String> {
    let any_profile = url_or_path.read_to_string()?;

    match FileFormat::from_string(&any_profile) {
        FileFormat::Jsonnet => {
            let json_string = evaluate_client(client, CliInput::Full(any_profile)).await?;
            Ok(json_string)
        }
        FileFormat::Json => Ok(any_profile),
        FileFormat::Script => Err(anyhow::Error::msg(
            // TODO: remove execute_script on backend
            "Scripts are no longer supported as full profiles. Use /TODO/.../script",
        )),
        _ => Err(anyhow::Error::msg(
            "Unsupported file format. Expected JSON, or Jsonnet",
        )),
    }
}

/// Evaluate a Jsonnet profile, by doing a HTTP client request.
/// Return well-formed Agama JSON on success.
async fn evaluate_client(client: &BaseHTTPClient, url_or_path: CliInput) -> anyhow::Result<String> {
    let mut url = client.base_url.join("profile/evaluate").unwrap();
    url_or_path.add_query(&mut url)?;

    let body = url_or_path.body_for_web()?;
    // we use plain text .body instead of .json
    let response: Result<reqwest::Response, agama_lib::error::ServiceError> = client
        .client
        .request(reqwest::Method::POST, url)
        .body(body)
        .send()
        .await
        .map_err(|e| e.into());

    let output: Box<serde_json::value::RawValue> = client.deserialize_or_error(response?).await?;
    Ok(output.to_string())
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
        return Ok(InstallSettings::from_file(
            path,
            &InstallationContext::from_env()?,
        )?);
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
