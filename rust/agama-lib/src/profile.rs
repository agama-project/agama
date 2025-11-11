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

use crate::error::ProfileError;
use anyhow::Context;
use log::info;
use serde_json;
use std::{fs, io::Write, path::Path, process::Command};
use tempfile::{tempdir, TempDir};
use url::Url;

pub mod http_client;
pub use http_client::ProfileHTTPClient;

/// Downloads and converts autoyast profile.
pub struct AutoyastProfileImporter {
    pub content: String,
}

impl AutoyastProfileImporter {
    pub async fn read(url: &Url) -> anyhow::Result<Self> {
        let path = url.path();
        if !path.ends_with(".xml") && !path.ends_with(".erb") && !path.ends_with('/') {
            let msg = format!("Unsupported AutoYaST format at {}", url);
            return Err(anyhow::Error::msg(msg));
        }

        const TMP_DIR_PREFIX: &str = "autoyast";
        const AUTOINST_JSON: &str = "autoinst.json";

        let tmp_dir = TempDir::with_prefix(TMP_DIR_PREFIX)?;
        tokio::process::Command::new("agama-autoyast")
            .env("YAST_SKIP_PROFILE_FETCH_ERROR", "1")
            .args([url.as_str(), &tmp_dir.path().to_string_lossy()])
            .status()
            .await
            .context("Failed to run agama-autoyast")?;

        let autoinst_json = tmp_dir.path().join(AUTOINST_JSON);
        let content = fs::read_to_string(&autoinst_json).context(format!(
            "agama-autoyast did not produce {:?}",
            autoinst_json
        ))?;
        Ok(Self { content })
    }
}

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub enum ValidationOutcome {
    Valid,
    NotValid(Vec<String>),
}

impl std::fmt::Display for ValidationOutcome {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ValidationOutcome::Valid => {
                writeln!(f, "The profile is valid.")
            }
            ValidationOutcome::NotValid(errors) => {
                writeln!(
                    f,
                    "The profile is not valid. Please, check the following errors:\n",
                )?;
                for error in errors {
                    writeln!(f, "\t* {error}")?;
                }
                Ok(())
            }
        }
    }
}

/// Checks whether an autoinstallation profile is valid
///
/// ```
/// # use agama_lib::profile::{ProfileValidator, ValidationOutcome};
/// # use std::path::Path;
/// let path = Path::new(env!("CARGO_MANIFEST_DIR"))
///   .join("share/profile.schema.json");
/// let validator = ProfileValidator::new(&path)
///   .expect("the default validator");
///
/// // you can validate a &str
/// let wrong_profile = r#"
///   { "product": { "name": "Tumbleweed" } }
/// "#;
/// let result = validator.validate_str(&wrong_profile).unwrap();
/// assert!(matches!(result, ValidationOutcome::NotValid(_)));
///
/// // or a file
/// let path = Path::new(env!("CARGO_MANIFEST_DIR"))
///   .join("share/examples/profile_tw.json");
/// let result = validator.validate_file(&path).unwrap();
/// assert!(matches!(result, ValidationOutcome::Valid));
/// ```
pub struct ProfileValidator {
    validator: jsonschema::Validator,
}

impl ProfileValidator {
    pub fn default_schema() -> Result<Self, ProfileError> {
        let relative_path = Path::new("agama-lib/share/profile.schema.json");
        let path = if relative_path.exists() {
            relative_path
        } else {
            Path::new("/usr/share/agama-cli/profile.schema.json")
        };
        info!("Validation with path {:?}", path);
        Self::new(path)
    }

