use agama_lib::profile::{ProfileEvaluator, AutoyastProfile, ProfileValidator, ValidationResult};
use anyhow::Context;
use clap::Subcommand;
use curl::easy::Easy;
use url::Url;
use std::os::unix::process::CommandExt;
use std::{
    fs::File,
    io::{stdout, Write},
    path::{Path, PathBuf},
    process::Command,
};
use tempfile::TempDir;

#[derive(Subcommand, Debug)]
pub enum ProfileCommands {
    /// Download the autoyast profile and convert it to json
    Autoyast { url: String },

    /// Validate a profile using JSON Schema
    Validate { path: String },

    /// Evaluate a profile, injecting the hardware information from D-Bus
    Evaluate { path: String },

    /// Process autoinstallation profile and loads it into agama
    ///
    /// This is top level command that do all autoinstallation processing beside starting
    /// installation. Unless there is a need to inject additional commands between processing
    /// use this command instead of set of underlying commands.
    Import {
        /// URL where profile is located. Supported schemas are all that download supports and additionally
        /// autoyast specific ones. Supported files are json, jsonnet, sh for agama profiles and erb, xml, directory
        /// for autoyast support.
        url: String,
        /// Specific directory where all processing happens. If not specific temporary directory is used
        dir: Option<PathBuf>,
    },
}


pub fn download(url: &str, mut out_fd: impl Write) -> anyhow::Result<()> {
    let mut handle = Easy::new();
    handle.url(url)?;

    let mut transfer = handle.transfer();
    transfer.write_function(|buf|
        // unwrap here is ok, as we want to kill download if we failed to write content
        Ok(out_fd.write(buf).unwrap()))?;
    transfer.perform()?;

    Ok(())
}

fn validate(path: String) -> anyhow::Result<()> {
    let validator = ProfileValidator::default_schema()?;
    let path = Path::new(&path);
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

fn evaluate(path: String) -> anyhow::Result<()> {
    let evaluator = ProfileEvaluator {};
    evaluator
        .evaluate(Path::new(&path), stdout())
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
        AutoyastProfile::new(&url)?.read(output_fd)?;
    } else {
        // just download profile
        download(&url_string, output_fd)?;
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

    let output_path_string = output_path
        .to_str()
        .context("Failed to get output path")?
        .to_string();
    // Validate json profile
    // TODO: optional skip of validation
    validate(output_path_string.clone())?;
    // load resulting json config
    crate::config::run(
        crate::config::ConfigCommands::Load {
            path: output_path_string,
        },
        crate::printers::Format::Json,
    )
    .await?;

    Ok(())
}

fn autoyast(url_string: String) -> anyhow::Result<()>{
    let url = Url::parse(&url_string)?;
    let reader = AutoyastProfile::new(&url)?;
    reader.read(std::io::stdout())?;
    Ok(())
}

pub async fn run(subcommand: ProfileCommands) -> anyhow::Result<()> {
    match subcommand {
        ProfileCommands::Autoyast { url } => autoyast(url),
        ProfileCommands::Validate { path } => validate(path),
        ProfileCommands::Evaluate { path } => evaluate(path),
        ProfileCommands::Import { url, dir } => import(url, dir).await,
    }
}
