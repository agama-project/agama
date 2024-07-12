use agama_lib::proxies::Questions1Proxy;
use agama_lib::questions::http_client::HTTPClient;
use agama_lib::{connection, error::ServiceError};
use clap::{Args, Subcommand, ValueEnum};

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
        /// Path to a file containing the answers in YAML format.
        path: String,
    },
    /// prints list of questions that is waiting for answer in YAML format
    List,
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

async fn list_questions() -> Result<(), ServiceError> {
    let client = HTTPClient::new().await?;
    let questions = client.list_questions().await?;
    // FIXME: that conversion to anyhow error is nasty, but we do not expect issue
    // when questions are already read from json
    // FIXME: if performance is bad, we can skip converting json from http to struct and then
    // serialize it, but it won't be pretty string
    let questions_json =
        serde_json::to_string_pretty(&questions).map_err(Into::<anyhow::Error>::into)?;
    println!("{}", questions_json);
    Ok(())
}

pub async fn run(subcommand: QuestionsCommands) -> Result<(), ServiceError> {
    let connection = connection().await?;
    let proxy = Questions1Proxy::new(&connection).await?;

    match subcommand {
        QuestionsCommands::Mode(value) => set_mode(proxy, value.value).await,
        QuestionsCommands::Answers { path } => set_answers(proxy, path).await,
        QuestionsCommands::List => list_questions().await,
    }
}
