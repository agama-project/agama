use std::io::{self, Read};

use crate::{
    error::CliError,
    printers::{print, Format},
};
use agama_lib::{
    auth::AuthToken, connection, install_settings::InstallSettings, Store as SettingsStore,
};
use clap::Subcommand;

#[derive(Subcommand, Debug)]
pub enum ConfigCommands {
    /// Shows the value of the configuration settings.
    ///
    /// It is possible that many configuration settings do not have a value. Those settings
    /// are not included in the output.
    ///
    /// The output of command can be used as file content for `agama config load`.
    Show,

    /// Loads the configuration from a JSON file.
    Load,
}

pub enum ConfigAction {
    Show,
    Load,
}

pub async fn run(subcommand: ConfigCommands, format: Format) -> anyhow::Result<()> {
    let Some(token) = AuthToken::find() else {
        println!("You need to login for generating a valid token");
        return Ok(());
    };

    let client = agama_lib::http_client(token.as_str())?;
    let store = SettingsStore::new(connection().await?, client).await?;

    let command = parse_config_command(subcommand)?;
    match command {
        ConfigAction::Show => {
            let model = store.load().await?;
            print(model, std::io::stdout(), format)?;
            Ok(())
        }
        ConfigAction::Load => {
            let mut stdin = io::stdin();
            let mut contents = String::new();
            stdin.read_to_string(&mut contents)?;
            let result: InstallSettings = serde_json::from_str(&contents)?;
            Ok(store.store(&result).await?)
        }
    }
}

fn parse_config_command(subcommand: ConfigCommands) -> Result<ConfigAction, CliError> {
    match subcommand {
        ConfigCommands::Show => Ok(ConfigAction::Show),
        ConfigCommands::Load => Ok(ConfigAction::Load),
    }
}
