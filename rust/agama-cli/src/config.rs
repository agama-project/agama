use crate::error::CliError;
use crate::printers::{print, Format};
use clap::Subcommand;
use convert_case::{Case, Casing};
use agama_lib::connection;
use agama_lib::install_settings::{InstallSettings, Scope};
use agama_lib::settings::{SettingObject, SettingValue, Settings};
use agama_lib::Store as SettingsStore;
use std::str::FromStr;
use std::{collections::HashMap, error::Error, io};

#[derive(Subcommand, Debug)]
pub enum ConfigCommands {
    /// Add an element to a collection
    Add { key: String, values: Vec<String> },
    /// Set one or many installation settings
    Set {
        /// key-value pairs (e.g., user.name="Jane Doe")
        values: Vec<String>,
    },
    /// Shows the value of one or many configuration settings
    Show,
    /// Loads the configuration from a JSON file
    Load { path: String },
}

pub enum ConfigAction {
    Add(String, HashMap<String, String>),
    Set(HashMap<String, String>),
    Show,
    Load(String),
}

pub async fn run(subcommand: ConfigCommands, format: Format) -> Result<(), Box<dyn Error>> {
    let store = SettingsStore::new(connection().await?).await?;

    match parse_config_command(subcommand) {
        ConfigAction::Set(changes) => {
            let scopes = changes
                .keys()
                .filter_map(|k| key_to_scope(k).ok())
                .collect();
            let mut model = store.load(Some(scopes)).await?;
            for (key, value) in changes {
                model.set(&key.to_case(Case::Snake), SettingValue(value))?;
            }
            store.store(&model).await
        }
        ConfigAction::Show => {
            let model = store.load(None).await?;
            print(model, io::stdout(), format)?;
            Ok(())
        }
        ConfigAction::Add(key, values) => {
            let scope = key_to_scope(&key).unwrap();
            let mut model = store.load(Some(vec![scope])).await?;
            model.add(&key.to_case(Case::Snake), SettingObject::from(values))?;
            store.store(&model).await
        }
        ConfigAction::Load(path) => {
            let contents = std::fs::read_to_string(path)?;
            let result: InstallSettings = serde_json::from_str(&contents)?;
            let scopes = result.defined_scopes();
            let mut model = store.load(Some(scopes)).await?;
            model.merge(&result);
            store.store(&model).await
        }
    }
}

fn parse_config_command(subcommand: ConfigCommands) -> ConfigAction {
    match subcommand {
        ConfigCommands::Add { key, values } => ConfigAction::Add(key, parse_keys_values(values)),
        ConfigCommands::Show => ConfigAction::Show,
        ConfigCommands::Set { values } => ConfigAction::Set(parse_keys_values(values)),
        ConfigCommands::Load { path } => ConfigAction::Load(path),
    }
}

fn parse_keys_values(keys_values: Vec<String>) -> HashMap<String, String> {
    keys_values
        .iter()
        .filter_map(|s| {
            if let Some((key, value)) = s.split_once('=') {
                Some((key.to_string(), value.to_string()))
            } else {
                None
            }
        })
        .collect()
}

fn key_to_scope(key: &str) -> Result<Scope, Box<dyn Error>> {
    if let Some((name, _)) = key.split_once('.') {
        return Ok(Scope::from_str(name)?);
    }
    Err(Box::new(CliError::InvalidKeyName(key.to_string())))
}
