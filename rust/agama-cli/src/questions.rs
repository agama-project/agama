use agama_lib::connection;
use agama_lib::proxies::Questions1Proxy;
use anyhow::{Context, Ok};
use clap::{Args, Subcommand, ValueEnum};
use log;

#[derive(Subcommand, Debug)]
pub enum QuestionsCommands {
    /// Set mode for answering questions.
    Mode(ModesArgs),
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
// TODO when more commands is added, refactor and add it to agama-lib and share a bit of functionality
async fn set_mode(value: Modes) -> anyhow::Result<()> {
    match value {
        Modes::NonInteractive => {
            let connection = connection().await?;
            let proxy = Questions1Proxy::new(&connection)
                .await
                .context("Failed to connect to Questions service")?;

            // TODO: how to print dbus error in that anyhow?
            proxy
                .use_default_answer()
                .await
                .context("Failed to set default answer")?;
        }
        Modes::Interactive => log::info!("not implemented"), //TODO do it
    }

    Ok(())
}

pub async fn run(subcommand: QuestionsCommands) -> anyhow::Result<()> {
    match subcommand {
        QuestionsCommands::Mode(value) => set_mode(value.value).await,
    }
}
