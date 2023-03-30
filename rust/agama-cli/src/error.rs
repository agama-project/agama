use thiserror::Error;

#[derive(Error, Debug)]
pub enum CliError {
    #[error("Invalid key name: '{0}'")]
    InvalidKeyName(String),
    #[error("Cannot perform the installation as the settings are not valid")]
    ValidationError,
}
