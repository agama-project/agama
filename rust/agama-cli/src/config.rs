use crate::{
    auth,
    error::CliError,
    printers::{print, Format},
};
use agama_lib::{
    connection,
    install_settings::{InstallSettings, Scope},
    Store as SettingsStore,
};
use agama_settings::{settings::Settings, SettingObject, SettingValue};
use clap::Subcommand;
use convert_case::{Case, Casing};
use std::{collections::HashMap, error::Error, io, str::FromStr};

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

fn token() -> Option<String> {
    auth::jwt().or_else(|_| auth::agama_token()).ok()
}

pub async fn run(subcommand: ConfigCommands, format: Format) -> anyhow::Result<()> {
    let Some(token) = token() else {
        println!("You need to login for generating a valid token");
        return Ok(());
    };

    let client = agama_lib::http_client(token)?;
    let store = SettingsStore::new(connection().await?, client).await?;

    let command = parse_config_command(subcommand)?;
    match command {
        ConfigAction::Set(changes) => {
            let scopes = changes
                .keys()
                .filter_map(|k| key_to_scope(k).ok())
                .collect();
            let mut model = store.load(Some(scopes)).await?;
            for (key, value) in changes {
                model.set(&key.to_case(Case::Snake), SettingValue(value))?;
            }
            Ok(store.store(&model).await?)
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
            Ok(store.store(&model).await?)
        }
        ConfigAction::Load(path) => {
            let contents = std::fs::read_to_string(path)?;
            let result: InstallSettings = serde_json::from_str(&contents)?;
            let scopes = result.defined_scopes();
            let mut model = store.load(Some(scopes)).await?;
            model.merge(&result);
            Ok(store.store(&model).await?)
        }
    }
}

fn parse_config_command(subcommand: ConfigCommands) -> Result<ConfigAction, CliError> {
    match subcommand {
        ConfigCommands::Add { key, values } => {
            Ok(ConfigAction::Add(key, parse_keys_values(values)?))
        }
        ConfigCommands::Show => Ok(ConfigAction::Show),
        ConfigCommands::Set { values } => Ok(ConfigAction::Set(parse_keys_values(values)?)),
        ConfigCommands::Load { path } => Ok(ConfigAction::Load(path)),
    }
}

/// Split the elements on '=' to make a hash of them.
fn parse_keys_values(keys_values: Vec<String>) -> Result<HashMap<String, String>, CliError> {
    let mut changes = HashMap::new();
    for s in keys_values {
        let Some((key, value)) = s.split_once('=') else {
            return Err(CliError::MissingSeparator(s));
        };
        changes.insert(key.to_string(), value.to_string());
    }
    Ok(changes)
}

#[test]
fn test_parse_keys_values() {
    // happy path, make a hash out of the vec
    let happy_in = vec!["one=first".to_string(), "two=second".to_string()];
    let happy_out = HashMap::from([
        ("one".to_string(), "first".to_string()),
        ("two".to_string(), "second".to_string()),
    ]);
    let r = parse_keys_values(happy_in);
    assert!(r.is_ok());
    assert_eq!(r.unwrap(), happy_out);

    // an empty list is fine
    let empty_vec = Vec::<String>::new();
    let empty_hash = HashMap::<String, String>::new();
    let r = parse_keys_values(empty_vec);
    assert!(r.is_ok());
    assert_eq!(r.unwrap(), empty_hash);

    // an empty member fails
    let empty_string = vec!["".to_string(), "two=second".to_string()];
    let r = parse_keys_values(empty_string);
    assert!(r.is_err());
    assert_eq!(
        format!("{}", r.unwrap_err()),
        "Missing the '=' separator in ''"
    );
}

fn key_to_scope(key: &str) -> Result<Scope, Box<dyn Error>> {
    if let Some((name, _)) = key.split_once('.') {
        return Ok(Scope::from_str(name)?);
    }
    Err(Box::new(CliError::InvalidKeyName(key.to_string())))
}
