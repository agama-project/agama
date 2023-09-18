use agama_lib::connection;
use agama_lib::proxies::Questions1Proxy;
use anyhow::Context;
use clap::{Args, Subcommand, ValueEnum};

#[derive(Subcommand, Debug)]
pub enum QuestionsCommands {
    /// Sets the mode for answering questions.
    ///
    /// It allows to decide if questions will be interactive or
    /// if they should not block installation.
    Mode(ModesArgs),
    /// Loads predefined answers to questions.
    ///
    /// It allows to predefine answers for certain questions to skip
    /// them in interactive mode or change answer in automatic mode.
    ///
    /// For more details and examples see official Agama documentation.
    /// https://github.com/openSUSE/agama/blob/master/doc/questions.md 
    Answers {
        /// Local path to file with answers in YAML format
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
    Interactive,
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
