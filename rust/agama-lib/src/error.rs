use curl;
use serde_json;
use std::io;
use thiserror::Error;
use zbus;

#[derive(Error, Debug)]
pub enum ServiceError {
    #[error("D-Bus service error: {0}")]
    DBus(#[from] zbus::Error),
    // it's fine to say only "Error" because the original
    // specific error will be printed too
    #[error("Error: {0}")]
    Anyhow(#[from] anyhow::Error),
}

#[derive(Error, Debug)]
pub enum ProfileError {
    #[error("Cannot read the profile '{0}'")]
    Unreachable(#[from] curl::Error),
    #[error("No hardware information available: '{0}'")]
    NoHardwareInfo(io::Error),
    #[error("Could not evaluate the profile: '{0}'")]
    EvaluationError(io::Error),
    #[error("Input/output error: '{0}'")]
    InputOutputError(#[from] io::Error),
    #[error("The profile is not a valid JSON file")]
    FormatError(#[from] serde_json::Error),
}

#[derive(Error, Debug)]
pub enum WrongParameter {
    #[error("Unknown product '{0}'. Available products: '{1:?}'")]
    UnknownProduct(String, Vec<String>),
    #[error("Wrong user parameters: '{0:?}'")]
    WrongUser(Vec<String>)
}
