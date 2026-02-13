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
    io,
    path::{Path, PathBuf},
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
    #[error("Text file busy")]
    TextFileBusy,
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

#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema, PartialEq)]
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

    /// Returns the relative script path.
    ///
    /// The full script path depends on the workdir. This method returns
    /// the relative path (e.g., "pre/my-script.sh").
    pub fn relative_script_path(&self) -> PathBuf {
        PathBuf::from(self.group().to_string()).join(&self.base().name)
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

    pub fn chroot(&self) -> bool {
        match self {
            Script::Post(script) => script.chroot.unwrap_or(true),
            _ => false,
        }
    }
}

/// Represents a script that runs before the installation starts.
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema, PartialEq)]
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

impl_with_file_source!(PreScript);

/// Represents a script that runs after partitioning.
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema, PartialEq)]
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

impl_with_file_source!(PostPartitioningScript);

/// Represents a script that runs after the installation finishes.
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema, PartialEq)]
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

impl_with_file_source!(PostScript);

/// Represents a script that runs during the first boot of the target system,
/// once the installation is finished.
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema, PartialEq)]
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

impl_with_file_source!(InitScript);

/// Manages a set of installation scripts.
///
/// It offers an API to add and execute installation scripts.
pub struct ScriptsRepository {
    pub workdir: PathBuf,
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
    ///
    /// * `groups`: groups of scripts to clear.
    pub fn clear(&mut self, groups: &[ScriptsGroup]) -> Result<(), Error> {
        for group in ScriptsGroup::iter().filter(|g| groups.contains(&g)) {
            let path = self.workdir.join(group.to_string());
            if path.exists() {
                std::fs::remove_dir_all(path)?;
            }
        }
        self.scripts.clear();
        Ok(())
    }

    /// Returns the scripts of the given group.
    ///
    /// - `group`: scripts group.
    pub fn by_group(&self, group: ScriptsGroup) -> Vec<&Script> {
        self.scripts.iter().filter(|s| s.group() == group).collect()
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

#[cfg(test)]
mod test {
    use std::path::PathBuf;

    use tempfile::TempDir;

    use crate::api::files::{
        scripts::ScriptsGroup, BaseScript, FileSource, InitScript, PostPartitioningScript,
        PostScript, PreScript, Script,
    };

    use super::ScriptsRepository;

    #[tokio::test]
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

    #[tokio::test]
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
        _ = repo.clear(&[ScriptsGroup::Pre]);
        assert!(!script_path.exists());

        // the directory for AutoYaST scripts is not removed
        assert!(autoyast_path.exists())
    }

    #[test]
    fn test_relative_script_path() {
        let base = BaseScript {
            name: "test".to_string(),
            source: FileSource::Text {
                content: "".to_string(),
            },
        };
        let script = Script::Pre(PreScript { base: base.clone() });
        assert_eq!(script.relative_script_path(), PathBuf::from("pre/test"));
        let script = Script::PostPartitioning(PostPartitioningScript { base: base.clone() });
        assert_eq!(
            script.relative_script_path(),
            PathBuf::from("postPartitioning/test")
        );
        let script = Script::Post(PostScript {
            base: base.clone(),
            chroot: Some(false),
        });
        assert_eq!(script.relative_script_path(), PathBuf::from("post/test"));
        let script = Script::Init(InitScript { base: base.clone() });
        assert_eq!(script.relative_script_path(), PathBuf::from("init/test"));
    }
}
