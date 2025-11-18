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

use anyhow::Context;

use agama_lib::utils::Transfer;
use agama_lib::{
    error::ServiceError,
    profile::{AutoyastProfileImporter, ProfileEvaluator, ProfileValidator, ValidationOutcome},
};
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;
use thiserror::Error;
use url::Url;

#[derive(Error, Debug)]
pub struct ProfileServiceError {
    source: anyhow::Error,
    http_status: StatusCode,
}

impl std::fmt::Display for ProfileServiceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // `#` is std::fmt "Alternate form", anyhow::Error interprets as "include causes"
        write!(f, "{:#}", &self.source)
    }
}

// Make a 400 response
// ```
// let r: Result<T, anyhow::Error> = foo();
// r?
// ```
impl From<anyhow::Error> for ProfileServiceError {
    fn from(e: anyhow::Error) -> Self {
        Self {
            source: e,
            http_status: StatusCode::BAD_REQUEST,
        }
    }
}

// Make a 500 response
// ```
// let r: Result<T, anyhow::Error> = foo();
// r.map_err(make_internal)?
// ```
fn make_internal(anyhow: anyhow::Error) -> ProfileServiceError {
    ProfileServiceError {
        http_status: StatusCode::INTERNAL_SERVER_ERROR,
        source: anyhow,
    }
}

impl IntoResponse for ProfileServiceError {
    fn into_response(self) -> Response {
        let body = json!({
            "error": self.to_string()
        });
        (self.http_status, Json(body)).into_response()
    }
}

/// Sets up and returns the axum service for the auto-installation profile.
pub async fn profile_service() -> Result<Router, ServiceError> {
    let router = Router::new()
        .route("/evaluate", post(evaluate))
        .route("/validate", post(validate))
        .route("/autoyast", post(autoyast));
    Ok(router)
}

/// For flexibility, the profile operations take the input as either of:
/// 1. request body
/// 2. pathname (server side)
/// 3. URL
#[derive(Deserialize, utoipa::IntoParams, Debug)]
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
    fn retrieve_profile(&self) -> Result<Option<String>, ProfileServiceError> {
        if let Some(url_string) = &self.url {
            let mut bytebuf = Vec::new();
            Transfer::get(url_string, &mut bytebuf, false)
                .context(format!("Retrieving data from URL {}", url_string))?;
            let s = String::from_utf8(bytebuf)
                .context(format!("Invalid UTF-8 data at URL {}", url_string))?;
            Ok(Some(s))
        } else if let Some(path) = &self.path {
            let s = std::fs::read_to_string(path).context(format!("Reading from file {}", path))?;
            Ok(Some(s))
        } else {
            Ok(self.json.clone())
        }
    }
}

#[utoipa::path(
    post,
    path = "/validate",
    context_path = "/api/profile",
    responses(
        (status = 200, description = "Validation result", body = ValidationOutcome),
        (status = 400, description = "Some error has occurred")
    )
)]
async fn validate(body: String) -> Result<Json<ValidationOutcome>, ProfileServiceError> {
    let profile = ProfileBody::from_string(body);
    let profile_string = match profile.retrieve_profile()? {
        Some(retrieved) => retrieved,
        None => profile.json.expect("Missing profile"),
    };
    let validator = ProfileValidator::default_schema().context("Setting up profile validator")?;
    let result = validator
        .validate_str(&profile_string)
        .context(format!("Could not validate the profile"))
        .map_err(make_internal)?;

    Ok(Json(result))
}

#[utoipa::path(
    post,
    path = "/evaluate",
    context_path = "/api/profile",
    responses(
        (status = 200, description = "Evaluated profile", body = String, content_type = "application/json"),
        (status = 400, description = "Some error has occurred")
    )
)]
async fn evaluate(body: String) -> Result<String, ProfileServiceError> {
    let profile = ProfileBody::from_string(body);
    let profile_string = match profile.retrieve_profile()? {
        Some(retrieved) => retrieved,
        None => profile.json.expect("Missing profile"),
    };
    let evaluator = ProfileEvaluator {};
    let output = evaluator
        .evaluate_string(&profile_string)
        .context("Could not evaluate the profile".to_string())?;

    Ok(output)
}

#[utoipa::path(
    post,
    path = "/autoyast",
    context_path = "/api/profile",
    responses(
        (status = 200, description = "AutoYaST profile conversion", body = String, content_type = "application/json"),
        (status = 400, description = "Some error has occurred")
    )
)]
async fn autoyast(body: String) -> Result<String, ProfileServiceError> {
    let profile = ProfileBody::from_string(body);
    if profile.url.is_none() || profile.path.is_some() || profile.json.is_some() {
        return Err(anyhow::anyhow!(
            "Only url= is expected, no path= or request body. Seen: url {}, path {}, body {}",
            profile.url.is_some(),
            profile.path.is_some(),
            profile.json.is_some()
        )
        .into());
    }

    let url = Url::parse(profile.url.as_ref().unwrap()).map_err(anyhow::Error::new)?;
    let importer_res = AutoyastProfileImporter::read(&url).await;
    match importer_res {
        Ok(importer) => Ok(importer.content),
        Err(error) => {
            // anyhow can be only displayed, not so nice
            if format!("{}", error).contains("Failed to run") {
                return Err(make_internal(error));
            }
            Err(error.into())
        }
    }
}
