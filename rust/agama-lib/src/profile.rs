// Copyright (c) [2024-2026] SUSE LLC
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
use schemars::JsonSchema;
use serde_json;
use std::{
    env, fs,
    io::Write,
    path::{Path, PathBuf},
    process::Command,
};
use tempfile::{tempdir, TempDir};
use url::Url;

pub mod http_client;
pub use http_client::ProfileHTTPClient;

pub const DEFAULT_SCHEMA_DIR: &str = "/usr/share/agama/openapi/nightly/schemas";
pub const DEFAULT_JSONNET_DIR: &str = "/usr/share/agama/jsonnet";

#[derive(thiserror::Error, Debug)]
pub enum AutoyastError {
    #[error("I/O error: {0}")]
    IO(#[from] std::io::Error),
    #[error("Failed to run the agama-autoyast script: {0}")]
    Execute(#[source] std::io::Error),
    #[error("Failed to convert the AutoYaST profile: {0}")]
    Evaluation(String),
    #[error("Unsupported AutoYaST format at {0}")]
    UnsupportedFormat(Url),
    #[error("Failed to parse the list of unsupported AutoYaST elements: {0}")]
    InvalidUnsupported(#[from] serde_json::Error),
}

/// An AutoYaST element that could not be fully converted to its Agama equivalent.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct UnsupportedElement {
    /// AutoYaST element key (e.g., "networking/backend").
    pub key: String,
    /// Support level for this element ("no", "planned" or "partial").
    pub support: String,
    /// Additional information about the element, if any.
    pub notes: Option<String>,
}

/// Result of converting an AutoYaST profile: the Agama configuration and any
/// unsupported elements found along the way.
#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct AutoyastConversionResult {
    pub profile: serde_json::Value,
    pub unsupported: Vec<UnsupportedElement>,
}

/// Whether the given path looks like an AutoYaST profile source (XML, ERB, or a directory).
pub fn is_autoyast_path(path: &str) -> bool {
    path.ends_with(".xml") || path.ends_with(".erb") || path.ends_with('/')
}

/// Downloads and converts autoyast profile.
pub struct AutoyastProfileImporter {
    pub content: String,
    pub unsupported: Vec<UnsupportedElement>,
}

impl AutoyastProfileImporter {
    pub async fn read(url: &Url) -> Result<Self, AutoyastError> {
        if !is_autoyast_path(url.path()) {
            return Err(AutoyastError::UnsupportedFormat(url.clone()));
        }

        const TMP_DIR_PREFIX: &str = "autoyast";
        const AUTOINST_JSON: &str = "autoinst.json";
        const UNSUPPORTED_JSON: &str = "unsupported.json";

        let tmp_dir = TempDir::with_prefix(TMP_DIR_PREFIX)?;
        let result = tokio::process::Command::new("agama-autoyast")
            .env("YAST_SKIP_PROFILE_FETCH_ERROR", "1")
            .args([url.as_str(), &tmp_dir.path().to_string_lossy()])
            .output()
            .await
            .map_err(AutoyastError::Execute)?;

        if !result.status.success() {
            return Err(AutoyastError::Evaluation(
                String::from_utf8_lossy(&result.stderr).to_string(),
            ));
        }

        let autoinst_json = tmp_dir.path().join(AUTOINST_JSON);
        let content = fs::read_to_string(&autoinst_json)?;

        let unsupported_json = tmp_dir.path().join(UNSUPPORTED_JSON);
        let unsupported = if unsupported_json.exists() {
            let raw = fs::read_to_string(&unsupported_json)?;
            serde_json::from_str(&raw)?
        } else {
            Vec::new()
        };

        Ok(Self {
            content,
            unsupported,
        })
    }
}

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub enum ValidationOutcome {
    Valid,
    NotValid(Vec<String>),
}

/// Checks whether an autoinstallation profile is valid
///
/// ```
/// # use agama_lib::profile::{ProfileValidator, ValidationOutcome};
/// # use std::path::PathBuf;
/// let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
///
/// path.pop();
/// path.push("out/schemas/config.schema.json");
///
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
/// let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
///
/// path.pop();
/// path.push("share/examples/profile_tw.json");
///
/// let result = validator.validate_file(&path).unwrap();
/// assert!(matches!(result, ValidationOutcome::Valid));
/// ```
pub struct ProfileValidator {
    validator: jsonschema::Validator,
}

impl ProfileValidator {
    pub fn default_schema() -> Result<Self, ProfileError> {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let dev_path = manifest_dir.join("../out/schemas/config.schema.json");
        let path = if dev_path.exists() {
            dev_path
        } else {
            let schema_dir = env::var("AGAMA_SCHEMA_DIR").unwrap_or(DEFAULT_SCHEMA_DIR.to_string());
            PathBuf::from(schema_dir).join("config.schema.json")
        };
        info!("Validation with path {:?}", path);
        Self::new(path)
    }

