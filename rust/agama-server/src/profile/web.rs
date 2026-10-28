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

use agama_lib::profile::{AutoyastConversionResult, AutoyastProfileImporter, ProfileEvaluator};
use aide::axum::ApiRouter;
use axum::{
    response::{IntoResponse, Response},
    routing::post,
    Json,
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
    #[error("Invalid JSON produced by the AutoYaST conversion: {0}")]
    InvalidJson(#[from] serde_json::Error),
    #[error("{0}")]
    BadRequest(String),
    #[error("No profile was given. Provide one of: path, url or profile (request body).")]
    MissingProfile,
}

impl ProfileError {
    /// Converts this error into RFC 9457 Problem Details
    ///
    /// Each variant is mapped to a status code by `ProblemDetails::status_code()`:
    /// `internal_error()` results in a 500, `bad_request()` results in a 400.
    pub fn into_problem_details(self) -> ProblemDetails {
        match self {
            // Server errors (500)
            ProfileError::ValidatorSetup(_) => ProblemDetails::internal_error(self.to_string()),
            ProfileError::Autoyast(AutoyastError::Execute(..)) => {
                ProblemDetails::internal_error(self.to_string())
            }
            ProfileError::InvalidJson(_) => ProblemDetails::internal_error(self.to_string()),
            // Client errors (400) - specific titles for better UX
            ProfileError::ValidationError(msg) | ProfileError::EvaluationError(msg) => {
                ProblemDetails::bad_request(gettext("Profile validation failed"), msg)
            }
            ProfileError::UrlRetrieval { .. } | ProfileError::FileRead { .. } => {
                ProblemDetails::bad_request(gettext("Could not retrieve profile"), self.to_string())
            }
            ProfileError::InvalidUtf8 { .. } => {
                ProblemDetails::bad_request(gettext("Invalid profile encoding"), self.to_string())
            }
            ProfileError::UrlParse(_)
            | ProfileError::BadRequest(_)
            | ProfileError::MissingProfile => {
                ProblemDetails::bad_request(gettext("Invalid profile request"), self.to_string())
            }
            ProfileError::Autoyast(_) => {
                ProblemDetails::bad_request(gettext("AutoYaST conversion failed"), self.to_string())
            }
        }
    }
}

impl IntoResponse for ProfileError {
    fn into_response(self) -> Response {
        self.into_problem_details().into_response()
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

#[allow(
    clippy::result_large_err,
    reason = "Response is used to short-circuit with a pre-built HTTP response; the extra \
              bytes are negligible per-request cost (see tokio-rs/axum#3824)"
)]
async fn validate(body: String) -> Result<(), Response> {
    let profile = ProfileBody::from_string(body);
    let profile_content = profile
        .retrieve_profile()
        .map_err(|e| Error::from(e).bad_request())?;
    let profile_string = match profile_content {
        Some(retrieved) => retrieved,
        None => {
            return Err(Error::from(ProfileError::MissingProfile).bad_request());
        }
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
        None => return Err(ProfileError::MissingProfile),
    };
    let evaluator = ProfileEvaluator {};
    let output = evaluator
        .evaluate_string(&profile_string)
        .map_err(|e| ProfileError::EvaluationError(e.to_string()))?;

    Ok(output)
}

async fn autoyast(body: String) -> Result<Json<AutoyastConversionResult>, ProfileError> {
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
    let profile: serde_json::Value = serde_json::from_str(&importer.content)?;
    Ok(Json(AutoyastConversionResult {
        profile,
        unsupported: importer.unsupported,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::web::error::ProblemDetailsExt;
    use axum::http::StatusCode;

    #[test]
    fn retrieve_profile_returns_none_without_path_url_or_profile() {
        let body = ProfileBody::from_string("{}".to_string());
        let result = body.retrieve_profile().expect("should not fail");
        assert_eq!(result, None);
    }

    #[test]
    fn retrieve_profile_returns_none_for_empty_body() {
        let body = ProfileBody::from_string(String::new());
        let result = body.retrieve_profile().expect("should not fail");
        assert_eq!(result, None);
    }

    #[test]
    fn retrieve_profile_returns_inline_json() {
        let body = ProfileBody::from_string(r#"{"profile": "{\"foo\": 1}"}"#.to_string());
        let result = body.retrieve_profile().expect("should not fail");
        assert_eq!(result, Some(r#"{"foo": 1}"#.to_string()));
    }

    /// Regression test for a bug where an absent profile (no "path", "url" or
    /// "profile" key) made `retrieve_profile()` return `Ok(None)`, which the
    /// handlers then unwrapped via `.expect("Missing profile")`, panicking on
    /// a plain HTTP request instead of returning a proper error.
    #[test]
    fn missing_profile_maps_to_a_bad_request_response() {
        let error = ProfileError::MissingProfile;
        let problem = error.into_problem_details();
        assert_eq!(problem.status_code(), StatusCode::BAD_REQUEST);
    }
}
