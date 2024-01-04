use curl;
use serde_json;
use std::io;
use thiserror::Error;
use zbus;

#[derive(Error, Debug)]
pub enum ServiceError {
    #[error("D-Bus service error: {0}")]
    DBus(#[from] zbus::Error),
    #[error("Could not connect to Agama bus at '{0}': {1}")]
    DBusConnectionError(String, #[source] zbus::Error),
    // it's fine to say only "Error" because the original
    // specific error will be printed too
    #[error("Error: {0}")]
    Anyhow(#[from] anyhow::Error),
    #[error("Wrong user parameters: '{0:?}'")]
    WrongUser(Vec<String>),
    #[error("Registration failed: '{0}'")]
    FailedRegistration(String),
    #[error("Failed to find these patterns: {0:?}")]
    UnknownPatterns(Vec<String>),
    #[error("Could not perform action '{0}'")]
    UnsuccessfulAction(String),
}

#[derive(Error, Debug)]
pub enum ProfileError {
    #[error("Could not read the profile")]
    Unreachable(#[from] curl::Error),
    #[error("Jsonnet evaluation failed:\n{0}")]
    EvaluationError(String),
    #[error("I/O error")]
    InputOutputError(#[from] io::Error),
    #[error("The profile is not a valid JSON file")]
    FormatError(#[from] serde_json::Error),
}
