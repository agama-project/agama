//! Contains the code to handle access authorization.

use super::state::ServiceState;
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
use chrono::{Duration, Utc};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation};
use pam::PamError;
use serde::{Deserialize, Serialize};
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
    InvalidToken(#[from] jsonwebtoken::errors::Error),
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

/// Claims that are included in the token.
///
/// See https://datatracker.ietf.org/doc/html/rfc7519 for reference.
#[derive(Debug, Serialize, Deserialize)]
pub struct TokenClaims {
    exp: i64,
}

impl TokenClaims {
    /// Builds claims for a given token.
    ///
    /// * `token`: token to extract the claims from.
    /// * `secret`: secret to decode the token.
    pub fn from_token(token: &str, secret: &str) -> Result<Self, AuthError> {
        let decoding = DecodingKey::from_secret(secret.as_ref());
        let token_data = jsonwebtoken::decode(token, &decoding, &Validation::default())?;
        Ok(token_data.claims)
    }
}

impl Default for TokenClaims {
    fn default() -> Self {
        let mut exp = Utc::now();

        if let Some(days) = Duration::try_days(1) {
            exp += days;
        }

        Self {
            exp: exp.timestamp(),
        }
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

        TokenClaims::from_token(&token, &state.config.jwt_secret)
    }
}

/// Generates a JWT.
///
/// - `secret`: secret to encrypt/sign the token.
pub fn generate_token(secret: &str) -> String {
    let claims = TokenClaims::default();
    jsonwebtoken::encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
    .unwrap()
}
