use agama_lib::profile::{download, ProfileEvaluator, ProfileValidator, ValidationResult};
use anyhow::Context;
use clap::Subcommand;
use std::path::Path;

#[derive(Subcommand, Debug)]
pub enum ProfileCommands {
    /// Download the profile from a given location
    Download { url: String },

    /// Validate a profile using JSON Schema
    Validate { path: String },

    /// Evaluate a profile, injecting the hardware information from D-Bus
    Evaluate { path: String },
}

fn validate(path: String) -> anyhow::Result<()> {
    let validator = ProfileValidator::default_schema()?;
    let path = Path::new(&path);
    let result = validator
        .validate_file(path)
        .context("Could not validate the profile")?;
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
        .evaluate(Path::new(&path))
        .context(format!("Could not evaluate the profile"))?;
    Ok(())
}

pub fn run(subcommand: ProfileCommands) -> anyhow::Result<()> {
    match subcommand {
        ProfileCommands::Download { url } => Ok(download(&url)?),
        ProfileCommands::Validate { path } => validate(path),
        ProfileCommands::Evaluate { path } => evaluate(path),
    }
}
