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

//! Implements the basic handlers for the HTTP-based API (login, logout, ping, etc.).

use super::{auth::AuthError, state::ServiceState};
use agama_lib::auth::{AuthToken, TokenClaims};
use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
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

#[utoipa::path(
    get,
    path = "/ping",
    context_path = "/api",
    responses(
        (status = 200, description = "The API is working", body = PingResponse)
    )
)]
pub async fn ping() -> Json<PingResponse> {
    Json(PingResponse {
        status: "success".to_string(),
    })
}

#[derive(Serialize, utoipa::ToSchema)]
pub struct AuthResponse {
    /// Bearer token to use on subsequent calls
    token: String,
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct LoginRequest {
    /// User password
    pub password: String,
}

#[utoipa::path(post,
    path = "/auth",
    context_path = "/api",
    responses(
        (status = 200, description = "The user has been successfully authenticated.", body = AuthResponse)
    )
)]
pub async fn login(
    State(state): State<ServiceState>,
    Json(login): Json<LoginRequest>,
) -> Result<impl IntoResponse, AuthError> {
    let mut pam_client = Client::with_password("agama")?;
    pam_client
        .conversation_mut()
        .set_credentials("root", login.password);
    pam_client.authenticate()?;

    let token = AuthToken::generate(&state.config.jwt_secret)?;
    let content = Json(AuthResponse {
        token: token.to_string(),
    });

    let mut headers = HeaderMap::new();
    let cookie = auth_cookie_from_token(&token);
    headers.insert(
        header::SET_COOKIE,
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

    let token = AuthToken::new(&params.token);
    if token.claims(&state.config.jwt_secret).is_ok() {
        let cookie = auth_cookie_from_token(&token);
        headers.insert(
            header::SET_COOKIE,
            cookie.parse().expect("could not build a valid cookie"),
        );
    }

    headers.insert(header::LOCATION, HeaderValue::from_static("/"));
    (StatusCode::TEMPORARY_REDIRECT, headers)
}

#[utoipa::path(delete, path = "/api/auth", responses(
    (status = 204, description = "The user has been logged out.")
))]
pub async fn logout(_claims: TokenClaims) -> Result<impl IntoResponse, AuthError> {
    let mut headers = HeaderMap::new();
    let cookie = "agamaToken=deleted; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT".to_string();
    headers.insert(
        header::SET_COOKIE,
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

/// Creates the cookie containing the authentication token.
///
/// It is a session token (no expiration date) so it should be gone
/// when the browser is closed.
///
/// See https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie
/// for further information.
///
/// * `token`: authentication token.
fn auth_cookie_from_token(token: &AuthToken) -> String {
    format!("agamaToken={}; HttpOnly", &token.to_string())
}
