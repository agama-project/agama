use thiserror::Error;

#[derive(Error, Debug)]
pub enum CliError {
    #[error("Invalid key name: '{0}'")]
    InvalidKeyName(String),
    #[error("Cannot perform the installation as the settings are not valid")]
    ValidationError,
    #[error("Could not start the installation")]
    InstallationError,
    #[error("Missing the '=' separator in '{0}'")]
    MissingSeparator(String),
    #[error("Could not read the password: {0}")]
    MissingPassword(#[from] std::io::Error),
}
