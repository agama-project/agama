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
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Script {
    /// Script's name.
    pub name: String,
    #[serde(flatten)]
    pub source: ScriptSource,
    /// Script's group
    pub group: ScriptsGroup,
}

impl Script {
    /// Runs the script and returns the output.
    ///
    /// * `workdir`: where to write assets (script, logs and exit code).
    pub async fn run(&self, workdir: &Path) -> Result<(), ScriptError> {
        let dir = workdir.join(self.group.to_string());
        let path = dir.join(&self.name);
        let output = process::Command::new(&path).output()?;

        let stdout_log = dir.join(format!("{}.log", &self.name));
        fs::write(stdout_log, output.stdout)?;

        let stderr_log = dir.join(format!("{}.err", &self.name));
        fs::write(stderr_log, output.stderr)?;

        let status_file = dir.join(format!("{}.out", &self.name));
        fs::write(status_file, output.status.to_string())?;

        Ok(())
    }

    /// Writes the script to the file system.
    ///
    /// * `path`: path to write the script to.
    async fn write<P: AsRef<Path>>(&self, path: P) -> Result<(), ScriptError> {
        let mut file = fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .mode(0o500)
            .open(&path)?;

        match &self.source {
            ScriptSource::Text { body } => write!(file, "{}", &body)?,
            ScriptSource::Remote { url } => Transfer::get(url, file)?,
        };

        Ok(())
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
    pub async fn add(&mut self, script: Script) -> Result<(), ScriptError> {
        let workdir = self.workdir.join(script.group.to_string());
        std::fs::create_dir_all(&workdir)?;
        let path = workdir.join(&script.name);
        script.write(&path).await?;
        self.scripts.push(script);
        Ok(())
    }

    /// Removes all the scripts from the repository.
    pub fn clear(&mut self) {
        self.scripts.clear();
    }

    /// Runs the scripts in the given group.
    ///
    /// They run in the order they were added to the repository. If does not return an error
    /// if running a script fails, although it logs the problem.
    pub async fn run(&self, group: ScriptsGroup) -> Result<(), ScriptError> {
        let scripts: Vec<_> = self.scripts.iter().filter(|s| s.group == group).collect();
        for script in scripts {
            if let Err(error) = script.run(&self.workdir).await {
                log::error!(
                    "Failed to run user-defined script '{}': {:?}",
                    &script.name,
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

#[cfg(test)]
mod test {
    use tempfile::TempDir;
    use tokio::test;

    use crate::scripts::{Script, ScriptSource};

    use super::{ScriptsGroup, ScriptsRepository};

    #[test]
    async fn test_add_script() {
        let tmp_dir = TempDir::with_prefix("scripts-").expect("a temporary directory");
        let mut repo = ScriptsRepository::new(&tmp_dir);

        let script = Script {
            name: "test".to_string(),
            source: ScriptSource::Text {
                body: "".to_string(),
            },
            group: ScriptsGroup::Pre,
        };
        repo.add(script).await.unwrap();

        let script = repo.scripts.first().unwrap();
        assert_eq!("test".to_string(), script.name);
    }

    #[test]
    async fn test_run_scripts() {
        let tmp_dir = TempDir::with_prefix("scripts-").expect("a temporary directory");
        let mut repo = ScriptsRepository::new(&tmp_dir);
        let body = "#!/bin/bash\necho hello\necho error >&2".to_string();

        let script = Script {
            name: "test".to_string(),
            source: ScriptSource::Text { body },
            group: ScriptsGroup::Pre,
        };
        repo.add(script).await.unwrap();
        repo.run(ScriptsGroup::Pre).await.unwrap();

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
}
