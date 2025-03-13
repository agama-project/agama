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
    base_http_client::BaseHTTPClient,
    install_settings::InstallSettings,
    profile::{AutoyastProfileImporter, ProfileEvaluator, ValidationResult},
    utils::FileFormat,
    utils::Transfer,
    Store as SettingsStore,
};
use anyhow::Context;
use clap::Subcommand;
use console::style;
use std::os::unix::{fs::PermissionsExt, process::CommandExt};
use std::{
    fs::File,
    io::Write,
    path::{Path, PathBuf},
    process::Command,
};
use tempfile::TempDir;
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
        /// Local path to the JSON file to validate
        path: PathBuf,
    },

    /// Evaluate a profile, injecting the hardware information from D-Bus
    ///
    /// For an example of Jsonnet-based profile, see
    /// https://github.com/openSUSE/agama/blob/master/rust/agama-lib/share/examples/profile.jsonnet
    Evaluate {
        /// Path to jsonnet file.
        path: PathBuf,
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
        /// Specific directory where all processing happens. By default it uses a temporary directory
        dir: Option<PathBuf>,
    },
}

async fn validate(client: BaseHTTPClient, path: &PathBuf) -> anyhow::Result<()> {
    let url_path = format!("/profile/validate?path={}", path.to_string_lossy());
    let result = client.post(&url_path, &()).await?;
    match result {
        ValidationResult::Valid => {
            println!("{} {}", style("\u{2713}").bold().green(), result);
        }
        ValidationResult::NotValid(_) => {
            eprintln!("{} {}", style("\u{2717}").bold().red(), result);
        }
    }
    Ok(())
}

async fn evaluate(client: BaseHTTPClient, path: &Path) -> anyhow::Result<()> {
    let url_path = format!("/profile/evaluate?path={}", path.to_string_lossy());
    let output: Box<serde_json::value::RawValue> = client.post(&url_path, &()).await?;
    println!("{}", output);
    Ok(())
}

async fn import(
    client: BaseHTTPClient,
    url_string: String,
    dir: Option<PathBuf>,
) -> anyhow::Result<()> {
    tokio::spawn(async move {
        show_progress().await.unwrap();
    });

    let url = Url::parse(&url_string)?;
    let tmpdir = TempDir::new()?; // TODO: create it only if dir is not passed
    let work_dir = dir.unwrap_or_else(|| tmpdir.into_path());
    let profile_path = work_dir.join("profile.json");

    // Specific AutoYaST handling
    let path = url.path();
    if path.ends_with(".xml") || path.ends_with(".erb") || path.ends_with('/') {
        // AutoYaST specific download and convert to JSON
        AutoyastProfileImporter::read(&url)?.write_file(&profile_path)?;
    } else {
        pre_process_profile(&url_string, &profile_path)?;
    }

    validate(client, &profile_path).await?;
    store_settings(&profile_path).await?;

    Ok(())
}

// Preprocess the profile.
//
// The profile can be a JSON or a Jsonnet file or a script.
//
// * If it is a JSON file, no preprocessing is needed.
// * If it is a Jsonnet file, it is converted to JSON.
// * If it is a script, it is executed.
fn pre_process_profile<P: AsRef<Path>>(url_string: &str, path: P) -> anyhow::Result<()> {
    let work_dir = path.as_ref().parent().unwrap();
    let tmp_profile_path = work_dir.join("profile.temp");
    let mut tmp_file = File::create(&tmp_profile_path)?;
    Transfer::get(url_string, &mut tmp_file)?;

    match FileFormat::from_file(&tmp_profile_path)? {
        FileFormat::Jsonnet => {
            let mut file = File::create(path)?;
            let evaluator = ProfileEvaluator {};
            let ouptut = evaluator
                .evaluate(&tmp_profile_path)
                .context("Could not evaluate the profile".to_string())?;
            write!(file, "{}", ouptut)?;
        }
        FileFormat::Script => {
            let mut perms = std::fs::metadata(&tmp_profile_path)?.permissions();
            perms.set_mode(0o750);
            std::fs::set_permissions(&tmp_profile_path, perms)?;
            let err = Command::new(&tmp_profile_path).exec();
            eprintln!("Exec failed: {}", err);
        }
        FileFormat::Json => {
            std::fs::rename(&tmp_profile_path, path.as_ref())?;
        }
        _ => {
            return Err(anyhow::Error::msg("Unsupported file format"));
        }
    }
    Ok(())
}

async fn store_settings<P: AsRef<Path>>(path: P) -> anyhow::Result<()> {
    let store = SettingsStore::new(BaseHTTPClient::default().authenticated()?).await?;
    let settings = InstallSettings::from_file(&path)?;
    store.store(&settings).await?;
    Ok(())
}

/// returns Agama JSON config as String
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
        ProfileCommands::Validate { path } => validate(client, &path).await,
        ProfileCommands::Evaluate { path } => evaluate(client, &path).await,
        ProfileCommands::Import { url, dir } => import(client, url, dir).await,
    }
}
