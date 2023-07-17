use anyhow::{Ok,Context};
use clap::Subcommand;
use agama_lib::connection;
use agama_lib::proxies::Questions1Proxy;

#[derive(Subcommand, Debug)]
pub enum QuestionsCommands {
    /// To use default answers for questions.
    UseDefaults,
}

// TODO when more commands is added, refactor and add it to agama-lib and share a bit of functionality
async fn use_defaults() -> anyhow::Result<()> {
    let connection = connection().await.context("Connection to DBus failed.")?;
    let proxy = Questions1Proxy::new(&connection).await.context("Failed to connect to Questions service")?;

    // TODO: how to print dbus error in that anyhow?
    proxy.use_default_answer().await.context("Failed to set default answer")?;


    Ok(())
}

pub async fn run(subcommand: QuestionsCommands) -> anyhow::Result<()> {
    match subcommand {
        QuestionsCommands::UseDefaults => use_defaults().await,
    }
}