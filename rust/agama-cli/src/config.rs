use std::{
    io::{self, Read},
    path::PathBuf,
    process::Command,
};

use crate::show_progress;
use agama_lib::{
    auth::AuthToken, connection, install_settings::InstallSettings, Store as SettingsStore,
};
use anyhow::anyhow;
use clap::Subcommand;
use std::io::Write;
use tempfile::Builder;

const DEFAULT_EDITOR: &str = "/usr/bin/vi";

#[derive(Subcommand, Debug)]
pub enum ConfigCommands {
    /// Generate an installation profile with the current settings.
    ///
    /// It is possible that many configuration settings do not have a value. Those settings
    /// are not included in the output.
    ///
    /// The output of command can be used as input for the "agama config load".
    Show,

    /// Read and load a profile from the standard input.
    Load,

    /// Edit and update installation option using an external editor.
    ///
    /// The changes are not applied if the editor exits with an error code.
    ///
    /// If an editor is not specified, it honors the EDITOR environment variable. It falls back to
    /// `/usr/bin/vi` as a last resort.
    Edit {
        /// Editor command (including additional arguments if needed)
        #[arg(short, long)]
        editor: Option<String>,
    },
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
        ConfigCommands::Edit { editor } => {
            let model = store.load().await?;
            let editor = editor
                .or_else(|| std::env::var("EDITOR").ok())
                .unwrap_or(DEFAULT_EDITOR.to_string());
            let result = edit(&model, &editor)?;
            tokio::spawn(async move {
                show_progress().await.unwrap();
            });
            store.store(&result).await?;
            Ok(())
        }
    }
}

/// Edit the installation settings using an external editor.
///
/// If the editor does not return a successful error code, it returns an error.
///
/// * `model`: current installation settings.
/// * `editor`: editor command.
fn edit(model: &InstallSettings, editor: &str) -> anyhow::Result<InstallSettings> {
    let content = serde_json::to_string_pretty(model)?;
    let mut file = Builder::new().suffix(".json").tempfile()?;
    let path = PathBuf::from(file.path());
    write!(file, "{}", content)?;

    let mut command = editor_command(&editor);
    let status = command.arg(path.as_os_str()).status()?;
    if status.success() {
        return Ok(InstallSettings::from_file(path)?);
    }

    Err(anyhow!(
        "Ignoring the changes becase the editor was closed with an error code."
    ))
}

/// Return the Command to run the editor.
///
/// Separate the program and the arguments and build a Command struct.
///
/// * `command`: command to run as editor.
fn editor_command(command: &str) -> Command {
    let mut parts = command.split_whitespace();
    let program = parts.next().unwrap_or(DEFAULT_EDITOR);

    let mut command = Command::new(program);
    command.args(parts.collect::<Vec<&str>>());
    command
}
