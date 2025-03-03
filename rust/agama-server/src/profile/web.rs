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

use agama_lib::{
    error::{ProfileError, ServiceError},
    profile::{ProfileValidator, ValidationResult},
    //profile::{validate},
};
use axum::{
    debug_handler,
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
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
    #[error("Error: {0}")]
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
        .route("/validate", get(validate))
        .with_state(state);
    Ok(router)
}

// FIXME: the path API is suited for local operation but not so much for a remote one?
// think about passing a URI or a request body
#[derive(Deserialize, utoipa::IntoParams)]
struct ValidateQuery {
    /// Path of profile to validate
    path: String,
}

#[debug_handler]
#[utoipa::path(
    get,
    path = "/validate",
    context_path = "/api/profile",
    params(ValidateQuery),
    responses(
        (status = 200, description = "FIXME"),
        (status = 400, description = "FIXME some error has happened")
    )
)]
async fn validate(
    _state: State<ProfileState>,
    query: Query<ValidateQuery>,
) -> Result<Json<ValidationResult>, ProfileServiceError> {
    let path = std::path::Path::new(query.path.as_str());

    let validator = ProfileValidator::default_schema()?;
    let result = validator
        .validate_file(path)
        .context(format!("Could not validate the profile {:?}", path))?;
    Ok(Json(result))
}

// TODO: ProfileValidator takes a local path, use that in the back end
// then we use ValidationResult and format it for CLI, that's our front end
// but put an HTTP API call in the middle
/*
fn xvalidate(path: &PathBuf) -> anyhow::Result<()> {
    // let result = profile_client.validate_file(path);


    let validator = ProfileValidator::default_schema()?;
    let result = validator
        .validate_file(path)
        .context(format!("Could not validate the profile {:?}", path))?;
    match result {
        ValidationResult::Valid => {
            println!("The profile is valid.");
        }
        ValidationResult::NotValid(errors) => {
            eprintln!(
                "The profile is not valid. Please, check the following errors:\n"
            );
            for error in errors {
                println!("\t* {error}")
            }
        }
    }
    Ok(())
}
    */
