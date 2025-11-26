// Copyright (c) [2024-2025] SUSE LLC
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
    fs, io,
    path::{Path, PathBuf},
    process,
};

use crate::api::files::{FileSource, FileSourceError, WithFileSource};
use agama_transfer::Error as TransferError;
use serde::{Deserialize, Serialize};
use strum::{EnumIter, IntoEnumIterator};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Could not fetch the profile: '{0}'")]
    Unreachable(#[from] TransferError),
    #[error("I/O error: '{0}'")]
    InputOutputError(#[from] io::Error),
    #[error("Wrong script type")]
    WrongScriptType,
    #[error(transparent)]
    FileSourceError(#[from] FileSourceError),
}

macro_rules! impl_with_file_source {
    ($struct:ident) => {
        impl WithFileSource for $struct {
            /// File source.
            fn file_source(&self) -> &FileSource {
                &self.base.source
            }

            /// Mutable file source.
            fn file_source_mut(&mut self) -> &mut FileSource {
                &mut self.base.source
            }
        }
    };
}

#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    strum::Display,
    EnumIter,
    Serialize,
    Deserialize,
    utoipa::ToSchema,
)]
#[strum(serialize_all = "camelCase")]
#[serde(rename_all = "camelCase")]
pub enum ScriptsGroup {
    Pre,
    PostPartitioning,
    Post,
    Init,
}

#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct BaseScript {
    pub name: String,
    #[serde(flatten)]
    pub source: FileSource,
}

impl BaseScript {
    /// Writes the script to the given directory.
    ///
    /// * `workdir`: directory to write the script to.
    fn write<P: AsRef<Path>>(&self, workdir: P) -> Result<(), Error> {
        let script_path = workdir.as_ref().join(&self.name);
        std::fs::create_dir_all(script_path.parent().unwrap())?;
        self.source.write(&script_path, 0o700)?;
        Ok(())
    }
}

/// Represents a script to run as part of the installation process.
///
/// There are different types of scripts that can run at different stages of the installation.
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Script {
    Pre(PreScript),
    PostPartitioning(PostPartitioningScript),
    Post(PostScript),
    Init(InitScript),
}

