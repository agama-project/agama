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

use crate::show_progress;
use agama_lib::{
    base_http_client::BaseHTTPClient, install_settings::InstallSettings,
    profile::ValidationOutcome, utils::FileFormat, utils::Transfer, Store as SettingsStore,
};
use anyhow::Context;
use clap::Subcommand;
use console::style;
use std::{
    io,
    io::Read,
    path::{Path, PathBuf},
};
use url::Url;

#[derive(Subcommand, Debug)]
pub enum ProfileCommands {
    /// Download the autoyast profile and print resulting json
    Autoyast {
        /// AutoYaST profile's URL. Any AutoYaST scheme, ERB and rules/classes are supported.
        /// all schemas that autoyast supports.
        url: String,
    },

    /// Validate a profile using JSON Schema
    ///
    /// Schema is available at /usr/share/agama-cli/profile.schema.json
    Validate {
        /// JSON file, URL or path or `-` for standard input
        url_or_path: CliInput,
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

// Represents the ways user can specify the input on the command line
// and passes appropriate representations to the web API
#[derive(Clone, Debug)]
pub enum CliInput {
    // TODO: Url(Url) would be nice here
    // but telling clap to deal with parse errors is harder than expected
    Url(String),
    Path(PathBuf),
    Stdin,
    /// The full text as String.
    // Not parsed from CLI but used when implementing import.
    Full(String),
}

impl From<String> for CliInput {
    fn from(url_or_path: String) -> Self {
        if url_or_path == "-" {
            Self::Stdin
        } else {
            // unwrap OK: known good regex will compile
            let url_like = regex::Regex::new("^[A-Za-z]+:").unwrap();
            if url_like.is_match(&url_or_path) {
                Self::Url(url_or_path)
            } else {
                Self::Path(url_or_path.into())
            }
        }
    }
}

impl CliInput {
    /// If *self* has a path or url value, append a `path=...` or `url=...`
    /// query parameter to *url*, properly escaped. The path is made absolute
    /// so that it works (on localhost) even if server's working directory is different.
    /// See also: `body_for_web`
    fn add_query(&self, base_url: &mut Url) -> io::Result<()> {
        match self {
            Self::Url(url) => {
                base_url.query_pairs_mut().append_pair("url", url);
            }
            Self::Path(path) => {
                let pathbuf = Self::absolute(Path::new(path))?;
                let pathstr = pathbuf.to_str().ok_or(std::io::Error::new(
                    io::ErrorKind::Other,
                    "Stringifying current directory",
                ))?;
                base_url.query_pairs_mut().append_pair("path", pathstr);
            }
            Self::Stdin => (),
            Self::Full(_) => (),
        };
        Ok(())
    }

    fn absolute(path: &Path) -> std::io::Result<PathBuf> {
        // we avoid Path.canonicalize because it would resolve away symlinks
        // that we need for testing
        if path.is_absolute() {
            Ok(path.to_path_buf())
        } else {
            let current_dir = std::env::current_dir()?;
            Ok(current_dir.join(path))
        }
    }

    /// If *self* is stdin or the full text, provide it as String.
    /// See also: `add_query`
    ///
    /// NOTE that this will consume the standard input
    /// if self is `Stdin`
    fn body_for_web(self) -> std::io::Result<String> {
        match self {
            Self::Stdin => {
                let mut slurp = String::new();
                let stdin = std::io::stdin();
                {
                    let mut handle = stdin.lock();
                    handle.read_to_string(&mut slurp)?;
                }
                Ok(slurp)
            }
            Self::Full(s) => Ok(s),
            _ => Ok("".to_owned()),
        }
    }
}

/// Validate a JSON profile, by doing a HTTP client request.
async fn validate_client(
    client: &BaseHTTPClient,
    url_or_path: CliInput,
) -> anyhow::Result<ValidationOutcome> {
    let mut url = Url::parse(&client.base_url)?;
    // unwrap OK: only fails for cannot_be_a_base URLs like data: and mailto:
    url.path_segments_mut()
        .unwrap()
        .push("profile")
        .push("validate");
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
            println!("{} {}", style("\u{2713}").bold().green(), validity);
        }
        ValidationOutcome::NotValid(_) => {
            println!("{} {}", style("\u{2717}").bold().red(), validity);
        }
    }
    Ok(())
}

