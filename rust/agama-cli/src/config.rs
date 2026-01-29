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

use std::{io::Write, path::PathBuf, process::Command, time::Duration};

use agama_lib::{
    context::InstallationContext,
    http::BaseHTTPClient,
    monitor::MonitorClient,
    profile::{ProfileHTTPClient, ProfileValidator, ValidationOutcome},
    utils::FileFormat,
};
use agama_utils::api;
use anyhow::{anyhow, Context};
use clap::Subcommand;
use console::style;
use fluent_uri::Uri;
use serde_json::json;
use tempfile::Builder;
use tokio::time::sleep;

use crate::{
    api_url, build_clients, build_http_client, cli_input::CliInput, cli_output::CliOutput,
    show_progress, GlobalOpts,
};

const DEFAULT_EDITOR: &str = "/usr/bin/vi";

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
    /// Schema is available at /usr/share/agama/schema/profile.schema.json
    /// Note: validation is always done as part of all other "agama config" commands.
    Validate {
        /// JSON file, URL or path or `-` for standard input
        url_or_path: CliInput,

        #[arg(long, default_value = "false")]
        /// Run subcommands (if possible) in local mode - without trying to connect to remote agama server
        local: bool,
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

pub async fn run(subcommand: ConfigCommands, opts: GlobalOpts) -> anyhow::Result<()> {
    let api_url = api_url(opts.clone().host)?;

    match subcommand {
        ConfigCommands::Show { output } => {
            let http_client = build_http_client(api_url, opts.insecure, true).await?;
            let response: api::Config = http_client.get("/v2/config").await?;
            let json = serde_json::to_string_pretty(&response)?;

            let destination = output.unwrap_or(CliOutput::Stdout);
            destination.write(&json)?;

            eprintln!();
            validate(&http_client, CliInput::Full(json.clone()), false).await?;
        }
        ConfigCommands::Load { url_or_path } => {
            let (http_client, monitor) = build_clients(api_url, opts.insecure).await?;
            let url_or_path = url_or_path.unwrap_or(CliInput::Stdin);
            let contents = url_or_path.read_to_string(opts.insecure)?;
            let valid = validate(&http_client, CliInput::Full(contents.clone()), false).await?;

            if !matches!(valid, ValidationOutcome::Valid) {
                return Ok(());
            }

            let model: api::Config = serde_json::from_str(&contents)?;
            patch_config(&http_client, &model).await?;

            monitor_progress(monitor).await?;
        }
        ConfigCommands::Validate { url_or_path, local } => {
            let _ = if !local {
                let http_client = build_http_client(api_url, opts.insecure, true).await?;
                validate(&http_client, url_or_path, false).await
            } else {
                validate_local(url_or_path, opts.insecure)
            };
        }
        ConfigCommands::Generate { url_or_path } => {
            let http_client = build_http_client(api_url, opts.insecure, true).await?;
            let url_or_path = url_or_path.unwrap_or(CliInput::Stdin);

            generate(&http_client, url_or_path, opts.insecure).await?;
        }
        ConfigCommands::Edit { editor } => {
            let (http_client, monitor) = build_clients(api_url, opts.insecure).await?;
            let response: api::Config = http_client.get("/v2/config").await?;
            let editor = editor
                .or_else(|| std::env::var("EDITOR").ok())
                .unwrap_or(DEFAULT_EDITOR.to_string());
            let result = edit(&http_client, &response, &editor).await?;
            patch_config(&http_client, &result).await?;

            monitor_progress(monitor).await?;
        }
    }

    Ok(())
}

async fn patch_config(
    http_client: &BaseHTTPClient,
    model: &api::Config,
) -> Result<(), anyhow::Error> {
    let model_json = json!(model);
    let patch = api::Patch {
        update: Some(model_json),
    };
    http_client.patch_void("/v2/config", &patch).await?;
    Ok(())
}

/// Validates a JSON profile with locally available tools only
fn validate_local(url_or_path: CliInput, insecure: bool) -> anyhow::Result<ValidationOutcome> {
    let profile_string = url_or_path.read_to_string(insecure)?;
    let validator = ProfileValidator::default_schema().context("Setting up profile validator")?;
    let result = validator.validate_str(&profile_string);

    match result {
        Ok(validity) => {
            let _ = validation_msg(&validity);

            Ok(validity)
        }
        Err(err) => {
            eprintln!("{} {}", style("\u{2717}").bold().red(), err);

            Ok(ValidationOutcome::NotValid(
                [String::from("Invalid profile")].to_vec(),
            ))
        }
    }
}

async fn validate(
    client: &BaseHTTPClient,
    url_or_path: CliInput,
    silent: bool,
) -> anyhow::Result<ValidationOutcome> {
    let request = url_or_path.to_map();
    let validity = ProfileHTTPClient::new(client.clone())
        .validate(&request)
        .await?;

    if !silent {
        let _ = validation_msg(&validity);
    }

    Ok(validity)
}

fn validation_msg(validity: &ValidationOutcome) -> anyhow::Result<()> {
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

async fn generate(
    client: &BaseHTTPClient,
    url_or_path: CliInput,
    insecure: bool,
) -> anyhow::Result<()> {
    let _context = match &url_or_path {
        CliInput::Stdin | CliInput::Full(_) => InstallationContext::from_env()?,
        CliInput::Url(url_str) => InstallationContext::from_url_str(url_str)?,
        CliInput::Path(pathbuf) => InstallationContext::from_file(pathbuf.as_path())?,
    };

    // the AutoYaST profile is always downloaded insecurely
    // (https://github.com/yast/yast-installation/blob/960c66658ab317007d2e241aab7b224657970bf9/src/lib/transfer/file_from_url.rb#L188)
    // we can ignore the insecure option value in that case
    let profile_json = if is_autoyast(&url_or_path) {
        // AutoYaST specific download and convert to JSON
        let config_string = match url_or_path {
            CliInput::Url(url_string) => {
                let url = Uri::parse(url_string)?;

                ProfileHTTPClient::new(client.clone())
                    .from_autoyast(&url)
                    .await?
            }
            CliInput::Path(pathbuf) => {
                let canon_path = pathbuf.canonicalize()?;
                let url_string = format!("file://{}", canon_path.display());
                let url = Uri::parse(url_string)?;

                ProfileHTTPClient::new(client.clone())
                    .from_autoyast(&url)
                    .await?
            }
            _ => panic!("is_autoyast returned true on unnamed input"),
        };
        config_string
    } else {
        from_json_or_jsonnet(client, url_or_path, insecure).await?
    };

    let validity = validate(client, CliInput::Full(profile_json.clone()), true).await?;

    if matches!(validity, ValidationOutcome::NotValid(_)) {
        println!("{}", &profile_json);
        let _ = validation_msg(&validity);

        return Ok(());
    }

    // TODO: resolves relative URL references
    let model: api::Config = serde_json::from_str(&profile_json)?;
    let config_json = serde_json::to_string_pretty(&model)?;

    println!("{}", &config_json);
    let validity = validate(client, CliInput::Full(config_json.clone()), false).await?;

    if matches!(validity, ValidationOutcome::NotValid(_)) {
        eprintln!(
            "{} Internal error: the profile was made invalid by InstallSettings round trip",
            style("\u{2717}").bold().red()
        );
    }

    Ok(())
}

/// Retrieve and preprocess the profile.
///
/// The profile can be a JSON or a Jsonnet file.
///
/// * If it is a JSON file, no preprocessing is needed.
/// * If it is a Jsonnet file, it is converted to JSON.
async fn from_json_or_jsonnet(
    client: &BaseHTTPClient,
    url_or_path: CliInput,
    insecure: bool,
) -> anyhow::Result<String> {
    let any_profile = url_or_path.read_to_string(insecure)?;

    match FileFormat::from_string(&any_profile) {
        FileFormat::Jsonnet => {
            let full_profile = CliInput::Full(any_profile);
            let request = full_profile.to_map();
            let json_string = ProfileHTTPClient::new(client.clone())
                .from_jsonnet(&request)
                .await?;

            Ok(json_string)
        }
        FileFormat::Json => Ok(any_profile),
        FileFormat::Unknown => Err(anyhow::Error::msg(
            "Unsupported file format. Expected JSON, or Jsonnet",
        )),
    }
}

/// Edit the installation settings using an external editor.
///
/// If the editor does not return a successful error code, it returns an error.
///
/// * `http_client`: for invoking validation of the edited text
/// * `model`: current installation settings.
/// * `editor`: editor command.
async fn edit(
    http_client: &BaseHTTPClient,
    model: &api::Config,
    editor: &str,
) -> anyhow::Result<api::Config> {
    let content = serde_json::to_string_pretty(model)?;
    let mut file = Builder::new().suffix(".json").tempfile()?;
    let path = PathBuf::from(file.path());
    write!(file, "{}", content)?;

    let mut base_command = editor_command(editor);
    let command = base_command.arg(path.as_os_str());
    let status = command.status().context(format!("Running {:?}", command))?;
    // TODO: do nothing if the content of the file is unchanged
    if status.success() {
        // FIXME: invalid profile still gets loaded
        let contents =
            std::fs::read_to_string(&path).context(format!("Reading from file {:?}", path))?;
        validate(&http_client, CliInput::Full(contents), false).await?;
        return Ok(serde_json::from_str(&content)?);
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

async fn monitor_progress(monitor: MonitorClient) -> anyhow::Result<()> {
    // wait a bit to settle it down and avoid quick actions blinking
    sleep(Duration::from_secs(1)).await;

    let task = tokio::spawn(async move {
        show_progress(monitor, true).await;
    });
    let _ = task.await?;

    Ok(())
}