impl Script {
    fn base(&self) -> &BaseScript {
        match self {
            Script::Pre(inner) => &inner.base,
            Script::PostPartitioning(inner) => &inner.base,
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
    pub fn write<P: AsRef<Path>>(&self, workdir: P) -> Result<(), Error> {
        let path = workdir.as_ref().join(self.group().to_string());
        self.base().write(&path)
    }

    /// Script's group.
    ///
    /// It determines whether the script runs.
    pub fn group(&self) -> ScriptsGroup {
        match self {
            Script::Pre(_) => ScriptsGroup::Pre,
            Script::PostPartitioning(_) => ScriptsGroup::PostPartitioning,
            Script::Post(_) => ScriptsGroup::Post,
            Script::Init(_) => ScriptsGroup::Init,
        }
    }

    /// Runs the script in the given work directory.
    ///
    /// It saves the logs and the exit status of the execution.
    ///
    /// * `workdir`: where to run the script.
    pub fn run<P: AsRef<Path>>(&self, workdir: P) -> Result<(), Error> {
        let path = workdir
            .as_ref()
            .join(self.group().to_string())
            .join(self.name());
        let runner = match self {
            Script::Pre(inner) => &inner.runner(),
            Script::PostPartitioning(inner) => &inner.runner(),
            Script::Post(inner) => &inner.runner(),
            Script::Init(inner) => &inner.runner(),
        };

        let Some(runner) = runner else {
            tracing::info!("No runner defined for script {:?}", &self);
            return Ok(());
        };

        runner.run(&path)
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
    type Error = Error;

    fn try_from(value: Script) -> Result<Self, Self::Error> {
        match value {
            Script::Pre(inner) => Ok(inner),
            _ => Err(Error::WrongScriptType),
        }
    }
}

impl WithRunner for PreScript {}

impl_with_file_source!(PreScript);

/// Represents a script that runs after partitioning.
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct PostPartitioningScript {
    #[serde(flatten)]
    pub base: BaseScript,
}

impl From<PostPartitioningScript> for Script {
    fn from(value: PostPartitioningScript) -> Self {
        Self::PostPartitioning(value)
    }
}

impl TryFrom<Script> for PostPartitioningScript {
    type Error = Error;

    fn try_from(value: Script) -> Result<Self, Self::Error> {
        match value {
            Script::PostPartitioning(inner) => Ok(inner),
            _ => Err(Error::WrongScriptType),
        }
    }
}

impl WithRunner for PostPartitioningScript {}

impl_with_file_source!(PostPartitioningScript);

/// Represents a script that runs after the installation finishes.
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct PostScript {
    #[serde(flatten)]
    pub base: BaseScript,
    /// Whether the script should be run in a chroot environment.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chroot: Option<bool>,
}

impl From<PostScript> for Script {
    fn from(value: PostScript) -> Self {
        Self::Post(value)
    }
}

impl TryFrom<Script> for PostScript {
    type Error = Error;

    fn try_from(value: Script) -> Result<Self, Self::Error> {
        match value {
            Script::Post(inner) => Ok(inner),
            _ => Err(Error::WrongScriptType),
        }
    }
}

impl WithRunner for PostScript {
    fn runner(&self) -> Option<ScriptRunner> {
        Some(ScriptRunner::new().with_chroot(self.chroot.unwrap_or(true)))
    }
}

impl_with_file_source!(PostScript);

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
    type Error = Error;

    fn try_from(value: Script) -> Result<Self, Self::Error> {
        match value {
            Script::Init(inner) => Ok(inner),
            _ => Err(Error::WrongScriptType),
        }
    }
}

impl WithRunner for InitScript {
    /// Returns the runner for the script if any.
    fn runner(&self) -> Option<ScriptRunner> {
        None
    }
}

impl_with_file_source!(InitScript);

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
    pub fn add(&mut self, script: Script) -> Result<(), Error> {
        script.write(&self.workdir)?;
        self.scripts.push(script);
        Ok(())
    }

    /// Removes all the scripts from the repository.
    pub fn clear(&mut self) -> Result<(), Error> {
        for group in ScriptsGroup::iter() {
            let path = self.workdir.join(group.to_string());
            if path.exists() {
                std::fs::remove_dir_all(path)?;
            }
        }
        self.scripts.clear();
        Ok(())
    }

    /// Runs the scripts in the given group.
    ///
    /// They run in the order they were added to the repository. If does not return an error
    /// if running a script fails, although it logs the problem.
    pub fn run(&self, group: ScriptsGroup) {
        let scripts: Vec<_> = self.scripts.iter().filter(|s| s.group() == group).collect();
        tracing::info!("Running {} scripts", scripts.len());
        for script in scripts {
            if let Err(error) = script.run(&self.workdir) {
                tracing::error!(
                    "Failed to run user-defined script '{}': {:?}",
                    &script.name(), // TODO: implement
                    error
                );
            }
        }
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
#[derive(Default)]
struct ScriptRunner {
    chroot: bool,
}

impl ScriptRunner {
    fn new() -> Self {
        Default::default()
    }

    fn with_chroot(mut self, chroot: bool) -> Self {
        self.chroot = chroot;
        self
    }

    fn run<P: AsRef<Path>>(&self, path: P) -> Result<(), Error> {
        let path = path.as_ref();
        let output = if self.chroot {
            process::Command::new("chroot")
                .args(["/mnt", &path.to_string_lossy()])
                .output()
        } else {
            process::Command::new(path).output()
        };

        let output = output.inspect_err(|e| tracing::error!("Error executing the script: {e}"))?;
        fs::write(path.with_extension("log"), output.stdout)?;
        fs::write(path.with_extension("err"), output.stderr)?;
        fs::write(path.with_extension("out"), output.status.to_string())?;

        Ok(())
    }
}

#[cfg(test)]
mod test {
    use tempfile::TempDir;
    use tokio::test;

    use crate::api::files::{BaseScript, FileSource, PreScript, Script};

    use super::{ScriptsGroup, ScriptsRepository};

    #[test]
    async fn test_add_script() {
        let tmp_dir = TempDir::with_prefix("scripts-").expect("a temporary directory");
        let mut repo = ScriptsRepository::new(&tmp_dir);

        let base = BaseScript {
            name: "test".to_string(),
            source: FileSource::Text {
                content: "".to_string(),
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
        let content = "#!/bin/bash\necho hello\necho error >&2".to_string();

        let base = BaseScript {
            name: "test".to_string(),
            source: FileSource::Text { content },
        };
        let script = Script::Pre(PreScript { base });
        repo.add(script).unwrap();
        repo.run(ScriptsGroup::Pre);

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
        let content = "#!/bin/bash\necho hello\necho error >&2".to_string();

        let base = BaseScript {
            name: "test".to_string(),
            source: FileSource::Text { content },
        };
        let script = Script::Pre(PreScript { base });
        repo.add(script).expect("add the script to the repository");

        let autoyast_path = tmp_dir.path().join("autoyast");
        std::fs::create_dir(&autoyast_path).unwrap();

        let script_path = tmp_dir.path().join("pre").join("test");
        assert!(script_path.exists());
        _ = repo.clear();
        assert!(!script_path.exists());

        // the directory for AutoYaST scripts is not removed
        assert!(autoyast_path.exists())
    }
}
