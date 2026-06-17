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

use crate::{
    server::{config_schema, web::Error},
    web::error::ProblemDetailsExt,
};
use agama_lib::profile::AutoyastError;
use agama_transfer::Transfer;
use agama_utils::api::ProblemDetails;
use gettextrs::gettext;

use agama_lib::profile::{AutoyastProfileImporter, ProfileEvaluator};
use aide::axum::ApiRouter;
use axum::{
    response::{IntoResponse, Response},
    routing::post,
};
use serde::Deserialize;
use std::collections::HashMap;
use thiserror::Error;
use url::Url;

#[derive(Error, Debug)]
pub enum ProfileError {
    #[error("Failed to retrieve profile from URL {url}: {source}")]
    UrlRetrieval {
        url: String,
        source: agama_transfer::Error,
    },
    #[error("Invalid UTF-8 data at URL {url}: {source}")]
    InvalidUtf8 {
        url: String,
        source: std::string::FromUtf8Error,
    },
    #[error("Failed to read profile from file {path}: {source}")]
    FileRead {
        path: String,
        source: std::io::Error,
    },
    #[error("Failed to set up profile validator: {0}")]
    ValidatorSetup(String),
    #[error("Profile validation failed: {0}")]
    ValidationError(String),
    #[error("Failed to evaluate profile: {0}")]
    EvaluationError(String),
    #[error("Invalid URL: {0}")]
    UrlParse(#[from] url::ParseError),
    #[error("AutoYaST import failed: {0}")]
    Autoyast(#[from] AutoyastError),
    #[error("{0}")]
    BadRequest(String),
}

impl IntoResponse for ProfileError {
    fn into_response(self) -> Response {
        let problem = match self {
            // Server errors (500)
            ProfileError::ValidatorSetup(_) => ProblemDetails::internal_error(self.to_string()),
            ProfileError::Autoyast(AutoyastError::Execute(..)) => {
                ProblemDetails::internal_error(self.to_string())
            }
            // Client errors (400) - specific titles for better UX
            ProfileError::ValidationError(msg) | ProfileError::EvaluationError(msg) => {
                ProblemDetails::generic(gettext("Profile validation failed"), msg)
            }
            ProfileError::UrlRetrieval { .. } | ProfileError::FileRead { .. } => {
                ProblemDetails::generic(gettext("Could not retrieve profile"), self.to_string())
            }
            ProfileError::InvalidUtf8 { .. } => {
                ProblemDetails::generic(gettext("Invalid profile encoding"), self.to_string())
            }
            ProfileError::UrlParse(_) | ProfileError::BadRequest(_) => {
                ProblemDetails::generic(gettext("Invalid profile request"), self.to_string())
            }
            ProfileError::Autoyast(_) => {
                ProblemDetails::generic(gettext("AutoYaST conversion failed"), self.to_string())
            }
        };
        problem.into_response()
    }
}

/// Sets up and returns the axum service for the auto-installation profile.
pub async fn profile_service() -> ApiRouter {
    ApiRouter::new()
        .route("/evaluate", post(evaluate))
        .route("/validate", post(validate))
        .route("/autoyast", post(autoyast))
}

/// For flexibility, the profile operations take the input as either of:
/// 1. request body
/// 2. pathname (server side)
/// 3. URL
#[derive(Deserialize, Debug)]
struct ProfileBody {
    path: Option<String>,
    url: Option<String>,
    json: Option<String>,
}

impl ProfileBody {
    /// Parses given string as a JSON and fills ProfileBody accordingly
    ///
    /// Expected format is a HashMap<String, String>, expecte keys are
    /// path, url or profile
    fn from_string(string: String) -> Self {
        let map: HashMap<String, String> = serde_json::from_str(&string).unwrap_or_default();

        Self {
            path: map.get("path").cloned(),
            url: map.get("url").cloned(),
            json: map.get("profile").cloned(),
        }
    }

    /// Retrieve a profile if specified by one of *url*, *path* or
    /// pass already obtained *json* file content
    fn retrieve_profile(&self) -> Result<Option<String>, ProfileError> {
        if let Some(url_string) = &self.url {
            let mut bytebuf = Vec::new();
            Transfer::get(url_string, &mut bytebuf, false).map_err(|source| {
                ProfileError::UrlRetrieval {
                    url: url_string.clone(),
                    source,
                }
            })?;
            let s = String::from_utf8(bytebuf).map_err(|source| ProfileError::InvalidUtf8 {
                url: url_string.clone(),
                source,
            })?;
            Ok(Some(s))
        } else if let Some(path) = &self.path {
            let s = std::fs::read_to_string(path).map_err(|source| ProfileError::FileRead {
                path: path.clone(),
                source,
            })?;
            Ok(Some(s))
        } else {
            Ok(self.json.clone())
        }
    }
}

async fn validate(body: String) -> Result<(), Response> {
    let profile = ProfileBody::from_string(body);
    let profile_content = profile
        .retrieve_profile()
        .map_err(|e| Error::from(e).bad_request())?;
    let profile_string = match profile_content {
        Some(retrieved) => retrieved,
        None => profile.json.expect("Missing profile"),
    };
    let json: serde_json::Value =
        serde_json::from_str(&profile_string).map_err(|e| Error::from(e).bad_request())?;
    config_schema::check(&json).map_err(|e| Error::from(e).bad_request())?;
    Ok(())
}

async fn evaluate(body: String) -> Result<String, ProfileError> {
    let profile = ProfileBody::from_string(body);
    let profile_string = match profile.retrieve_profile()? {
        Some(retrieved) => retrieved,
        None => profile.json.expect("Missing profile"),
    };
    let evaluator = ProfileEvaluator {};
    let output = evaluator
        .evaluate_string(&profile_string)
        .map_err(|e| ProfileError::EvaluationError(e.to_string()))?;

    Ok(output)
}

async fn autoyast(body: String) -> Result<String, ProfileError> {
    let profile = ProfileBody::from_string(body);
    if profile.url.is_none() || profile.path.is_some() || profile.json.is_some() {
        return Err(ProfileError::BadRequest(format!(
            "Only url= is expected, no path= or request body. Seen: url {}, path {}, body {}",
            profile.url.is_some(),
            profile.path.is_some(),
            profile.json.is_some()
        )));
    }

    let url = Url::parse(profile.url.as_ref().unwrap())?;
    let importer = AutoyastProfileImporter::read(&url).await?;
    Ok(importer.content)
}
