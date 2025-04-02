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

use std::io::Write;
use std::os::unix::fs::PermissionsExt;
use std::time::Duration;

use anyhow::{anyhow, Context};

use agama_lib::utils::Transfer;
use agama_lib::{
    error::ServiceError,
    profile::{AutoyastProfileImporter, ProfileEvaluator, ProfileValidator, ValidationOutcome},
};
use axum::{
    extract::Query,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
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

impl From<anyhow::Error> for ProfileServiceError {
    fn from(e: anyhow::Error) -> Self {
        Self {
            source: e,
            http_status: StatusCode::BAD_REQUEST,
        }
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
        .route("/autoyast", post(autoyast))
        .route("/execute_script", post(execute_script));
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
    /// Check that exactly one of url=, path=, request body, has been provided.
    fn check(&self, request_has_body: bool) -> Result<(), ProfileServiceError> {
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
            Transfer::get(url_string, &mut bytebuf)
                .context(format!("Retrieving data from URL {}", url_string))?;
            let s = String::from_utf8(bytebuf)
                .context(format!("Invalid UTF-8 data at URL {}", url_string))?;
            Ok(Some(s))
        } else if let Some(path) = &self.path {
            let s = std::fs::read_to_string(path).context(format!("Reading from file {}", path))?;
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
        (status = 200, description = "Validation result", body = ValidationOutcome),
        (status = 400, description = "FIXME some error has happened")
    )
)]
async fn validate(
    query: Query<ProfileQuery>,
    profile: String, // json_or_empty
) -> Result<Json<ValidationOutcome>, ProfileServiceError> {
    let request_has_body = !profile.is_empty() && profile != "null";
    query.check(request_has_body)?;
    let profile_string = match query.retrieve_profile()? {
        Some(retrieved) => retrieved,
        None => profile,
    };

    let validator = ProfileValidator::default_schema().context("Setting up profile validator")?;
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
    query: Query<ProfileQuery>,
    profile: String, // jsonnet_or_empty
) -> Result<String, ProfileServiceError> {
    let request_has_body = !profile.is_empty() && profile != "null";
    query.check(request_has_body)?;
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
    query: Query<ProfileQuery>,
    profile: String, // xml_or_erb_or_empty
) -> Result<String, ProfileServiceError> {
    let request_has_body = !profile.is_empty() && profile != "null";
    if query.url.is_none() || query.path.is_some() || request_has_body {
        return Err(anyhow::anyhow!(
            "Only url= is expected, no path= or request body. Seen: url {}, path {}, body {}",
            query.url.is_some(),
            query.path.is_some(),
            request_has_body
        )
        .into());
    }

    let url = Url::parse(query.url.as_ref().unwrap()).map_err(anyhow::Error::new)?;
    let importer_res = AutoyastProfileImporter::read(&url);
    match importer_res {
        Ok(importer) => Ok(importer.content),
        Err(error) => {
            // anyhow can be only displayed, not so nice
            if format!("{}", error).contains("Failed to run") {
                return Err(ProfileServiceError {
                    http_status: StatusCode::INTERNAL_SERVER_ERROR,
                    source: error,
                });
            }
            Err(error.into())
        }
    }
}

#[utoipa::path(
    post,
    path = "/execute_script",
    context_path = "/api/profile",
    params(ProfileQuery),
    responses(
        (status = 200, description = "Script has started"),
        (status = 400, description = "FIXME some error has happened")
    )
)]
async fn execute_script(
    query: Query<ProfileQuery>,
    script: String, // script_or_empty
) -> Result<Json<()>, ProfileServiceError> {
    let request_has_body = !script.is_empty() && script != "null";
    query.check(request_has_body)?;
    let script_string = match query.retrieve_profile()? {
        Some(retrieved) => retrieved,
        None => script,
    };

    // write to a temporary path and spawn in background and return
    // May be long running
    // TODO: can agama+axum wait for completion and return output?
    let mut named_tempfile = tempfile::Builder::new()
        .prefix("agama-script")
        .permissions(std::fs::Permissions::from_mode(0o700))
        .tempfile()
        .context("Creating temporary file for script")?;
    named_tempfile
        .as_file_mut()
        .write_all(script_string.as_bytes())
        .context("Writing script text")?;
    // close the file otherwise exec fails with ETXTBSY
    let path = named_tempfile.into_temp_path();
    let path = path.keep().context("Persisting script file")?;

    let mut child = std::process::Command::new(&path)
        .spawn()
        .context(format!("Spawning script {:?}", path))?;

    // Do not child.wait() for the script to finish,
    // but do wait 50ms to report if it failed soon enough.
    tokio::time::sleep(Duration::from_millis(50)).await;
    if let Ok(Some(exit_status)) = child.try_wait() {
        return Err(anyhow!("Script failed quickly with {}", exit_status).into());
    }

    Ok(Json(()))
}
