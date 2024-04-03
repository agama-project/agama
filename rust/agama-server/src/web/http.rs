//! Implements the basic handlers for the HTTP-based API (login, logout, ping, etc.).

use super::{
    auth::{generate_token, AuthError, TokenClaims},
    state::ServiceState,
};
use axum::{
    extract::{Query, State},
    http::{
        header::{LOCATION, SET_COOKIE},
        HeaderMap, StatusCode,
    },
    response::IntoResponse,
    Json,
};
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

#[utoipa::path(post, path = "/api/auth", responses(
    (status = 200, description = "The user has been successfully authenticated.", body = AuthResponse)
))]
pub async fn login(
    State(state): State<ServiceState>,
    Json(login): Json<LoginRequest>,
) -> Result<impl IntoResponse, AuthError> {
    let mut pam_client = Client::with_password("agama")?;
    pam_client
        .conversation_mut()
        .set_credentials("root", login.password);
    pam_client.authenticate()?;

    let token = generate_token(&state.config.jwt_secret);
    let content = Json(AuthResponse {
        token: token.to_owned(),
    });

    let mut headers = HeaderMap::new();
    let cookie = format!("agamaToken={}; HttpOnly", &token);
    headers.insert(
        SET_COOKIE,
        cookie.parse().expect("could not build a valid cookie"),
    );

    Ok((headers, content))
}

#[derive(Clone, Deserialize, utoipa::ToSchema)]
pub struct LoginFromQueryParams {
    /// Token to use for authentication.
    token: String,
}

#[utoipa::path(get, path = "/login", responses(
    (status = 301, description = "Injects the authentication cookie if correct and redirects to the web UI")
))]
pub async fn login_from_query(
    State(state): State<ServiceState>,
    Query(params): Query<LoginFromQueryParams>,
) -> impl IntoResponse {
    let mut headers = HeaderMap::new();

    if TokenClaims::from_token(&params.token, &state.config.jwt_secret).is_ok() {
        let cookie = format!("agamaToken={}; HttpOnly", params.token);
        headers.insert(
            SET_COOKIE,
            cookie.parse().expect("could not build a valid cookie"),
        );
    }

    headers.insert(LOCATION, "/".parse().unwrap());
    (StatusCode::PERMANENT_REDIRECT, headers)
}

#[utoipa::path(delete, path = "/api/auth", responses(
    (status = 204, description = "The user has been logged out.")
))]
pub async fn logout(_claims: TokenClaims) -> Result<impl IntoResponse, AuthError> {
    let mut headers = HeaderMap::new();
    let cookie = "agamaToken=deleted; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT".to_string();
    headers.insert(
        SET_COOKIE,
        cookie.parse().expect("could not build a valid cookie"),
    );
    Ok(headers)
}

/// Check whether the user is authenticated.
#[utoipa::path(get, path = "/api/auth", responses(
    (status = 200, description = "The user is authenticated."),
    (status = 400, description = "The user is not authenticated.")
))]
pub async fn session(_claims: TokenClaims) -> Result<(), AuthError> {
    Ok(())
}
