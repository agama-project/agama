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

use std::{io::Write, path::PathBuf, process, time::Duration};

use agama_lib::{
    http::{BaseHTTPClient, WebSocketClient},
    profile::{ProfileHTTPClient, ProfileValidator, ValidationOutcome},
    utils::FileFormat,
};
use agama_utils::api::{self, ProblemDetails};
use agama_utils::make_long;
use anyhow::{anyhow, Context};
use clap::{Arg, ArgAction, ArgMatches, Command};
use fluent_uri::Uri;
use gettextrs::gettext;
use tempfile::Builder;
use tokio::time::sleep;

use crate::{
    api_url, build_clients, build_http_client, cli_input::CliInput, cli_output::CliOutput,
    context::InstallationContext, show_progress, GlobalOpts,
};

const DEFAULT_EDITOR: &str = "/usr/bin/vi";

pub fn build_config_cmd() -> Command {
    // TRANSLATORS: CLI help for: agama config
    let about = gettext("Inspect or change the installation settings");
    // TRANSLATORS: CLI help for: agama config (details)
    let long_about = make_long(&about, &gettext("\
        You can inspect and change installation settings from the command-line. The \"show\" \
        subcommand generates a \"profile\" which is a JSON document describing the current \
        configuration.\n\
        \n\
        If you want to change any configuration value, you can load a profile (complete or partial) \
        using the \"load\" subcommand."));
    Command::new("config")
        .subcommand_required(true)
        .arg_required_else_help(true)
        .about(&about)
        .long_about(long_about)
        .subcommand(build_config_show_cmd())
        .subcommand(
            Command::new("load")
                // TRANSLATORS: CLI help for: agama config load
                .about(gettext("Read and load a profile"))
                .arg(
                    Arg::new("url_or_path")
                        .value_name("URL_OR_PATH")
                        .value_parser(clap::value_parser!(CliInput))
                        // TRANSLATORS: CLI help for: agama config load <URL_OR_PATH>
                        .help(gettext("JSON file: URL or path or `-` for standard input")),
                ),
        )
        .subcommand(build_config_validate_cmd())
        .subcommand(build_config_generate_cmd())
        .subcommand(build_config_edit_cmd())
}

fn build_config_show_cmd() -> Command {
    // TRANSLATORS: CLI help for: agama config show
    let about = gettext("Generate an installation profile with the current settings");
    let long_about = make_long(
        &about,
        &gettext(
            // TRANSLATORS: CLI help for: agama config show (details)
            "\
        It is possible that many configuration settings do not have a value. Those settings \
        are not included in the output.\n\
        \n\
        The output of command can be used as input for the \"agama config load\".",
        ),
    );
    Command::new("show")
        .about(&about)
        .long_about(long_about)
        .arg(
            Arg::new("output")
                .short('o')
                .long("output")
                .value_name("FILE_PATH")
                .value_parser(clap::value_parser!(CliOutput))
                .help(gettext(
                    // TRANSLATORS: CLI help for: agama config show --output <FILE_PATH>
                    "Save the output here (goes to stdout if not given)",
                )),
        )
}

fn build_config_validate_cmd() -> Command {
    // TRANSLATORS: CLI help for: agama config validate
    let about = gettext("Validate a profile using JSON Schema");
    let long_about = make_long(
        &about,
        &gettext(
            // TRANSLATORS: CLI help for: agama config validate (details)
            "\
        Schema is available at /usr/share/agama/schema/profile.schema.json \
        Note: validation is always done as part of all other \"agama config\" commands.",
        ),
    );
    Command::new("validate")
        .about(&about)
        .long_about(long_about)
        .arg(
            Arg::new("url_or_path")
                .value_name("URL_OR_PATH")
                .required(true)
                .value_parser(clap::value_parser!(CliInput))
                // TRANSLATORS: CLI help for: agama config validate <URL_OR_PATH>
                .help(gettext("JSON file, URL or path or `-` for standard input"))
        )
        .arg(
            Arg::new("local")
                .long("local")
                .action(ArgAction::SetTrue)
                .default_value("false")
                // TRANSLATORS: CLI help for: agama config validate --local
                .help(gettext("Run subcommands (if possible) in local mode - without trying to connect to remote agama server"))
        )
}

