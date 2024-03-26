use agama_locale_data::InvalidKeymap;

#[derive(thiserror::Error, Debug)]
pub enum LocaleError {
    #[error("Unknown locale code: {0}")]
    UnknownLocale(String),
    #[error("Unknown timezone: {0}")]
    UnknownTimezone(String),
    #[error("Invalid keymap: {0}")]
    InvalidKeymap(#[from] InvalidKeymap),
    #[error("Could not apply the changes")]
    Commit(#[from] std::io::Error),
}
