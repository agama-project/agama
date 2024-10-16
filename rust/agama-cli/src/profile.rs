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

use agama_lib::{
    base_http_client::BaseHTTPClient,
    install_settings::InstallSettings,
    profile::{AutoyastProfile, ProfileEvaluator, ProfileValidator, ValidationResult},
    transfer::Transfer,
    Store as SettingsStore,
};
use anyhow::Context;
use clap::Subcommand;
use std::os::unix::process::CommandExt;
use std::{
    fs::File,
    io::stdout,
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
        /// Profile's URL. Supports the same schemas than te "download" command plus
        /// AutoYaST specific ones. Supported files are json, jsonnet, sh for Agama profiles and ERB, XML, and rules/classes directories
        /// for AutoYaST support.
        url: String,
        /// Specific directory where all processing happens. By default it uses a temporary directory
        dir: Option<PathBuf>,
    },
}

fn validate(path: &PathBuf) -> anyhow::Result<()> {
    let validator = ProfileValidator::default_schema()?;
    // let path = Path::new(&path);
    let result = validator
        .validate_file(path)
        .context(format!("Could not validate the profile {:?}", path))?;
    match result {
        ValidationResult::Valid => {
            println!("The profile is valid")
        }
        ValidationResult::NotValid(errors) => {
            eprintln!("The profile is not valid. Please, check the following errors:\n");
            for error in errors {
                println!("* {error}")
            }
        }
    }
    Ok(())
}

fn evaluate(path: &Path) -> anyhow::Result<()> {
    let evaluator = ProfileEvaluator {};
    evaluator
        .evaluate(path, stdout())
        .context("Could not evaluate the profile".to_string())?;
    Ok(())
}

async fn import(url_string: String, dir: Option<PathBuf>) -> anyhow::Result<()> {
    let url = Url::parse(&url_string)?;
    let tmpdir = TempDir::new()?; // TODO: create it only if dir is not passed
    let path = url.path();
    let output_file = if path.ends_with(".sh") {
        "profile.sh"
    } else if path.ends_with(".jsonnet") {
        "profile.jsonnet"
    } else {
        "profile.json"
    };
    let output_dir = dir.unwrap_or_else(|| tmpdir.into_path());
    let mut output_path = output_dir.join(output_file);
    let output_fd = File::create(output_path.clone())?;
    if path.ends_with(".xml") || path.ends_with(".erb") || path.ends_with('/') {
        // autoyast specific download and convert to json
        AutoyastProfile::new(&url)?.read_into(output_fd)?;
    } else {
        // just download profile
        Transfer::get(&url_string, output_fd)?;
    }

    // exec shell scripts
    if output_file.ends_with(".sh") {
        let err = Command::new("bash")
            .args([output_path.to_str().context("Wrong path to shell script")?])
            .exec();
        eprintln!("Exec failed: {}", err);
    }

    // evaluate jsonnet profiles
    if output_file.ends_with(".jsonnet") {
        let fd = File::create(output_dir.join("profile.json"))?;
        let evaluator = ProfileEvaluator {};
        evaluator
            .evaluate(&output_path, fd)
            .context("Could not evaluate the profile".to_string())?;
        output_path = output_dir.join("profile.json");
    }

    validate(&output_path)?;
    store_settings(&output_path).await?;

    Ok(())
}

async fn store_settings<P: AsRef<Path>>(path: P) -> anyhow::Result<()> {
    let store = SettingsStore::new(BaseHTTPClient::default().authenticated()?).await?;
    let settings = InstallSettings::from_file(&path)?;
    store.store(&settings).await?;
    Ok(())
}

fn autoyast(url_string: String) -> anyhow::Result<()> {
    let url = Url::parse(&url_string)?;
    let reader = AutoyastProfile::new(&url)?;
    reader.read_into(std::io::stdout())?;
    Ok(())
}

pub async fn run(subcommand: ProfileCommands) -> anyhow::Result<()> {
    match subcommand {
        ProfileCommands::Autoyast { url } => autoyast(url),
        ProfileCommands::Validate { path } => validate(&path),
        ProfileCommands::Evaluate { path } => evaluate(&path),
        ProfileCommands::Import { url, dir } => import(url, dir).await,
    }
}
