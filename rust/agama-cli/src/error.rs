use thiserror::Error;

#[derive(Error, Debug)]
pub enum CliError {
    #[error("Cannot perform the installation as the settings are not valid")]
    ValidationError,
    #[error("Could not start the installation")]
    InstallationError,
    #[error("No password was provided")]
    MissingPassword,
}
