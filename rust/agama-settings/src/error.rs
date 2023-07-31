use thiserror::Error;

#[derive(Error, Debug)]
pub enum SettingsError {
    #[error("Unknown attribute '{0}'")]
    UnknownAttribute(String),
    #[error("Unknown collection '{0}'")]
    UnknownCollection(String),
    #[error("Invalid value '{0}', expected a {1}")]
    InvalidValue(String, String), // TODO: add the value type name
    #[error("Missing key '{0}'")]
    MissingKey(String),
}
