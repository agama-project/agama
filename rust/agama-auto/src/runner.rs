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
        http_client::{HTTPClient as QuestionsHTTPClient, QuestionsHTTPClientError},
        model::{GenericQuestion, Question},
    },
};

#[derive(thiserror::Error, Debug)]
pub enum AutoInstallError {
    #[error("Could not generate the configuration.")]
    ConfigGenerationFailed,
    #[error("Could not load the configuration.")]
    ConfigLoadFailed,
    #[error("Could not run the Agama CLI")]
    CouldNotRunAgama(#[from] std::io::Error),
    #[error("Could not communicate with the user.")]
    UserCommunicationFailed(#[from] QuestionsHTTPClientError),
}

/// It drives the auto-installation process.
pub struct AutoInstallRunner {
    /// Pre-defined URLs to search for configurations.
    predefined_urls: Vec<String>,
    /// User-defined URL to the configuration.
    user_url: Option<String>,
    /// Questions client to interact with the user.
    questions: QuestionsHTTPClient,
}

impl AutoInstallRunner {
    /// Builds a new auto-installation runner.
    pub fn new(http_client: BaseHTTPClient, locations: &[&str]) -> Self {
        let locations = locations.iter().map(|l| l.to_string()).collect();
        Self {
            questions: QuestionsHTTPClient::new(http_client).unwrap(),
            predefined_urls: locations,
            user_url: None,
        }
    }

    /// Sets the user-defined URL.
    pub fn with_user_url(&mut self, url: &str) {
        self.user_url = Some(url.to_string());
    }

    /// Runs the auto-installation process.
    ///
    /// If a user-defined URL is given, it tries to fetch the configuration from
    /// that location. If it fails, it asks the user whether it should retry.
    ///
    /// If no user-defined URL is given, it searches for the configuration in
    /// the predefined locations.
    pub async fn run(&self) -> Result<(), AutoInstallError> {
        if let Some(url) = &self.user_url {
            loop {
                println!("Loading the configuration from {url}");
                match Self::import_config(url) {
                    Ok(_) => break,
                    Err(error) => {
                        if !self.should_retry(url).await? {
                            return Err(error);
                        }
                    }
                }
            }
            Ok(())
        } else {
            for url in &self.predefined_urls {
                match Self::import_config(url) {
                    Ok(_) => {
                        println!("Configuration loaded from {url}");
                        break;
                    }
                    Err(_) => {
                        println!("Could not load any configuration from {url}")
                    }
                }
            }
            Ok(())
        }
    }

    /// Imports the configuration from the given URL.
    fn import_config(url: &str) -> Result<(), AutoInstallError> {
        let generate_cmd = std::process::Command::new("agama")
            .args(["config", "generate", url])
            .output()?;

        if !generate_cmd.status.success() {
            return Err(AutoInstallError::ConfigGenerationFailed);
        }

        let child = std::process::Command::new("agama")
            .args(["config", "load"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn();
        let mut child = child.unwrap();
        let mut stdin = child.stdin.take().unwrap();
        stdin.write_all(&generate_cmd.stdout)?;
        drop(stdin);

        let output = child.wait()?;
        if output.success() {
            return Ok(());
        }
        Err(AutoInstallError::ConfigLoadFailed)
    }

    /// Asks the user whether to retry loading the profile.
    async fn should_retry(&self, url: &str) -> Result<bool, AutoInstallError> {
        let text = format!(
            "It was not possible to load the configuration from {url}. Do you want to try again?"
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
