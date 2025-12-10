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
    fs::File,
    io::{self, BufReader, Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    process::ExitStatus,
};

use agama_utils::{
    actor::Handler,
    api::{files::Script, question::QuestionSpec, Scope},
    command::{create_log_file, run_with_retry},
    progress,
    question::{self, ask_question},
};
use tokio::process;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("The script failed")]
    Script { status: ExitStatus, stderr: String },
    #[error(transparent)]
    Question(#[from] question::AskError),
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
            self.run_script(script).await?;
        }

        _ = self
            .progress
            .cast(progress::message::Finish::new(Scope::Files));
        Ok(())
    }

    /// Runs the script.
    ///
    /// If the script fails, it asks the user whether it should try again.
    async fn run_script(&self, script: &Script) -> Result<(), Error> {
        loop {
            let path = self
                .workdir
                .join(script.group().to_string())
                .join(script.name());

            let Err(error) = self.run_command(&path, script.chroot()).await else {
                return Ok(());
            };

            if !self.should_retry(&script, error).await? {
                return Ok(());
            }
        }
    }

    ///  Asks the user whether it should try to run the script again.
    async fn should_retry(&self, script: &Script, error: Error) -> Result<bool, Error> {
        let text = format!(
            "Running the script '{}' failed. Do you want to try again?",
            script.name()
        );
        let mut question = QuestionSpec::new(&text, "scripts.retry").with_yes_no_actions();

        if let Error::Script { status, stderr } = error {
            let exit_status = status
                .code()
                .map(|c| c.to_string())
                .unwrap_or("unknown".to_string());
            question = question.with_data(&[
                ("name", script.name()),
                ("stderr", &stderr),
                ("exit_status", &exit_status),
            ]);
        }

        let answer = ask_question(&self.questions, question).await?;
        return Ok(answer.action == "Yes");
    }

    /// Runs the script at the given path.
    ///
    /// * `path`: script's path.
    /// * `chroot`: whether to run the script in a chroot.
    async fn run_command<P: AsRef<Path>>(&self, path: P, chroot: bool) -> Result<(), Error> {
        const STDERR_SIZE: u64 = 512;

        let path = path.as_ref();
        let stdout_file = path.with_extension("stdout");
        let stderr_file = path.with_extension("stderr");

        let mut command = if chroot {
            let mut command = process::Command::new("chroot");
            command.args([&self.install_dir, path]);
            command
        } else {
            process::Command::new(path)
        };

        command
            .stdout(create_log_file(&stdout_file)?)
            .stderr(create_log_file(&stderr_file)?);

        let output = run_with_retry(command)
            .await
            .inspect_err(|e| println!("Error executing the script: {e}"))?;

        if let Some(code) = output.status.code() {
            let mut file = create_log_file(&path.with_extension("exit"))?;
            write!(&mut file, "{}", code)?;
        }

        if !output.status.success() {
            let stderr = Self::read_n_last_bytes(&stderr_file, STDERR_SIZE)?;
            return Err(Error::Script {
                status: output.status,
                stderr,
            });
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

    /// Reads the last n bytes of the file and returns them as a string.
    fn read_n_last_bytes(path: &Path, n_bytes: u64) -> io::Result<String> {
        let mut file = File::open(path)?;
        let file_size = file.metadata()?.len();
        let offset = file_size.saturating_sub(n_bytes);
        file.seek(SeekFrom::Start(offset))?;
        let bytes_to_read = (file_size - offset) as usize;
        let mut buffer = Vec::with_capacity(bytes_to_read);
        _ = file.read_to_end(&mut buffer)?;
        let string = String::from_utf8_lossy(&buffer);
        Ok(string.into_owned())
    }
}

#[cfg(test)]
mod tests {
    use agama_utils::{
        api::{
            event,
            files::{BaseScript, FileSource, PostScript},
            question::Answer,
            Event,
        },
        question::test_utils::wait_for_question,
    };
    use tempfile::TempDir;
    use test_context::{test_context, AsyncTestContext};
    use tokio::sync::broadcast;

    use super::*;

    struct Context {
        // runner: ScriptsRunner,
        install_dir: PathBuf,
        workdir: PathBuf,
        progress: Handler<progress::Service>,
        questions: Handler<question::Service>,
        events_rx: event::Receiver,
        tmp_dir: TempDir,
    }

    impl AsyncTestContext for Context {
        async fn setup() -> Context {
            let tmp_dir = TempDir::with_prefix("scripts-").expect("a temporary directory");

            let (events_tx, events_rx) = broadcast::channel::<Event>(16);
            let install_dir = tmp_dir.path().join("mnt");
            let workdir = tmp_dir.path().join("scripts");
            let questions = question::start(events_tx.clone()).await.unwrap();
            let progress = progress::Service::starter(events_tx.clone()).start();

            Context {
                events_rx,
                install_dir,
                workdir,
                progress,
                questions,
                // runner,
                tmp_dir,
            }
        }
    }

    impl Context {
        pub fn runner(&self) -> ScriptsRunner {
            ScriptsRunner::new(
                self.install_dir.clone(),
                self.workdir.clone(),
                self.progress.clone(),
                self.questions.clone(),
            )
        }
        pub fn setup_script(&self, content: &str, chroot: bool) -> Script {
            let base = BaseScript {
                name: "test.sh".to_string(),
                source: FileSource::Text {
                    content: content.to_string(),
                },
            };
            let script = Script::Post(PostScript {
                base,
                chroot: Some(chroot),
            });
            script
                .write(&self.workdir)
                .expect("Could not write the script");
            script
        }
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_run_scripts_success(ctx: &mut Context) -> Result<(), Error> {
        let file = ctx.tmp_dir.path().join("file-1.txt");
        let content = format!(
            "#!/usr/bin/bash\necho hello\necho error >&2\ntouch {}",
            file.display()
        );
        let script = ctx.setup_script(&content, false);
        let scripts = vec![&script];

        let runner = ctx.runner();
        runner.run(&scripts).await.unwrap();

        let path = &ctx.workdir.join("post").join("test.stdout");
        let body: Vec<u8> = std::fs::read(path).unwrap();
        let body = String::from_utf8(body).unwrap();
        assert_eq!("hello\n", body);

        let path = &ctx.workdir.join("post").join("test.stderr");
        let body: Vec<u8> = std::fs::read(path).unwrap();
        let body = String::from_utf8(body).unwrap();
        assert_eq!("error\n", body);

        let path = &ctx.workdir.join("post").join("test.exit");
        let body: Vec<u8> = std::fs::read(path).unwrap();
        let body = String::from_utf8(body).unwrap();
        assert_eq!("0", body);

        assert!(std::fs::exists(file).unwrap());
        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_run_scripts_retry(ctx: &mut Context) -> Result<(), Error> {
        let file = ctx.tmp_dir.path().join("file-1.txt");
        let content = format!(
            "#!/usr/bin/bash\necho \"hello\"\necho \"line\" >>{}\nagama-unknown\n",
            file.display()
        );
        let script = ctx.setup_script(&content, false);

        let runner = ctx.runner();
        tokio::task::spawn(async move {
            let scripts = vec![&script];
            _ = runner.run(&scripts).await;
        });

        // Retry
        let id = wait_for_question(&mut ctx.events_rx)
            .await
            .expect("Did not receive a question");
        _ = ctx.questions.cast(question::message::Answer {
            id,
            answer: Answer::new("Yes"),
        });

        // Check the question content
        let questions = ctx
            .questions
            .call(question::message::Get)
            .await
            .expect("Could not get the questions");
        let question = questions.first().unwrap();
        assert_eq!(question.spec.data.get("name"), Some(&"test.sh".to_string()));
        assert_eq!(
            question.spec.data.get("exit_status"),
            Some(&"127".to_string())
        );
        let stderr = question.spec.data.get("stderr").unwrap();
        assert!(stderr.contains("agama-unknown"));

        // Do not retry
        let id = wait_for_question(&mut ctx.events_rx)
            .await
            .expect("Did not receive a question");
        _ = ctx.questions.cast(question::message::Answer {
            id,
            answer: Answer::new("No"),
        });

        // Check the generated files
        let path = &ctx.workdir.join("post").join("test.stderr");
        let body: Vec<u8> = std::fs::read(path).unwrap();
        let body = String::from_utf8(body).unwrap();
        assert!(body.contains("agama-unknown"));

        let body: Vec<u8> = std::fs::read(&file).unwrap();
        let body = String::from_utf8(body).unwrap();
        assert_eq!("line\nline\n", body);

        Ok(())
    }
}
