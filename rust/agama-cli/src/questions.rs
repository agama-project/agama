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
use agama_utils::make_long;
use anyhow::anyhow;
use clap::{value_parser, Arg, ArgMatches, Command, ValueEnum};
use gettextrs::gettext;
use serde::Deserialize;

pub fn build_questions_cmd() -> Command {
    // TRANSLATORS: CLI help for: agama questions
    let about = gettext("Handle installer questions");
    // TRANSLATORS: CLI help for: agama questions (details)
    let long_about = make_long(&about, &gettext("\
        Agama might require user intervention at any time. The reasons include providing some \
        missing information (e.g., the password to decrypt a file system) or deciding what to do in \
        case of an error (e.g., cannot connect to the repository).\n\
        \n\
        This command allows answering such questions directly from the command-line."));
    Command::new("questions")
        .subcommand_required(true)
        .arg_required_else_help(true)
        .about(&about)
        .long_about(long_about)
        .subcommand(
            Command::new("mode")
                // TRANSLATORS: CLI help for: agama questions mode
                .about(gettext("Set the mode for answering questions"))
                .arg(
                    Arg::new("value")
                        .value_name("VALUE")
                        .required(true)
                        .value_parser(value_parser!(Modes))
                )
        )
        .subcommand(build_questions_answers_cmd())
        .subcommand(
            Command::new("list")
                // TRANSLATORS: CLI help for: agama questions list
                .about(gettext("Prints the list of questions that are waiting for an answer in JSON format"))
        )
        .subcommand(
            Command::new("ask")
                // TRANSLATORS: CLI help for: agama questions ask
                .about(gettext("Reads a question definition in JSON from stdin and prints the response when it is answered"))
        )
}

fn build_questions_answers_cmd() -> Command {
    // TRANSLATORS: CLI help for: agama questions answers
    let about = gettext("Load predefined answers");
    let long_about = make_long(
        &about,
        &gettext(
            // TRANSLATORS: CLI help for: agama questions answers (details)
            "\
        It allows predefining answers for specific questions in order to skip them in interactive \
        mode or change the answer in automatic mode.\n\
        \n\
        Please check Agama documentation for more details and examples: \
        https://github.com/openSUSE/agama/blob/master/doc/questions.",
        ),
    );
    Command::new("answers")
        .about(&about)
        .long_about(long_about)
        .arg(
            Arg::new("path")
                .value_name("PATH")
                .required(true)
                .help(gettext(
                    // TRANSLATORS: CLI help for: agama questions answers <PATH>
                    "Path to a file containing the answers in JSON format",
                )),
        )
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

#[derive(Deserialize)]
struct AnswersWrapper {
    #[serde(default)]
    answers: Vec<AnswerRule>,
}

async fn set_answers(client: HTTPClient, path: &str) -> anyhow::Result<()> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    let wrapper: AnswersWrapper = serde_json::from_reader(reader)?;
    client.set_answers(wrapper.answers).await?;
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

pub async fn run(client: BaseHTTPClient, sub_matches: &ArgMatches) -> anyhow::Result<()> {
    let client = HTTPClient::new(client);
    match sub_matches.subcommand() {
        Some(("mode", matches)) => {
            let value = *matches.get_one::<Modes>("value").unwrap();
            set_mode(client, value).await
        }
        Some(("answers", matches)) => {
            let path = matches.get_one::<String>("path").unwrap().clone();
            set_answers(client, &path).await
        }
        Some(("list", _)) => list_questions(client).await,
        Some(("ask", _)) => ask_question(client).await,
        _ => Ok(()),
    }
}
