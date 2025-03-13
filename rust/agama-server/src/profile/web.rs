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
    error::{ProfileError, ServiceError},
    profile::{AutoyastProfileImporter, ProfileEvaluator, ProfileValidator, Url, ValidationResult},
};
use axum::{
    debug_handler,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use thiserror::Error;

#[derive(Clone, Default)]
struct ProfileState {
    //profile: Arc<RwLock<ProfileRepository>>,
}

#[derive(Error, Debug)]
pub enum ProfileServiceError {
    /*
    #[error("Validation error: {0}")]
    Validation(#[from] ValidationResult),
    */
    #[error("Profile error: {0}")]
    Profile(#[from] ProfileError),
    // it's fine to say only "Error" because the original
    // specific error will be printed too
    #[error("Error: {0:#}")]
    Anyhow(#[from] anyhow::Error),
}

impl IntoResponse for ProfileServiceError {
    fn into_response(self) -> Response {
        let body = json!({
            "error": self.to_string()
        });
        (StatusCode::BAD_REQUEST, Json(body)).into_response()
    }
}

/// Sets up and returns the axum service for the auto-installation profile.
pub async fn profile_service() -> Result<Router, ServiceError> {
    let state = ProfileState::default();
    let router = Router::new()
        .route("/evaluate", post(evaluate))
        .route("/validate", post(validate))
        .route("/autoyast", post(autoyast))
        .with_state(state);
    Ok(router)
}

/// For flexibility, the profile operations take the input as either of:
/// 1. request body
/// 2. pathname (server side)
/// 3. URL
#[derive(Deserialize, utoipa::IntoParams, Debug)]
struct ProfileQuery {
    path: Option<String>,
    url: Option<String>,
}

impl ProfileQuery {
    fn validate(&self, request_has_body: bool) -> Result<(), ProfileServiceError> {
        // `^` is called Bitwise Xor but it does work correctly on bools
        if request_has_body ^ self.path.is_some() ^ self.url.is_some() {
            return Ok(());
        }
        Err(anyhow::anyhow!(
            "Only one of (url=, path=, request body) is expected. Seen: url {}, path {}, body {}",
            self.url.is_some(),
            self.path.is_some(),
            request_has_body
        )
        .into())
    }

    /// Retrieve a profile if specified by one of *url*, *path*
    fn retrieve_profile(&self) -> Result<Option<String>, ProfileServiceError> {
        if let Some(url_string) = &self.url {
            let mut bytebuf = Vec::new();
            Transfer::get(&url_string, &mut bytebuf)
                .context(format!("Retrieving data from URL {}", &url_string))?;
            let s = String::from_utf8(bytebuf)
                .context(format!("Invalid UTF-8 data at URL {}", &url_string))?;
            Ok(Some(s))
        } else if let Some(path) = &self.path {
            let s =
                std::fs::read_to_string(&path).context(format!("Reading from file {}", &path))?;
            Ok(Some(s))
        } else {
            Ok(None)
        }
    }
}

#[utoipa::path(
    post,
    path = "/validate",
    context_path = "/api/profile",
    params(ProfileQuery),
    responses(
        (status = 200, description = "Validation result", body = ValidationResult),
        (status = 400, description = "FIXME some error has happened")
    )
)]
async fn validate(
    _state: State<ProfileState>,
    query: Query<ProfileQuery>,
    profile: String, // json_or_empty
) -> Result<Json<ValidationResult>, ProfileServiceError> {
    let request_has_body = !profile.is_empty() && profile != "null";
    query.validate(request_has_body)?;
    let profile_string = match query.retrieve_profile()? {
        Some(retrieved) => retrieved,
        None => profile,
    };

    let validator = ProfileValidator::default_schema()?;
    let result = validator
        .validate_str(&profile_string)
        .context(format!("Could not validate the profile {:?}", *query))?;
    Ok(Json(result))
}

#[utoipa::path(
    post,
    path = "/evaluate",
    context_path = "/api/profile",
    params(ProfileQuery),
    responses(
        (status = 200, description = "Evaluated profile"),
        (status = 400, description = "FIXME some error has happened")
    )
)]
async fn evaluate(
    _state: State<ProfileState>,
    query: Query<ProfileQuery>,
    profile: String, // jsonnet_or_empty
) -> Result<String, ProfileServiceError> {
    let request_has_body = !profile.is_empty() && profile != "null";
    query.validate(request_has_body)?;
    let profile_string = match query.retrieve_profile()? {
        Some(retrieved) => retrieved,
        None => profile,
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
    params(ProfileQuery),
    responses(
        (status = 200, description = "JSON result of Autoyast profile conversion"),
        // TODO: "failed to run agama-autoyast" should be a 500 instead, see software/web.rs
        (status = 400, description = "FIXME some error has happened")
    )
)]
async fn autoyast(
    _state: State<ProfileState>,
    query: Query<ProfileQuery>,
    profile: String, // xml_or_erb_or_empty
) -> Result<String, ProfileServiceError> {
    let request_has_body = !profile.is_empty() && profile != "null";
    /*
    // TODO: full ProfileQuery processing not needed now
    query.validate(request_has_body)?;
    let profile_string = match query.retrieve_profile()? {
        Some(retrieved) => retrieved,
        None => profile
    };
    let importer = AutoyastProfileImporter::read_str(&profile_string)?;
    */
    if !query.url.is_some() || query.path.is_some() || request_has_body {
        return Err(anyhow::anyhow!(
            "Only url= is expected, no path= or request body. Seen: url {}, path {}, body {}",
            query.url.is_some(),
            query.path.is_some(),
            request_has_body
        )
        .into());
    }

    let url = Url::parse(&query.url.as_ref().unwrap()).map_err(|e| anyhow::Error::new(e))?;
    let importer = AutoyastProfileImporter::read(&url)?;
    // TODO try error cases and add .context if needed
    Ok(importer.content)
}
