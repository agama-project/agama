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

use crate::utils::TransferError;

#[derive(Error, Debug)]
pub enum ServiceError {
    #[error("D-Bus service error: {0}")]
    DBus(#[from] zbus::Error),
    #[error("Could not connect to Agama bus at '{0}': {1}")]
    DBusConnectionError(String, #[source] zbus::Error),
    #[error("D-Bus protocol error: {0}")]
    DBusProtocol(#[from] zbus::fdo::Error),
    #[error("Unexpected type on D-Bus '{0}'")]
    ZVariant(#[from] zvariant::Error),
    #[error(transparent)]
    HTTPError(#[from] reqwest::Error),
    // it's fine to say only "Error" because the original
    // specific error will be printed too
    // `#` is std::fmt "Alternate form", anyhow::Error interprets as "include causes"
    #[error("Error: {0:#}")]
    Anyhow(#[from] anyhow::Error),
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
    #[error("Backend call failed with status {0} and text '{1}'")]
    BackendError(u16, String),
    #[error("You are not logged in. Please use: agama auth login")]
    NotAuthenticated,
    // FIXME reroute the error to a better place
    #[error("Profile error: {0}")]
    Profile(#[from] ProfileError),
    #[error("Unsupported SSL Fingerprint algorithm '#{0}'.")]
    UnsupportedSSLFingerprintAlgorithm(String),
    #[error("DASD with channel '#{0}' not found.")]
    DASDChannelNotFound(String),
    #[error("zFCP controller with channel '#{0}' not found.")]
    ZFCPControllerNotFound(String),
}

#[derive(Error, Debug)]
pub enum ProfileError {
    #[error("Could not read the profile")]
    Unreachable(#[from] TransferError),
    #[error("Jsonnet evaluation failed:\n{0}")]
    EvaluationError(String),
    #[error("I/O error: {0}")]
    InputOutputError(#[from] io::Error),
    #[error("The profile is not a well-formed JSON file")]
    FormatError(#[from] serde_json::Error),
    // `#` is std::fmt "Alternate form", anyhow::Error interprets as "include causes"
    #[error("Error: {0:#}")]
    Anyhow(#[from] anyhow::Error),
}