    pub fn new(schema_path: &Path) -> Result<Self, ProfileError> {
        let contents = fs::read_to_string(schema_path)
            .context(format!("Failed to read schema at {:?}", schema_path))?;
        let mut schema: serde_json::Value = serde_json::from_str(&contents)?;

        // Set $id of the main schema file to allow retrieving subschema files by using relative
        // paths, see https://stackoverflow.com/questions/70807993/are-there-recommended-ways-to-structure-multiple-json-schemas.
        let path = fs::canonicalize(schema_path)?;
        let id = format!("file://{}", path.to_string_lossy());
        schema
            .as_object_mut()
            .and_then(|s| s.insert("$id".to_string(), serde_json::json!(id)));

        let validator = jsonschema::validator_for(&schema).expect("A valid schema");
        Ok(Self { validator })
    }

    pub fn validate_file(&self, profile_path: &Path) -> Result<ValidationOutcome, ProfileError> {
        let contents = fs::read_to_string(profile_path)?;
        self.validate_str(&contents)
    }

    pub fn validate_str(&self, profile: &str) -> Result<ValidationOutcome, ProfileError> {
        let contents = serde_json::from_str(profile)?;
        let messages: Vec<String> = self
            .validator
            .iter_errors(&contents)
            .map(|e| format!("{}. {}", e, e.instance_path))
            .collect();

        if messages.is_empty() {
            Ok(ValidationOutcome::Valid)
        } else {
            Ok(ValidationOutcome::NotValid(messages))
        }
    }
}

/// Evaluates a profile
///
/// Evaluating a profile means injecting the hardware information (coming from D-Bus)
/// and running the jsonnet code to generate a plain JSON file. For this struct to
/// work, the `/usr/bin/jsonnet` command must be available.
pub struct ProfileEvaluator {}

impl ProfileEvaluator {
    // TODO: if we want the web API to distinguish 400 from 500
    // we should use a structured error here
    pub fn evaluate(&self, profile_path: &Path) -> anyhow::Result<String> {
        let dir = tempdir()?;
        let working_path = dir.path().join("profile.jsonnet");
        fs::copy(profile_path, working_path)?;
        self.evaluate_profile_jsonnet(&dir)
    }

    pub fn evaluate_string(&self, profile: &str) -> anyhow::Result<String> {
        let dir = tempdir()?;
        let working_path = dir.path().join("profile.jsonnet");
        fs::write(working_path, profile)?;
        self.evaluate_profile_jsonnet(&dir)
    }

    fn evaluate_profile_jsonnet(&self, dir: &TempDir) -> anyhow::Result<String> {
        let hwinfo_path = dir.path().join("hw.libsonnet");
        self.write_hwinfo(&hwinfo_path)
            .context("Failed to read system's hardware information")?;

        let result = Command::new("/usr/bin/jsonnet")
            .arg("profile.jsonnet")
            .current_dir(dir)
            .output()
            .context("Failed to run jsonnet")?;
        if !result.status.success() {
            let message =
                String::from_utf8(result.stderr).context("Invalid UTF-8 sequence from jsonnet")?;
            return Err(ProfileError::EvaluationError(message).into());
        }
        let output = String::from_utf8(result.stdout)
            .context("Invalid UTF-8 sequence from jsonnet stdout")?;
        Ok(output)
    }

    // Write the hardware information in JSON format to a given path and also helpers to help with it
    //
    // TODO: we need a better way to generate this information, as lshw and hwinfo are not usable
    // out of the box.
    fn write_hwinfo(&self, path: &Path) -> anyhow::Result<()> {
        let result = Command::new("/usr/sbin/lshw")
            .args(["-json"])
            .output()
            .context("Failed to run lshw")?;
        let helpers = fs::read_to_string("share/agama.libsonnet")
            .or_else(|_| fs::read_to_string("/usr/share/agama-cli/agama.libsonnet"))
            .context("Failed to read agama.libsonnet")?;
        let mut file = fs::File::create(path)?;
        file.write_all(b"{\n")?;
        file.write_all(helpers.as_bytes())?;
        file.write_all(b"\n\"lshw\":\n")?;
        file.write_all(&result.stdout)?;
        file.write_all(b"\n}")?;
        Ok(())
    }
}