    pub fn new<P: AsRef<Path>>(schema_path: P) -> Result<Self, ProfileError> {
        let contents = fs::read_to_string(&schema_path).context(format!(
            "Failed to read schema at {}",
            schema_path.as_ref().to_string_lossy()
        ))?;
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
            .or_else(|_| {
                fs::read_to_string(PathBuf::from(DEFAULT_JSONNET_DIR).join("agama.libsonnet"))
            })
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_config_full() {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let schema_path = manifest_dir.join("../out/schemas/config.schema.json");
        if !schema_path.exists() {
            return;
        }

        let validator = ProfileValidator::new(&schema_path).expect("valid schema");
        let full_example = manifest_dir.join("../share/examples/config_full.json");
        let result = validator
            .validate_file(&full_example)
            .expect("validation result");
        match result {
            ValidationOutcome::Valid => {}
            ValidationOutcome::NotValid(errors) => {
                panic!("Comprehensive config failed validation:\n{:#?}", errors);
            }
        }
    }

    #[test]
    fn test_validate_profile_tw_invalid() {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let schema_path = manifest_dir.join("../out/schemas/config.schema.json");
        if !schema_path.exists() {
            return;
        }

        let validator = ProfileValidator::new(&schema_path).expect("valid schema");
        let invalid_example = manifest_dir.join("../share/examples/profile_tw_invalid.json");
        let result = validator
            .validate_file(&invalid_example)
            .expect("validation result");
        match result {
            ValidationOutcome::Valid => {
                panic!("Invalid profile should have failed validation");
            }
            ValidationOutcome::NotValid(errors) => {
                assert!(!errors.is_empty());
                for err in &errors {
                    assert!(
                        !err.contains("anyOf"),
                        "Error should not mention 'anyOf', but got: {}",
                        err
                    );
                }
            }
        }
    }

    #[test]
    fn test_validate_unknown_field_rejected() {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let schema_path = manifest_dir.join("../out/schemas/config.schema.json");
        if !schema_path.exists() {
            return;
        }

        let validator = ProfileValidator::new(&schema_path).expect("valid schema");
        let json_with_unknown_field = r#"
        {
            "bootloader": {
                "unknownKey": true
            }
        }
        "#;
        let result = validator
            .validate_str(json_with_unknown_field)
            .expect("validation result");
        match result {
            ValidationOutcome::Valid => {
                panic!("Profile with unknown key should have failed validation");
            }
            ValidationOutcome::NotValid(errors) => {
                assert!(!errors.is_empty());
                assert!(
                    errors.iter().any(|e| e.contains("unknownKey")),
                    "Expected error mentioning unknownKey, got: {:#?}",
                    errors
                );
            }
        }
    }

    #[test]
    fn test_validate_invalid_enum_rejected_cleanly() {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let schema_path = manifest_dir.join("../out/schemas/config.schema.json");
        if !schema_path.exists() {
            return;
        }

        let validator = ProfileValidator::new(&schema_path).expect("valid schema");
        let json_with_invalid_enum = r#"
        {
            "access": {
                "ssh": "invalid_value"
            }
        }
        "#;
        let result = validator
            .validate_str(json_with_invalid_enum)
            .expect("validation result");
        match result {
            ValidationOutcome::Valid => {
                panic!("Profile with invalid enum should have failed validation");
            }
            ValidationOutcome::NotValid(errors) => {
                assert!(!errors.is_empty());
                for err in &errors {
                    assert!(
                        !err.contains("oneOf") && !err.contains("anyOf"),
                        "Error should not mention 'oneOf' or 'anyOf', but got: {}",
                        err
                    );
                }
            }
        }
    }

    #[test]
    fn test_all_config_schema_entries_define_additional_properties() {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let schema_path = manifest_dir.join("../out/schemas/config.schema.json");
        if !schema_path.exists() {
            return;
        }

        let content = fs::read_to_string(&schema_path).expect("read config.schema.json");
        let schema_json: serde_json::Value = serde_json::from_str(&content).expect("parse schema");

        // The root schema itself must define additionalProperties
        assert!(
            schema_json.get("additionalProperties").is_some(),
            "Root schema in config.schema.json must define 'additionalProperties'"
        );

        // Every object component schema must define additionalProperties
        if let Some(components) = schema_json
            .pointer("/components/schemas")
            .and_then(|c| c.as_object())
        {
            let mut missing = Vec::new();
            for (name, comp) in components {
                // Ignore schemas that are unions/anyOf variants (e.g. untagged enum containers like UserFile)
                if comp.get("anyOf").is_some() || comp.get("oneOf").is_some() {
                    continue;
                }

                let is_object = if let Some(ty) = comp.get("type") {
                    ty == "object"
                        || ty.as_array().map_or(false, |a| a.iter().any(|v| v == "object"))
                } else {
                    comp.get("properties").is_some()
                };

                // If it is an object definition, it must define additionalProperties
                if is_object && comp.get("additionalProperties").is_none() {
                    missing.push(name.clone());
                }
            }

            assert!(
                missing.is_empty(),
                "The following schema entries in config.schema.json do not define 'additionalProperties':\n{:#?}\n\
                Please define `#[serde(deny_unknown_fields)]` on the corresponding Rust structs!",
                missing
            );
        }
    }
}