fn build_config_generate_cmd() -> Command {
    let about =
        // TRANSLATORS: CLI help for: agama config generate
        gettext("Generate and print a native Agama JSON configuration from any kind and location");
    // TRANSLATORS: CLI help for: agama config generate (details)
    let long_about = make_long(&about, &gettext("\
        Kinds:\n\
        - JSON\n\
        - Jsonnet, injecting the hardware information\n\
        - AutoYaST profile, including ERB and rules/classes\n\
        \n\
        Locations:\n\
        - path\n\
        - URL (including AutoYaST specific schemes)\n\
        \n\
        For an example of Jsonnet-based profile, see\n\
        https://github.com/openSUSE/agama/blob/master/rust/agama-lib/share/examples/profile.jsonnet"));
    Command::new("generate")
        .about(&about)
        .long_about(long_about)
        .arg(
            Arg::new("url_or_path")
                .value_name("URL_OR_PATH")
                .value_parser(clap::value_parser!(CliInput))
                // TRANSLATORS: CLI help for: agama config generate <URL_OR_PATH>
                .help(gettext("JSON file: URL or path or `-` for standard input")),
        )
}

fn build_config_edit_cmd() -> Command {
    // TRANSLATORS: CLI help for: agama config edit
    let about = gettext("Edit and update installation option using an external editor");
    let long_about = make_long(
        &about,
        &gettext(
            // TRANSLATORS: CLI help for: agama config edit (details)
            "\
        The changes are not applied if the editor exits with an error code.\n\
        \n\
        If an editor is not specified, it honors the EDITOR environment variable. It falls back to \
        `/usr/bin/vi` as a last resort.",
        ),
    );
    Command::new("edit")
        .about(&about)
        .long_about(long_about)
        .arg(
            Arg::new("editor")
                .value_name("EDITOR")
                .short('e')
                .long("editor")
                .help(gettext(
                    // TRANSLATORS: CLI help for: agama config edit --editor <EDITOR>
                    "Editor command (including additional arguments if needed)",
                )),
        )
}

pub async fn run(sub_matches: &ArgMatches, opts: GlobalOpts) -> anyhow::Result<()> {
    let api_url = api_url(opts.clone().host)?;

    match sub_matches.subcommand() {
        Some(("show", matches)) => {
            let output = matches.get_one::<CliOutput>("output").cloned();
            let http_client = build_http_client(api_url, opts.insecure, true).await?;
            let response: api::Config = http_client.get("/config").await?;
            let json = serde_json::to_string_pretty(&response)?;
            let destination = output.unwrap_or(CliOutput::Stdout);
            destination.write(&json)?;
        }
        Some(("load", matches)) => {
            let url_or_path = matches.get_one::<CliInput>("url_or_path").cloned();
            let (http_client, ws) = build_clients(api_url, opts.insecure).await?;
            let url_or_path = url_or_path.unwrap_or(CliInput::Stdin);
            let contents = url_or_path.read_to_string(opts.insecure)?;
            let Ok(config) = serde_json::from_str(&contents) else {
                return Err(anyhow!(gettext("It is not a valid JSON file")));
            };
            patch_config(&http_client, config).await?;
            monitor_progress(http_client, ws).await?;
        }
        Some(("validate", matches)) => {
            let url_or_path = matches.get_one::<CliInput>("url_or_path").unwrap().clone();
            let local = matches.get_flag("local");
            if !local {
                let http_client = build_http_client(api_url, opts.insecure, true).await?;
                validate(&http_client, url_or_path).await?;
            } else {
                validate_local(url_or_path, opts.insecure)?;
            };
        }
        Some(("generate", matches)) => {
            let url_or_path = matches.get_one::<CliInput>("url_or_path").cloned();
            let http_client = build_http_client(api_url, opts.insecure, true).await?;
            let url_or_path = url_or_path.unwrap_or(CliInput::Stdin);

            generate(&http_client, url_or_path, opts.insecure).await?;
        }
        Some(("edit", matches)) => {
            let editor = matches.get_one::<String>("editor").cloned();
            let (http_client, ws) = build_clients(api_url, opts.insecure).await?;
            let response: api::Config = http_client.get("/config").await?;
            let editor = editor
                .or_else(|| std::env::var("EDITOR").ok())
                .unwrap_or(DEFAULT_EDITOR.to_string());
            let result = edit(&http_client, &response, &editor).await?;
            patch_config(&http_client, result).await?;
            monitor_progress(http_client, ws).await?;
        }
        _ => {}
    }

    Ok(())
}

