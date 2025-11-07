// Copyright (c) [2025] SUSE LLC
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

//! This module provides utilities to check the config schema.

use agama_lib::{
    error::ProfileError,
    profile::{ProfileValidator, ValidationOutcome},
};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("The config does not match the schema: {0}")]
    Schema(String),
    #[error(transparent)]
    ProfileValidator(#[from] ProfileError),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
}

pub fn check(json: &serde_json::Value) -> Result<(), Error> {
    let raw_json = serde_json::to_string(json)?;
    let result = ProfileValidator::default_schema()?.validate_str(&raw_json)?;
    match result {
        ValidationOutcome::Valid => Ok(()),
        ValidationOutcome::NotValid(reasons) => Err(Error::Schema(reasons.join(", "))),
    }
}
