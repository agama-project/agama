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

use std::{
    fs,
    io::Write,
    os::unix::fs::OpenOptionsExt,
    path::{Path, PathBuf},
    process,
};

use serde::{Deserialize, Serialize};

use crate::transfer::Transfer;

use super::ScriptError;

#[derive(
    Debug, Clone, Copy, PartialEq, strum::Display, Serialize, Deserialize, utoipa::ToSchema,
)]
#[strum(serialize_all = "camelCase")]
#[serde(rename_all = "camelCase")]
pub enum ScriptsGroup {
    Pre,
    Post,
    Init,
}

#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct BaseScript {
    pub name: String,
    #[serde(flatten)]
    pub source: ScriptSource,
}

impl BaseScript {
    fn write<P: AsRef<Path>>(&self, workdir: P) -> Result<(), ScriptError> {
        let script_path = workdir.as_ref().join(&self.name);
        std::fs::create_dir_all(&script_path.parent().unwrap())?;

        let mut file = fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .mode(0o500)
            .open(&script_path)?;

        match &self.source {
            ScriptSource::Text { body } => write!(file, "{}", &body)?,
            ScriptSource::Remote { url } => Transfer::get(url, file)?,
        };

        Ok(())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(untagged)]
pub enum ScriptSource {
    /// Script's body.
    Text { body: String },
    /// URL to get the script from.
    Remote { url: String },
}

/// Represents a script to run as part of the installation process.
///
/// There are different types of scripts that can run at different stages of the installation.
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(tag = "type")]
pub enum Script {
    Pre(PreScript),
    Post(PostScript),
    Init(InitScript),
}

impl Script {
    fn base(&self) -> &BaseScript {
        match self {
            Script::Pre(inner) => &inner.base,
            Script::Post(inner) => &inner.base,
            Script::Init(inner) => &inner.base,
        }
    }

    /// Returns the name of the script.
    pub fn name(&self) -> &str {
        self.base().name.as_str()
    }

    /// Writes the script to the given work directory.
    ///
    /// The name of the script depends on the work directory and the script's group.
    pub fn write<P: AsRef<Path>>(&self, workdir: P) -> Result<(), ScriptError> {
        let path = workdir.as_ref().join(&self.group().to_string());
        self.base().write(&path)
    }

    /// Script's group.
    ///
    /// It determines whether the script runs.
    pub fn group(&self) -> ScriptsGroup {
        match self {
            Script::Pre(_) => ScriptsGroup::Pre,
            Script::Post(_) => ScriptsGroup::Post,
            Script::Init(_) => ScriptsGroup::Init,
        }
    }

    /// Runs the script in the given work directory.
    ///
    /// It saves the logs and the exit status of the execution.
    ///
    /// * `workdir`: where to run the script.
    pub fn run<P: AsRef<Path>>(&self, workdir: P) -> Result<(), ScriptError> {
        let path = workdir
            .as_ref()
            .join(self.group().to_string())
            .join(self.name());
        let runner = match self {
            Script::Pre(inner) => &inner.runner(),
            Script::Post(inner) => &inner.runner(),
            Script::Init(inner) => &inner.runner(),
        };

        let Some(runner) = runner else {
            log::info!("No runner defined for script {:?}", &self);
            return Ok(());
        };

        return runner.run(&path);
    }
}

/// Trait to allow getting the runner for a script.
trait WithRunner {
    /// Returns the runner for the script if any.
    fn runner(&self) -> Option<ScriptRunner> {
        Some(ScriptRunner::default())
    }
}

/// Represents a script that runs before the installation starts.
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct PreScript {
    #[serde(flatten)]
    pub base: BaseScript,
}

impl From<PreScript> for Script {
    fn from(value: PreScript) -> Self {
        Self::Pre(value)
    }
}

impl TryFrom<Script> for PreScript {
    type Error = ScriptError;

    fn try_from(value: Script) -> Result<Self, Self::Error> {
        match value {
            Script::Pre(inner) => Ok(inner),
            _ => Err(ScriptError::WrongScriptType),
        }
    }
}

impl WithRunner for PreScript {}

/// Represents a script that runs after the installation finishes.
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct PostScript {
    #[serde(flatten)]
    pub base: BaseScript,
    /// Whether the script should be run in a chroot environment.
    pub chroot: Option<bool>,
}

impl From<PostScript> for Script {
    fn from(value: PostScript) -> Self {
        Self::Post(value)
    }
}

impl TryFrom<Script> for PostScript {
    type Error = ScriptError;

    fn try_from(value: Script) -> Result<Self, Self::Error> {
        match value {
            Script::Post(inner) => Ok(inner),
            _ => Err(ScriptError::WrongScriptType),
        }
    }
}

impl WithRunner for PostScript {
    fn runner(&self) -> Option<ScriptRunner> {
        Some(ScriptRunner::new().with_chroot(self.chroot.unwrap_or(true)))
    }
}

/// Represents a script that runs during the first boot of the target system,
/// once the installation is finished.
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct InitScript {
    #[serde(flatten)]
    pub base: BaseScript,
}

impl From<InitScript> for Script {
    fn from(value: InitScript) -> Self {
        Self::Init(value)
    }
}

impl TryFrom<Script> for InitScript {
    type Error = ScriptError;

    fn try_from(value: Script) -> Result<Self, Self::Error> {
        match value {
            Script::Init(inner) => Ok(inner),
            _ => Err(ScriptError::WrongScriptType),
        }
    }
}

