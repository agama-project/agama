//! Implements the handlers for the HTTP-based API.

use super::{
    auth::{generate_token, AuthError},
    state::ServiceState,
};
use axum::{extract::State, Json};
use pam::Client;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

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

#[derive(Serialize)]
pub struct AuthResponse {
    /// Bearer token to use on subsequent calls
    token: String,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    /// User password
    pub password: String,
}

#[utoipa::path(get, path = "/authenticate", responses(
    (status = 200, description = "The user have been successfully authenticated", body = AuthResponse)
))]
pub async fn authenticate(
    State(state): State<ServiceState>,
    Json(login): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, AuthError> {
    let mut pam_client = Client::with_password("agama")?;
    pam_client
        .conversation_mut()
        .set_credentials("root", login.password);
    pam_client.authenticate()?;

    let token = generate_token(&state.config.jwt_secret);
    Ok(Json(AuthResponse { token }))
}
