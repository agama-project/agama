use agama_lib::connection;
use agama_lib::proxies::Questions1Proxy;
use anyhow::Context;
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

async fn set_mode(proxy: Questions1Proxy<'_>, value: Modes) -> anyhow::Result<()> {
    // TODO: how to print dbus error in that anyhow?
    proxy
        .set_interactive(value == Modes::Interactive)
        .await
        .context("Failed to set mode for answering questions.")
}

async fn set_answers(proxy: Questions1Proxy<'_>, path: String) -> anyhow::Result<()> {
    // TODO: how to print dbus error in that anyhow?
    proxy
        .add_answer_file(path.as_str())
        .await
        .context("Failed to set answers from answers file")
}

pub async fn run(subcommand: QuestionsCommands) -> anyhow::Result<()> {
    let connection = connection().await?;
    let proxy = Questions1Proxy::new(&connection)
        .await
        .context("Failed to connect to Questions service")?;

    match subcommand {
        QuestionsCommands::Mode(value) => set_mode(proxy, value.value).await,
        QuestionsCommands::Answers { path } => set_answers(proxy, path).await,
    }
}
