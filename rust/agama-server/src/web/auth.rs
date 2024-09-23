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

//! Contains the code to handle access authorization.

use super::state::ServiceState;
use agama_lib::auth::{AuthToken, AuthTokenError, TokenClaims};
use async_trait::async_trait;
use axum::{
    extract::FromRequestParts,
    http::{request, StatusCode},
    response::{IntoResponse, Response},
    Json, RequestPartsExt,
};
use axum_extra::{
    headers::{self, authorization::Bearer},
    TypedHeader,
};
use pam::PamError;
use serde_json::json;
use thiserror::Error;

/// Represents an authentication error.
#[derive(Error, Debug)]
pub enum AuthError {
    /// The authentication error is not included in the headers.
    #[error("Missing authentication token")]
    MissingToken,
    /// The authentication error is invalid.
    #[error("Invalid authentication token: {0}")]
    InvalidToken(#[from] AuthTokenError),
    /// The authentication failed (most probably the password is wrong)
    #[error("Authentication via PAM failed: {0}")]
    Failed(#[from] PamError),
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let body = json!({
            "error": self.to_string()
        });
        (StatusCode::BAD_REQUEST, Json(body)).into_response()
    }
}

#[async_trait]
impl FromRequestParts<ServiceState> for TokenClaims {
    type Rejection = AuthError;

    async fn from_request_parts(
        parts: &mut request::Parts,
        state: &ServiceState,
    ) -> Result<Self, Self::Rejection> {
        let token = match parts
            .extract::<TypedHeader<headers::Authorization<Bearer>>>()
            .await
        {
            Ok(TypedHeader(headers::Authorization(bearer))) => bearer.token().to_owned(),
            Err(_) => {
                let cookie = parts
                    .extract::<TypedHeader<headers::Cookie>>()
                    .await
                    .map_err(|_| AuthError::MissingToken)?;
                cookie
                    .get("agamaToken")
                    .ok_or(AuthError::MissingToken)?
                    .to_owned()
            }
        };

        let token = AuthToken::new(&token);
        Ok(token.claims(&state.config.jwt_secret)?)
    }
}
