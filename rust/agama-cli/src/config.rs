use std::io::{self, Read};

use agama_lib::{
    auth::AuthToken, connection, install_settings::InstallSettings, Store as SettingsStore,
};
use clap::Subcommand;

#[derive(Subcommand, Debug)]
pub enum ConfigCommands {
    /// Generates an installation profile with the current settings.
    ///
    /// It is possible that many configuration settings do not have a value. Those settings
    /// are not included in the output.
    ///
    /// The output of command can be used as input for the "agama config load".
    Show,

    /// Reads and loads a profile from the standard input.
    Load,
}

pub async fn run(subcommand: ConfigCommands) -> anyhow::Result<()> {
    let Some(token) = AuthToken::find() else {
        println!("You need to login for generating a valid token");
        return Ok(());
    };

    let client = agama_lib::http_client(token.as_str())?;
    let store = SettingsStore::new(connection().await?, client).await?;

    match subcommand {
        ConfigCommands::Show => {
            let model = store.load().await?;
            let json = serde_json::to_string_pretty(&model)?;
            println!("{}", json);
            Ok(())
        }
        ConfigCommands::Load => {
            let mut stdin = io::stdin();
            let mut contents = String::new();
            stdin.read_to_string(&mut contents)?;
            let result: InstallSettings = serde_json::from_str(&contents)?;
            Ok(store.store(&result).await?)
        }
    }
}
