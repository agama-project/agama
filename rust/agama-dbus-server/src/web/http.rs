//! Implements the handlers for the HTTP-based API.

use axum::{extract::State, Json};
use jsonwebtoken::{EncodingKey, Header};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::service::ServiceState;

#[derive(Serialize, ToSchema)]
pub struct PingResponse {
    /// API status
    status: String,
}

#[utoipa::path(get, path = "/ping", responses(
    (status = 200, description = "The API is working", body = PingResponse)
))]
pub async fn ping() -> Json<PingResponse> {
    Json(PingResponse {
        status: "success".to_string(),
    })
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct Claims {
    exp: usize,
}

#[derive(Serialize)]
pub struct Auth {
    token: String,
}

pub async fn authenticate(State(state): State<ServiceState>) -> Json<Auth> {
    let claims = Claims { exp: 3600 };

    let secret = &state.config.jwt_key;
    let token = jsonwebtoken::encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
    .unwrap();
    Json(Auth { token })
}
