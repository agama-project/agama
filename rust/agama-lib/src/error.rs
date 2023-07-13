use curl;
use serde_json;
use std::io;
use thiserror::Error;
use zbus;

#[derive(Error, Debug)]
pub enum ServiceError {
    #[error("D-Bus service error: {0}")]
    DBus(#[from] zbus::Error),
    #[error("Unknown product '{0}'. Available products: '{1:?}'")]
    UnknownProduct(String, Vec<String>),
    // it's fine to say only "Error" because the original
    // specific error will be printed too
    #[error("Error: {0}")]
    Anyhow(#[from] anyhow::Error),
    #[error("Wrong user parameters: '{0:?}'")]
    WrongUser(Vec<String>),
}

#[derive(Error, Debug)]
pub enum ProfileError {
    #[error("Could not read the profile")]
    Unreachable(#[from] curl::Error),
    #[error("Jsonnet evaluation failed:\n{0}")]
    EvaluationError(String),
    #[error("I/O error: '{0}'")]
    InputOutputError(#[from] io::Error),
    #[error("The profile is not a valid JSON file")]
    FormatError(#[from] serde_json::Error),
}