async fn patch_config(
    http_client: &BaseHTTPClient,
    model: serde_json::Value,
) -> Result<(), anyhow::Error> {
    let patch = api::Patch::with_update(model);
    http_client.patch_void("/config", &patch).await?;
    Ok(())
}

/// Validates a JSON profile with locally available tools only
fn validate_local(url_or_path: CliInput, insecure: bool) -> anyhow::Result<()> {
    let profile_string = url_or_path.read_to_string(insecure)?;
    let validator = ProfileValidator::default_schema().context("Setting up profile validator")?;
    let result = validator.validate_str(&profile_string)?;

    match result {
        ValidationOutcome::NotValid(messages) => {
            let problems = ProblemDetails::schema_validation_failed(messages);
            Err(anyhow!(problems))
        }
        ValidationOutcome::Valid => Ok(()),
    }
}

async fn validate(client: &BaseHTTPClient, url_or_path: CliInput) -> anyhow::Result<()> {
    let request = url_or_path.to_map();
    ProfileHTTPClient::new(client.clone())
        .validate(&request)
        .await?;
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
    let context = match &url_or_path {
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
                let url = Uri::parse(url_string).map_err(|(e, _)| e)?;

                ProfileHTTPClient::new(client.clone())
                    .from_autoyast(&url)
                    .await?
            }
            CliInput::Path(pathbuf) => {
                let canon_path = pathbuf.canonicalize()?;
                let url_string = format!("file://{}", canon_path.display());
                let url = Uri::parse(url_string).map_err(|(e, _)| e)?;

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

    let config = api::Config::from_json(&profile_json, &context.source)?;
    let config_json = serde_json::to_string_pretty(&config)?;

    validate(client, CliInput::Full(config_json.clone())).await?;
    println!("{}", &config_json);

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
            let full_profile = CliInput::Full(any_profile.to_string());
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
) -> anyhow::Result<serde_json::Value> {
    let original = serde_json::to_string_pretty(model)?;
    let mut file = Builder::new().suffix(".json").tempfile()?;
    let path = PathBuf::from(file.path());
    write!(file, "{}", original)?;

    let mut base_command = editor_command(editor);
    let command = base_command.arg(path.as_os_str());
    let status = command.status().context(format!("Running {:?}", command))?;
    // TODO: do nothing if the content of the file is unchanged
    if status.success() {
        let updated =
            std::fs::read_to_string(&path).context(format!("Reading from file {:?}", path))?;
        validate(http_client, CliInput::Full(updated.clone())).await?;
        return Ok(serde_json::from_str(&updated)?);
    }

    Err(anyhow!(gettext(
        "Ignoring the changes because the editor was closed with an error code."
    )))
}

/// Return the Command to run the editor.
///
/// Separate the program and the arguments and build a Command struct.
///
/// * `command`: command to run as editor.
fn editor_command(command: &str) -> process::Command {
    let mut parts = command.split_whitespace();
    let program = parts.next().unwrap_or(DEFAULT_EDITOR);

    let mut command = process::Command::new(program);
    command.args(parts.collect::<Vec<&str>>());
    command
}

async fn monitor_progress(http: BaseHTTPClient, ws: WebSocketClient) -> anyhow::Result<()> {
    // wait a bit to settle it down and avoid quick actions blinking
    sleep(Duration::from_secs(1)).await;

    show_progress(http, ws, true).await?;

    Ok(())
}
