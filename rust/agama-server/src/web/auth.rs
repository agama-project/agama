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
