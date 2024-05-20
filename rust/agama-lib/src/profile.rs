use crate::error::ProfileError;
use anyhow::Context;
use curl::easy::Easy;
use jsonschema::JSONSchema;
use log::info;
use serde_json;
use std::{fs, io, io::Write, path::Path, process::Command};
use tempfile::{tempdir, TempDir};
use url::Url;

/// Downloads a profile for a given location.
pub struct ProfileReader {
    url: Url,
}

impl ProfileReader {
    pub fn new(url: &str) -> anyhow::Result<Self> {
        let url = Url::parse(url)?;
        Ok(Self { url })
    }

    pub fn read(&self) -> anyhow::Result<String> {
        let path = self.url.path();
        if path.ends_with(".xml") || path.ends_with(".erb") || path.ends_with('/') {
            self.read_from_autoyast()
        } else {
            self.read_from_url()
        }
    }

    fn read_from_url(&self) -> anyhow::Result<String> {
        let mut buf = Vec::new();
        {
            let mut handle = Easy::new();
            handle.url(self.url.as_str())?;

            let mut transfer = handle.transfer();
            transfer.write_function(|data| {
                buf.extend(data);
                Ok(data.len())
            })?;
            transfer.perform().unwrap();
        }
        Ok(String::from_utf8(buf)?)
    }

    fn read_from_autoyast(&self) -> anyhow::Result<String> {
        const TMP_DIR_PREFIX: &str = "autoyast";
        const AUTOINST_JSON: &str = "autoinst.json";

        let tmp_dir = TempDir::with_prefix(TMP_DIR_PREFIX)?;
        Command::new("agama-autoyast")
            .args([self.url.as_str(), &tmp_dir.path().to_string_lossy()])
            .status()?;

        let autoinst_json = tmp_dir.path().join(AUTOINST_JSON);
        Ok(fs::read_to_string(autoinst_json)?)
    }
}

#[derive(Debug)]
pub enum ValidationResult {
    Valid,
    NotValid(Vec<String>),
}

/// Checks whether an autoinstallation profile is valid
///
/// ```
/// # use agama_lib::profile::{ProfileValidator, ValidationResult};
/// # use std::path::Path;
/// let validator = ProfileValidator::new(
///   Path::new("share/profile.schema.json")
/// ).expect("the default validator");
///
/// // you can validate a &str
/// let wrong_profile = r#"
///   { "product": { "name": "Tumbleweed" } }
/// "#;
/// let result = validator.validate_str(&wrong_profile).unwrap();
/// assert!(matches!(ValidationResult::NotValid, result));
///
/// // or a file
/// validator.validate_file(Path::new("share/examples/profile.json"));
/// assert!(matches!(ValidationResult::Valid, result));
/// ```
pub struct ProfileValidator {
    schema: JSONSchema,
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
        let schema = serde_json::from_str(&contents)?;
        let schema = JSONSchema::compile(&schema).expect("A valid schema");
        Ok(Self { schema })
    }

    pub fn validate_file(&self, profile_path: &Path) -> Result<ValidationResult, ProfileError> {
        let contents = fs::read_to_string(profile_path)?;
        self.validate_str(&contents)
    }

    pub fn validate_str(&self, profile: &str) -> Result<ValidationResult, ProfileError> {
        let contents = serde_json::from_str(profile)?;
        let result = self.schema.validate(&contents);
        if let Err(errors) = result {
            let messages: Vec<String> = errors.map(|e| format!("{e}. {e:?}")).collect();
            return Ok(ValidationResult::NotValid(messages));
        }
        Ok(ValidationResult::Valid)
    }
}

/// Evaluates a profile
///
/// Evaluating a profile means injecting the hardware information (coming from D-Bus)
/// and running the jsonnet code to generate a plain JSON file. For this struct to
/// work, the `/usr/bin/jsonnet` command must be available.
pub struct ProfileEvaluator {}

impl ProfileEvaluator {
    pub fn evaluate(&self, profile_path: &Path) -> anyhow::Result<()> {
        let dir = tempdir()?;

        let working_path = dir.path().join("profile.jsonnet");
        fs::copy(profile_path, working_path)?;

        let hwinfo_path = dir.path().join("hw.libsonnet");
        self.write_hwinfo(&hwinfo_path)
            .context("Failed to read system's hardware information")?;

        let result = Command::new("/usr/bin/jsonnet")
            .arg("profile.jsonnet")
            .current_dir(&dir)
            .output()
            .context("Failed to run jsonnet")?;
        if !result.status.success() {
            let message =
                String::from_utf8(result.stderr).context("Invalid UTF-8 sequence from jsonnet")?;
            return Err(ProfileError::EvaluationError(message).into());
        }
        io::stdout().write_all(&result.stdout)?;
        Ok(())
    }

    // Write the hardware information in JSON format to a given path
    //
    // TODO: we need a better way to generate this information, as lshw and hwinfo are not usable
    // out of the box.
    fn write_hwinfo(&self, path: &Path) -> anyhow::Result<()> {
        let result = Command::new("/usr/sbin/lshw")
            .args(["-json"])
            .output()
            .context("Failed to run lshw")?;
        let mut file = fs::File::create(path)?;
        file.write_all(b"{ \"lshw\":\n")?;
        file.write_all(&result.stdout)?;
        file.write_all(b"\n}")?;
        Ok(())
    }
}
