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

use std::{fs::File, io::BufReader};

use agama_lib::{http::BaseHTTPClient, questions::http_client::HTTPClient};
use agama_utils::api::question::{AnswerRule, Policy, QuestionSpec};
use anyhow::anyhow;
use clap::{Args, Subcommand, ValueEnum};

// TODO: use for answers also JSON to be consistent
#[derive(Subcommand, Debug)]
pub enum QuestionsCommands {
    /// Set the mode for answering questions.
    Mode(ModesArgs),

    /// Load predefined answers.
    ///
    /// It allows predefining answers for specific questions in order to skip them in interactive
    /// mode or change the answer in automatic mode.
    ///
    /// Please check Agama documentation for more details and examples:
    /// https://github.com/openSUSE/agama/blob/master/doc/questions.
    Answers {
        /// Path to a file containing the answers in JSON format.
        path: String,
    },
    /// Prints the list of questions that are waiting for an answer in JSON format
    List,
    /// Reads a question definition in JSON from stdin and prints the response when it is answered.
    Ask,
}

#[derive(Args, Debug)]
pub struct ModesArgs {
    #[arg(value_enum)]
    value: Modes,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord, ValueEnum)]
pub enum Modes {
    /// Ask the user and block the installation.
    Interactive,
    /// Do not block the installation.
    NonInteractive,
}

async fn set_mode(client: HTTPClient, value: Modes) -> anyhow::Result<()> {
    let policy = match value {
        Modes::Interactive => Policy::User,
        Modes::NonInteractive => Policy::Auto,
    };

    client.set_mode(policy).await?;
    Ok(())
}

async fn set_answers(client: HTTPClient, path: &str) -> anyhow::Result<()> {
    let file = File::open(&path)?;
    let reader = BufReader::new(file);
    let rules: Vec<AnswerRule> = serde_json::from_reader(reader)?;
    client.set_answers(rules).await?;
    Ok(())
}

async fn list_questions(client: HTTPClient) -> anyhow::Result<()> {
    let questions = client.get_questions().await?;
    let questions_json = serde_json::to_string_pretty(&questions)?;
    println!("{}", questions_json);
    Ok(())
}

async fn ask_question(client: HTTPClient) -> anyhow::Result<()> {
    let spec: QuestionSpec = serde_json::from_reader(std::io::stdin())?;
    let question = client.create_question(&spec).await?;
    let answer = client.get_answer(question.id).await?;
    let answer_json = serde_json::to_string_pretty(&answer).map_err(|e| anyhow!(e.to_string()))?;
    println!("{}", answer_json);

    client.delete_question(question.id).await?;
    Ok(())
}

pub async fn run(client: BaseHTTPClient, subcommand: QuestionsCommands) -> anyhow::Result<()> {
    let client = HTTPClient::new(client);
    match subcommand {
        QuestionsCommands::Mode(value) => set_mode(client, value.value).await,
        QuestionsCommands::Answers { path } => set_answers(client, &path).await,
        QuestionsCommands::List => list_questions(client).await,
        QuestionsCommands::Ask => ask_question(client).await,
    }
}
