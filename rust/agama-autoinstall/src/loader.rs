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

use std::{io::Write, process::Stdio};

use agama_lib::{
    http::BaseHTTPClient,
    questions::{
        http_client::HTTPClient as QuestionsHTTPClient,
        model::{GenericQuestion, Question},
    },
};
use anyhow::anyhow;

/// It loads the an Agama configuration.
///
/// This struct is responsible for reading the configuration from a given URL and,
/// if wanted, reporting and asking the user about potential problems.
///
/// It relies on Agama's command-line to generate and load the new
/// configuration. In the future, it could rely directly on Agama libraries
/// instaed of the command-line.
pub struct ConfigLoader {
    /// Questions client to interact with the user.
    questions: QuestionsHTTPClient,
}

impl ConfigLoader {
    /// Builds a new loader.
    pub fn new(http_client: BaseHTTPClient) -> anyhow::Result<Self> {
        Ok(Self {
            questions: QuestionsHTTPClient::new(http_client)?,
        })
    }

    /// Loads the configuration from the given URL.
    ///
    /// When running in interactive mode, it report errors and ask the user
    /// to continue.
    pub async fn load(&self, url: &str, interactive: bool) -> anyhow::Result<()> {
        loop {
            println!("Loading the configuration from {url}");
            match Self::load_config(url) {
                Ok(_) => return Ok(()),
                Err(error) => {
                    if !interactive || !self.should_retry(url).await? {
                        return Err(error);
                    }
                }
            }
        }
    }

    /// Imports the configuration from the given URL.
    fn load_config(url: &str) -> anyhow::Result<()> {
        let generate_cmd = std::process::Command::new("agama")
            .env("YAST_SKIP_PROFILE_FETCH_ERROR", "1")
            .env("YAST_SKIP_XML_VALIDATION", "1")
            .args(["config", "generate", url])
            .output()?;

        if !generate_cmd.status.success() {
            return Err(anyhow!(
                "Could not run generate the configuration: {:?}",
                generate_cmd.stderr,
            ));
        }

        let child = std::process::Command::new("agama")
            .args(["config", "load"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn();
        let mut child = child?;
        let mut stdin = child
            .stdin
            .take()
            .ok_or(anyhow!("Could not write to \"config load\" stdin"))?;
        stdin.write_all(&generate_cmd.stdout)?;
        drop(stdin);

        let config_cmd = child.wait_with_output()?;
        if !config_cmd.status.success() {
            let message = String::from_utf8_lossy(&config_cmd.stderr);
            return Err(anyhow!("Could not load the configuration: {}", message));
        }

        Ok(())
    }

    /// Asks the user whether to retry loading the profile.
    async fn should_retry(&self, url: &str) -> anyhow::Result<bool> {
        let text = format!(
            r#"
            It was not possible to load the configuration from {url}. Do you want to try again?"
            "#
        );
        let generic = GenericQuestion {
            id: None,
            class: "config.load_error".to_string(),
            text,
            options: vec!["Yes".to_string(), "No".to_string()],
            default_option: "No".to_string(),
            data: Default::default(),
        };
        let question = Question {
            generic,
            with_password: None,
        };
        let question = self.questions.create_question(&question).await?;
        let answer = self
            .questions
            .get_answer(question.generic.id.unwrap())
            .await?;
        Ok(answer.generic.answer == "Yes")
    }
}
