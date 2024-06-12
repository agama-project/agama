use thiserror::Error;

#[derive(Error, Debug)]
pub enum CliError {
    #[error("Cannot perform the installation as the settings are not valid")]
    ValidationError,
    #[error("Could not start the installation")]
    InstallationError,
    #[error("Could not read the password: {0}")]
    MissingPassword(#[from] std::io::Error),
}