/// Evaluate a Jsonnet profile, by doing a HTTP client request.
/// Return well-formed Agama JSON on success.
async fn evaluate_client(client: &BaseHTTPClient, url_or_path: CliInput) -> anyhow::Result<String> {
    let mut url = Url::parse(&client.base_url)?;
    // unwrap OK: only fails for cannot_be_a_base URLs like data: and mailto:
    url.path_segments_mut()
        .unwrap()
        .push("profile")
        .push("evaluate");
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

async fn evaluate(client: &BaseHTTPClient, url_or_path: CliInput) -> anyhow::Result<()> {
    let output = evaluate_client(client, url_or_path).await?;
    println!("{}", output);
    Ok(())
}

async fn import(client: BaseHTTPClient, url_string: String) -> anyhow::Result<()> {
    // useful for store_settings
    tokio::spawn(async move {
        show_progress().await.unwrap();
    });

    let url = Url::parse(&url_string)?;
    let path = url.path();
    let profile_json = if path.ends_with(".xml") || path.ends_with(".erb") || path.ends_with('/') {
        // AutoYaST specific download and convert to JSON
        let config_string = autoyast_client(&client, &url).await?;
        Some(config_string)
    } else {
        pre_process_profile(&client, &url_string).await?
    };

    // None means the profile is a script and it has been executed
    if let Some(profile_json) = profile_json {
        validate(&client, CliInput::Full(profile_json.clone())).await?;
        store_settings(client, &profile_json).await?;
    }
    Ok(())
}

// Retrieve and preprocess the profile.
//
// The profile can be a JSON or a Jsonnet file or a script.
//
// * If it is a JSON file, no preprocessing is needed.
// * If it is a Jsonnet file, it is converted to JSON.
// * If it is a script, it is executed, None is returned
async fn pre_process_profile(
    client: &BaseHTTPClient,
    url_string: &str,
) -> anyhow::Result<Option<String>> {
    let mut bytebuf = Vec::new();
    Transfer::get(&url_string, &mut bytebuf)
        .context(format!("Retrieving data from URL {}", &url_string))?;
    let any_profile =
        String::from_utf8(bytebuf).context(format!("Invalid UTF-8 data at URL {}", &url_string))?;

    match FileFormat::from_string(&any_profile) {
        FileFormat::Script => {
            let api_url = format!("/profile/execute_script?url={}", url_string);
            let _output: Box<serde_json::value::RawValue> = client.post(&api_url, &()).await?;
            Ok(None)
        }
        FileFormat::Jsonnet => {
            let json_string = evaluate_client(client, CliInput::Full(any_profile)).await?;
            Ok(Some(json_string))
        }
        FileFormat::Json => Ok(Some(any_profile)),
        _ => Err(anyhow::Error::msg(
            "Unsupported file format. Expected JSON, Jsonnet, or a script",
        )),
    }
}

async fn store_settings(client: BaseHTTPClient, profile_json: &str) -> anyhow::Result<()> {
    let store = SettingsStore::new(client).await?;
    let settings: InstallSettings = serde_json::from_str(profile_json)?;
    store.store(&settings).await?;
    Ok(())
}

/// Process AutoYaST profile (*url* ending with .xml, .erb, or dir/) by doing a HTTP client request.
/// Note that this client does not act on this *url*, it passes it as a parameter
/// to our web backend.
/// Return well-formed Agama JSON on success.
async fn autoyast_client(client: &BaseHTTPClient, url: &Url) -> anyhow::Result<String> {
    // FIXME: how to escape it?
    let api_url = format!("/profile/autoyast?url={}", url);
    let output: Box<serde_json::value::RawValue> = client.post(&api_url, &()).await?;
    let config_string = format!("{}", output);
    Ok(config_string)
}

async fn autoyast(client: BaseHTTPClient, url_string: String) -> anyhow::Result<()> {
    let url = Url::parse(&url_string)?;
    let output = autoyast_client(&client, &url).await?;
    println!("{}", output);
    Ok(())
}

pub async fn run(client: BaseHTTPClient, subcommand: ProfileCommands) -> anyhow::Result<()> {
    match subcommand {
        ProfileCommands::Autoyast { url } => autoyast(client, url).await,
        ProfileCommands::Validate { url_or_path } => validate(&client, url_or_path).await,
        ProfileCommands::Evaluate { url_or_path } => evaluate(&client, url_or_path).await,
        ProfileCommands::Import { url } => import(client, url).await,
    }
}
