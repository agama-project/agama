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

use agama_lib::proxies::Questions1Proxy;
use agama_lib::questions::http_client::HTTPClient;
use agama_lib::{base_http_client::BaseHTTPClient, connection, error::ServiceError};
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
    /// https://github.com/openSUSE/agama/blob/master/doc/questions.md
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

async fn set_mode(proxy: Questions1Proxy<'_>, value: Modes) -> Result<(), ServiceError> {
    proxy
        .set_interactive(value == Modes::Interactive)
        .await
        .map_err(|e| e.into())
}

async fn set_answers(proxy: Questions1Proxy<'_>, path: String) -> Result<(), ServiceError> {
    proxy
        .add_answer_file(path.as_str())
        .await
        .map_err(|e| e.into())
}

async fn list_questions(client: BaseHTTPClient) -> Result<(), ServiceError> {
    let client = HTTPClient::new(client)?;
    let questions = client.list_questions().await?;
    // FIXME: if performance is bad, we can skip converting json from http to struct and then
    // serialize it, but it won't be pretty string
    let questions_json = serde_json::to_string_pretty(&questions)
        .map_err(|e| ServiceError::InternalError(e.to_string()))?;
    println!("{}", questions_json);
    Ok(())
}

async fn ask_question(client: BaseHTTPClient) -> Result<(), ServiceError> {
    let client = HTTPClient::new(client)?;
    let question = serde_json::from_reader(std::io::stdin())?;

    let created_question = client.create_question(&question).await?;
    let Some(id) = created_question.generic.id else {
        return Err(ServiceError::InternalError(
            "Created question does not get id".to_string(),
        ));
    };
    let answer = client.get_answer(id).await?;
    let answer_json = serde_json::to_string_pretty(&answer)
        .map_err(|e| ServiceError::InternalError(e.to_string()))?;
    println!("{}", answer_json);

    client.delete_question(id).await?;
    Ok(())
}

pub async fn run(
    client: BaseHTTPClient,
    subcommand: QuestionsCommands,
) -> Result<(), ServiceError> {
    let connection = connection().await?;
    let proxy = Questions1Proxy::new(&connection).await?;

    match subcommand {
        QuestionsCommands::Mode(value) => set_mode(proxy, value.value).await,
        QuestionsCommands::Answers { path } => set_answers(proxy, path).await,
        QuestionsCommands::List => list_questions(client).await,
        QuestionsCommands::Ask => ask_question(client).await,
    }
}
