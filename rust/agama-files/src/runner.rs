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
    fs,
    path::{Path, PathBuf},
    process::Output,
};

use agama_utils::{
    actor::Handler,
    api::{files::Script, question::QuestionSpec, Scope},
    command::run_with_retry,
    progress,
    question::{self, ask_question},
};
use tokio::process;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("The script failed")]
    Script(Output),
}

/// Implements the logic to run a script.
///
/// It takes care of running the script, reporting errors (and asking whether to retry) and write
/// the logs.
pub struct ScriptsRunner {
    progress: Handler<progress::Service>,
    questions: Handler<question::Service>,
    install_dir: PathBuf,
    workdir: PathBuf,
}

impl ScriptsRunner {
    /// Creates a new runner.
    ///
    /// * `install_dir`: directory where the system is being installed. It is relevant for
    ///   chrooted scripts.
    /// * `workdir`: scripts work directory.
    /// * `progress`: handler to report the progress.
    /// * `questions`: handler to interact with the user.
    pub fn new<P: AsRef<Path>>(
        install_dir: P,
        workdir: P,
        progress: Handler<progress::Service>,
        questions: Handler<question::Service>,
    ) -> Self {
        Self {
            progress,
            questions,
            install_dir: install_dir.as_ref().to_path_buf(),
            workdir: workdir.as_ref().to_path_buf(),
        }
    }

    /// Runs the given scripts.
    ///
    /// It runs each script. If something goes wrong, it reports the problem to the user through
    /// the questions mechanism.
    ///
    /// * `scripts`: scripts to run.
    pub async fn run(&self, scripts: &[&Script]) -> Result<(), Error> {
        self.start_progress(scripts);

        for script in scripts {
            _ = self
                .progress
                .cast(progress::message::Next::new(Scope::Files));
            self.run_script(script).await;
        }

        _ = self
            .progress
            .cast(progress::message::Finish::new(Scope::Files));
        Ok(())
    }

    /// Runs the script.
    ///
    /// If the script fails, it asks the user whether it should try again.
    async fn run_script(&self, script: &Script) {
        loop {
            let path = self
                .workdir
                .join(script.group().to_string())
                .join(script.name());

            let Err(error) = self.run_command(&path, script.chroot()).await else {
                return;
            };

            if !self.should_retry(&script, error).await {
                return;
            }
        }
    }

    ///  Asks the user whether it should try to run the script again.
    async fn should_retry(&self, script: &Script, error: Error) -> bool {
        let text = format!(
            "Running the script '{}' failed. Do you want to try again?",
            script.name()
        );
        let mut question = QuestionSpec::new(&text, "scripts.retry").with_yes_no_actions();

        if let Error::Script(output) = error {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            let code = output.status.to_string();
            question =
                question.with_data(&[("stdout", &stdout), ("stderr", &stderr), ("code", &code)]);
        }

        let answer = ask_question(&self.questions, question).await.unwrap();

        return answer.action == "Yes";
    }

    /// Runs the script at the given path.
    ///
    /// * `path`: script's path.
    /// * `chroot`: whether to run the script in a chroot.
    async fn run_command<P: AsRef<Path>>(&self, path: P, chroot: bool) -> Result<(), Error> {
        let path = path.as_ref();
        let command = if chroot {
            let mut command = process::Command::new("chroot");
            command.args([&self.install_dir, path]);
            command
        } else {
            process::Command::new(path)
        };

        let output = run_with_retry(command)
            .await
            .inspect_err(|e| tracing::error!("Error executing the script: {e}"))?;

        fs::write(path.with_extension("log"), output.stdout.clone())?;
        fs::write(path.with_extension("err"), output.stderr.clone())?;
        fs::write(path.with_extension("out"), output.status.to_string())?;

        if !output.status.success() {
            return Err(Error::Script(output));
        }

        Ok(())
    }

    /// Ancillary function to start the progress.
    fn start_progress(&self, scripts: &[&Script]) {
        let messages: Vec<_> = scripts
            .iter()
            .map(|s| format!("Running user script '{}'", s.name()))
            .collect();
        let steps: Vec<_> = messages.iter().map(|s| s.as_ref()).collect();
        let progress_action = progress::message::StartWithSteps::new(Scope::Files, &steps);
        _ = self.progress.cast(progress_action);
    }
}
