// Copyright (c) [2025] SUSE LLC
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
    fs::{self, create_dir_all, File},
    io::Write,
    os::unix::fs::OpenOptionsExt,
    path::{Path, PathBuf},
    process::Output,
};

use agama_lib::{http::BaseHTTPClient, utils::Transfer};
use anyhow::anyhow;
use url::Url;

use crate::UserQuestions;

/// Downloads and runs user-defined scripts for inst.script.
pub struct ScriptsRunner {
    pub path: PathBuf,
    questions: UserQuestions,
    insecure: bool,
    idx: usize,
}

impl ScriptsRunner {
    /// Creates a new scripts runner.
    ///
    /// * `http`: base client to connect to Agama.
    /// * `path`: working directory for the runner.
    /// * `insecure`: whether to check certificates when downloading scripts.
    pub fn new<P: AsRef<Path>>(http: BaseHTTPClient, path: P, insecure: bool) -> Self {
        Self {
            path: path.as_ref().to_path_buf(),
            questions: UserQuestions::new(http),
            insecure,
            idx: 0,
        }
    }

    /// Downloads and runs the script from the given URL.
    ///
    /// It downloads the script from the given URL to the runner directory.
    /// It saves the stdout, stderr and exit code to separate files.
    ///
    /// * url: script URL, supporting agama-specific schemes.
    pub async fn run(&mut self, url: &str) -> anyhow::Result<()> {
        create_dir_all(&self.path)?;

        let file_name = self.file_name_for(&url)?;

        let path = self.path.join(&file_name);
        self.save_script(url, &path).await?;

        let output = std::process::Command::new(&path).output()?;
        self.save_logs(&path, output)?;

        Ok(())
    }

    pub fn path(&self) -> &PathBuf {
        &self.path
    }

    fn file_name_for(&mut self, url: &str) -> anyhow::Result<PathBuf> {
        let parsed = Url::parse(&url)?;

        self.idx += 1;
        let unnamed = PathBuf::from(format!("{}-unnamed.sh", self.idx));

        let Some(path) = parsed.path_segments() else {
            return Ok(unnamed);
        };

        Ok(path
            .last()
            .map(|p| PathBuf::from(format!("{}-{p}", self.idx)))
            .unwrap_or(unnamed))
    }

    async fn save_script(&self, url: &str, path: &PathBuf) -> anyhow::Result<()> {
        let mut file = Self::create_file(&path, 0o700)?;
        while let Err(error) = Transfer::get(url, &mut file, self.insecure) {
            eprintln!("Could not load configuration from {url}: {error}");
            if !self.should_retry(&url, &error.to_string()).await? {
                return Err(anyhow!(error));
            }
        }
        Ok(())
    }

    fn save_logs(&self, path: &Path, output: Output) -> anyhow::Result<()> {
        if !output.stdout.is_empty() {
            let mut file = Self::create_file(&path.with_extension("stdout"), 0o600)?;
            file.write_all(&output.stdout)?;
        }

        if !output.stderr.is_empty() {
            let mut file = Self::create_file(&path.with_extension("stderr"), 0o600)?;
            file.write_all(&output.stderr)?;
        }

        if let Some(code) = output.status.code() {
            let mut file = Self::create_file(&path.with_extension("exit"), 0o600)?;
            write!(&mut file, "{}", code)?;
        }

        Ok(())
    }

    fn create_file(path: &Path, perms: u32) -> std::io::Result<File> {
        fs::OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .mode(perms)
            .open(path)
    }

    async fn should_retry(&self, url: &str, error: &str) -> anyhow::Result<bool> {
        let msg = format!(
            r#"
                It was not possible to load the script from {url}. Do you want to try again?
                "#
        );
        self.questions.should_retry(&msg, error).await
    }
}

#[cfg(test)]
mod tests {
    use super::ScriptsRunner;
    use agama_lib::http::BaseHTTPClient;
    use tokio::test;

    fn script_path(name: &str) -> String {
        let current = std::env::current_dir().unwrap();
        format!("file://{}/tests/scripts/{name}", current.display())
    }

    fn script_runner() -> ScriptsRunner {
        let dir = tempfile::tempdir().unwrap();
        let http = BaseHTTPClient::new("http://localhost").unwrap();
        ScriptsRunner::new(http, dir.path(), false)
    }

    #[test]
    async fn test_run_script() {
        let url = script_path("success.sh");
        let mut runner = script_runner();
        runner.run(&url).await.unwrap();

        let contents = std::fs::read_to_string(runner.path().join("1-success.stdout")).unwrap();
        assert_eq!(&contents, "SUCCESS\n");
        let contents = std::fs::read_to_string(runner.path().join("1-success.exit")).unwrap();
        assert_eq!(&contents, "0");
    }

    #[test]
    async fn test_run_script_failed() {
        let url = script_path("error.sh");
        let mut runner = script_runner();
        runner.run(&url).await.unwrap();

        let contents = std::fs::read_to_string(runner.path().join("1-error.stderr")).unwrap();
        assert_eq!(&contents, "ERROR\n");
        let contents = std::fs::read_to_string(runner.path().join("1-error.exit")).unwrap();
        assert_eq!(&contents, "1");
    }
}
