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
    headers::{authorization::Bearer, Authorization},
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

impl Default for TokenClaims {
    fn default() -> Self {
        let exp = Utc::now() + Duration::days(1);
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
        let TypedHeader(Authorization(bearer)) = parts
            .extract::<TypedHeader<Authorization<Bearer>>>()
            .await
            .map_err(|_| AuthError::MissingToken)?;

        let decoding = DecodingKey::from_secret(state.config.jwt_secret.as_ref());
        let token_data = jsonwebtoken::decode(bearer.token(), &decoding, &Validation::default())?;

        Ok(token_data.claims)
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

#[cfg(test)]
mod tests {
    use super::{generate_token, AuthError, TokenClaims};
    use crate::web::{state::ServiceState, ServiceConfig};
    use axum::extract::{FromRequestParts, Request};
    use tokio::test;

    async fn try_extract_claims(token: &str, password: &str) -> Result<TokenClaims, AuthError> {
        let request = Request::builder()
            .uri("/test")
            .header("Authorization", format!("Bearer {}", token))
            .body(())
            .unwrap();
        let (mut parts, _) = request.into_parts();
        let state = ServiceState {
            config: ServiceConfig {
                jwt_secret: password.to_string(),
            },
            dbus_connection: zbus::Connection::session().await.unwrap(),
        };
        TokenClaims::from_request_parts(&mut parts, &state).await
    }

    #[test]
    async fn test_extract_claims() {
        let token = generate_token("nots3cr3t");
        let claims = try_extract_claims(&token, "nots3cr3t").await;
        assert!(claims.is_ok());
    }

    #[test]
    async fn test_extract_claims_failed() {
        let token = generate_token("nots3cr3t");
        let claims = try_extract_claims(&token, "nots3cr3t").await;
        assert!(claims.is_err());
    }
}
