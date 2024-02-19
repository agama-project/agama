//! Implements the handlers for the HTTP-based API.

use super::{auth::generate_token, state::ServiceState};
use axum::{extract::State, Json};
use pam::Client;
use serde::Serialize;
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

// TODO: remove this route (as it is just for teting) as soon as we have a legit protected one
pub async fn protected() -> String {
    "OK".to_string()
}

#[derive(Serialize)]
pub struct AuthResponse {
    /// Bearer token to use on subsequent calls
    token: String,
}

#[utoipa::path(get, path = "/authenticate", responses(
    (status = 200, description = "The user have been successfully authenticated", body = AuthResponse)
))]
pub async fn authenticate(
    State(state): State<ServiceState>,
    Json(password): Json<String>,
) -> Json<AuthResponse> {
    let mut pam_client = Client::with_password("cockpit").expect("failed to open PAM!");
    pam_client
        .conversation_mut()
        .set_credentials("root", password);
    pam_client.authenticate().expect("failed authentication!");

    let token = generate_token(&state.config.jwt_secret);
    Json(AuthResponse { token })
}
