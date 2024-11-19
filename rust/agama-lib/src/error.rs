// Copyright (c) [2024] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

use serde_json;
use std::io;
use thiserror::Error;
use zbus::{self, zvariant};

use crate::{base_http_client::BaseHTTPClientError, transfer::TransferError};

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
    #[error("Failed to communicate with the HTTP backend '{0}'")]
    HTTPError(#[from] reqwest::Error),
    #[error("HTTP client error: {0}")]
    HTTPClientError(#[from] BaseHTTPClientError),
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
    #[error("Unknown installation phase: {0}")]
    UnknownInstallationPhase(u32),
    #[error("Question with id {0} does not exist")]
    QuestionNotExist(u32),
    // Specific error when something does not work as expected, but it is not user fault
    #[error("Internal error. Please report a bug and attach logs. Details: {0}")]
    InternalError(String),
    #[error("Could not read the file: '{0}'")]
    CouldNotTransferFile(#[from] TransferError),
}

#[derive(Error, Debug)]
pub enum ProfileError {
    #[error("Could not read the profile")]
    Unreachable(#[from] TransferError),
    #[error("Jsonnet evaluation failed:\n{0}")]
    EvaluationError(String),
    #[error("I/O error")]
    InputOutputError(#[from] io::Error),
    #[error("The profile is not a valid JSON file")]
    FormatError(#[from] serde_json::Error),
    #[error("Error: {0}")]
    Anyhow(#[from] anyhow::Error),
}