impl WithRunner for InitScript {
    /// Returns the runner for the script if any.
    fn runner(&self) -> Option<ScriptRunner> {
        None
    }
}

/// Manages a set of installation scripts.
///
/// It offers an API to add and execute installation scripts.
pub struct ScriptsRepository {
    workdir: PathBuf,
    pub scripts: Vec<Script>,
}

impl ScriptsRepository {
    /// Builds a new repository.
    ///
    /// * `workdir`: directory to store the scripts.
    pub fn new<P: AsRef<Path>>(workdir: P) -> ScriptsRepository {
        ScriptsRepository {
            workdir: PathBuf::from(workdir.as_ref()),
            ..Default::default()
        }
    }

    /// Adds a new script to the repository.
    ///
    /// * `script`: script to add.
    pub fn add(&mut self, script: Script) -> Result<(), ScriptError> {
        script.write(&self.workdir)?;
        self.scripts.push(script);
        Ok(())
    }

    /// Removes all the scripts from the repository.
    pub fn clear(&mut self) -> Result<(), ScriptError> {
        self.scripts.clear();
        if self.workdir.exists() {
            std::fs::remove_dir_all(&self.workdir)?;
        }
        Ok(())
    }

    /// Runs the scripts in the given group.
    ///
    /// They run in the order they were added to the repository. If does not return an error
    /// if running a script fails, although it logs the problem.
    pub fn run(&self, group: ScriptsGroup) -> Result<(), ScriptError> {
        let scripts: Vec<_> = self.scripts.iter().filter(|s| s.group() == group).collect();
        for script in scripts {
            if let Err(error) = script.run(&self.workdir) {
                log::error!(
                    "Failed to run user-defined script '{}': {:?}",
                    &script.name(),
                    error
                );
            }
        }
        Ok(())
    }
}

impl Default for ScriptsRepository {
    fn default() -> Self {
        Self {
            workdir: PathBuf::from("/run/agama/scripts"),
            scripts: vec![],
        }
    }
}

/// Implements the logic to run a command.
///
/// At this point, it only supports running a command in a chroot environment. In the future, it
/// might implement support for other features, like progress reporting (like AutoYaST does).
struct ScriptRunner {
    chroot: bool,
}

impl ScriptRunner {
    fn new() -> Self {
        Default::default()
    }

    fn with_chroot(self, chroot: bool) -> Self {
        Self { chroot }
    }

    fn run<P: AsRef<Path>>(&self, path: P) -> Result<(), ScriptError> {
        let path = path.as_ref();
        let output = if self.chroot {
            process::Command::new("chroot")
                .args(["/mnt", &path.to_string_lossy()])
                .output()?
        } else {
            process::Command::new(&path).output()?
        };

        fs::write(path.with_extension("log"), output.stdout)?;
        fs::write(path.with_extension("err"), output.stderr)?;
        fs::write(path.with_extension("out"), output.status.to_string())?;

        Ok(())
    }
}

impl Default for ScriptRunner {
    fn default() -> Self {
        Self { chroot: false }
    }
}

#[cfg(test)]
mod test {
    use tempfile::TempDir;
    use tokio::test;

    use crate::scripts::{BaseScript, PreScript, Script, ScriptSource};

    use super::{ScriptsGroup, ScriptsRepository};

    #[test]
    async fn test_add_script() {
        let tmp_dir = TempDir::with_prefix("scripts-").expect("a temporary directory");
        let mut repo = ScriptsRepository::new(&tmp_dir);

        let base = BaseScript {
            name: "test".to_string(),
            source: ScriptSource::Text {
                body: "".to_string(),
            },
        };
        let script = Script::Pre(PreScript { base });
        repo.add(script).unwrap();

        let script = repo.scripts.first().unwrap();
        assert_eq!("test".to_string(), script.name());

        let script_path = tmp_dir.path().join("pre").join("test");
        assert!(script_path.exists());
    }

    #[test]
    async fn test_run_scripts() {
        let tmp_dir = TempDir::with_prefix("scripts-").expect("a temporary directory");
        let mut repo = ScriptsRepository::new(&tmp_dir);
        let body = "#!/bin/bash\necho hello\necho error >&2".to_string();

        let base = BaseScript {
            name: "test".to_string(),
            source: ScriptSource::Text { body },
        };
        let script = Script::Pre(PreScript { base });
        repo.add(script).unwrap();
        repo.run(ScriptsGroup::Pre).unwrap();

        repo.scripts.first().unwrap();

        let path = &tmp_dir.path().join("pre").join("test.log");
        let body: Vec<u8> = std::fs::read(path).unwrap();
        let body = String::from_utf8(body).unwrap();
        assert_eq!("hello\n", body);

        let path = &tmp_dir.path().join("pre").join("test.err");
        let body: Vec<u8> = std::fs::read(path).unwrap();
        let body = String::from_utf8(body).unwrap();
        assert_eq!("error\n", body);
    }

    #[test]
    async fn test_clear_scripts() {
        let tmp_dir = TempDir::with_prefix("scripts-").expect("a temporary directory");
        let mut repo = ScriptsRepository::new(&tmp_dir);
        let body = "#!/bin/bash\necho hello\necho error >&2".to_string();

        let base = BaseScript {
            name: "test".to_string(),
            source: ScriptSource::Text { body },
        };
        let script = Script::Pre(PreScript { base });
        repo.add(script).expect("add the script to the repository");

        let script_path = tmp_dir.path().join("pre").join("test");
        assert!(script_path.exists());
        _ = repo.clear();
        assert!(!script_path.exists());
    }
}
