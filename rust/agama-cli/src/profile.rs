use agama_lib::profile::{ProfileEvaluator, ProfileReader, ProfileValidator, ValidationResult};
use anyhow::Context;
use clap::Subcommand;
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
    /// Download the profile from a given location
    Download { url: String },

    /// Validate a profile using JSON Schema
    Validate { path: String },

    /// Evaluate a profile, injecting the hardware information from D-Bus
    Evaluate { path: String },

    /// Import autoinstallation profile from given location into agama configuration
    ///
    /// This is top level command that do all autoinstallation processing beside starting
    /// installation. Unless there is a need to inject additional commands between processing
    /// use this command instead of set of underlaying commands.
    /// Optional dir argument is location where profile is processed. Useful for debugging
    /// if something goes wrong.
    Import { url: String, dir: Option<PathBuf> },
}

fn download(url: &str) -> anyhow::Result<()> {
    let reader = ProfileReader::new(url)?;
    let contents = reader.read()?;
    print!("{}", contents);
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

async fn import(url: String, dir: Option<PathBuf>) -> anyhow::Result<()> {
    let tmpdir = TempDir::new()?; // TODO: create it only if dir is not passed
    let output_file = if url.ends_with(".sh") {
        "profile.sh"
    } else if url.ends_with(".jsonnet") {
        "profile.jsonnet"
    } else {
        "profile.json"
    };
    let output_dir = dir.unwrap_or_else(|| tmpdir.into_path());
    let reader = ProfileReader::new(url.as_str())?;
    let contents = reader.read()?;
    let mut output_path = output_dir.join(output_file);
    let mut output_fd = File::create(output_path.clone())?;
    output_fd.write_all(contents.as_bytes())?;
    if output_file.ends_with(".sh") {
        let err = Command::new("bash")
            .args([output_path.to_str().context("Wrong path to shell script")?])
            .exec();
        println!("Error: {}", err);
    }

    if output_file.ends_with(".jsonnet") {
        let fd = File::create(output_dir.join("profile.json"))?;
        let evaluator = ProfileEvaluator {};
        evaluator
            .evaluate(&output_path, fd)
            .context("Could not evaluate the profile".to_string())?;
        output_path = output_dir.join("profile.json");
    }

    let output_path_str = output_path
        .to_str()
        .context("Failed to get output path")?
        .to_string();
    // TODO: optional skip of validation
    validate(output_path_str.clone())?;
    crate::config::run(
        crate::config::ConfigCommands::Load {
            path: output_path_str,
        },
        crate::printers::Format::Json,
    )
    .await?;

    Ok(())
}

pub async fn run(subcommand: ProfileCommands) -> anyhow::Result<()> {
    match subcommand {
        ProfileCommands::Download { url } => download(&url),
        ProfileCommands::Validate { path } => validate(path),
        ProfileCommands::Evaluate { path } => evaluate(path),
        ProfileCommands::Import { url, dir } => import(url, dir).await,
    }
}
