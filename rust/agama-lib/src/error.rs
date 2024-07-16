use curl;
use serde_json;
use std::io;
use thiserror::Error;
use zbus::{self, zvariant};

#[derive(Error, Debug)]
pub enum ServiceError {
    #[error("Cannot generate Agama logs: {0}")]
    CannotGenerateLogs(String),
    #[error("D-Bus service error: {0}")]
    DBus(#[from] zbus::Error),
    #[error("Could not connect to Agama bus at '{0}': {1}")]
    DBusConnectionError(String, #[source] zbus::Error),
    #[error("D-Bus protocol error: {0}")]
    DBusProtocol(#[from] zbus::fdo::Error),
    #[error("Unexpected type on D-Bus '{0}'")]
    ZVariant(#[from] zvariant::Error),
    #[error("Failed to communicate with HTTP backend '{0}'")]
    HTTPError(#[from] reqwest::Error),
    // it's fine to say only "Error" because the original
    // specific error will be printed too
    #[error("Error: {0}")]
    Anyhow(#[from] anyhow::Error),
    // FIXME: It is too generic and starting to looks like an Anyhow error
    #[error("Network client error: '{0}'")]
    NetworkClientError(String),
    #[error("Wrong user parameters: '{0:?}'")]
    WrongUser(Vec<String>),
    #[error("Registration failed: '{0}'")]
    FailedRegistration(String),
    #[error("Failed to find these patterns: {0:?}")]
    UnknownPatterns(Vec<String>),
    #[error("Passed json data is not correct: {0}")]
    InvalidJson(#[from] serde_json::Error),
    #[error("Could not perform action '{0}'")]
    UnsuccessfulAction(String),
    #[error("Unknown installation phase: '{0}")]
    UnknownInstallationPhase(u32),
    #[error("Backend call failed with status '{0}' and text '{1}'")]
    BackendError(u16, String),
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
    #[error("Error: {0}")]
    Anyhow(#[from] anyhow::Error),
}
