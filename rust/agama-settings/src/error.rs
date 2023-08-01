use thiserror::Error;

#[derive(Error, Debug)]
pub enum SettingsError {
    #[error("Unknown attribute '{0}'")]
    UnknownAttribute(String),
    #[error("Could not update '{0}': {1}")]
    UpdateFailed(String, ConversionError),
}

#[derive(Error, Debug)]
pub enum ConversionError {
    #[error("Invalid value '{0}', expected a {1}")]
    InvalidValue(String, String),
    #[error("Missing key '{0}'")]
    MissingKey(String),
}

impl SettingsError {
    /// Returns the an error with the updated attribute
    pub fn with_attr(self, name: &str) -> Self {
        match self {
            Self::UnknownAttribute(_) => Self::UnknownAttribute(name.to_string()),
            Self::UpdateFailed(_, source) => Self::UpdateFailed(name.to_string(), source),
        }
    }
}
