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
use aide::OperationIo;
use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};
use pam::Client;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Serialize, JsonSchema)]
pub struct PingResponse {
    /// API status
    status: String,
}

pub async fn ping() -> Json<PingResponse> {
    Json(PingResponse {
        status: "success".to_string(),
    })
}

#[derive(Serialize, JsonSchema, OperationIo)]
#[aide(output)]
pub struct AuthResponse {
    /// Bearer token to use on subsequent calls
    token: String,
}

#[derive(Deserialize, JsonSchema, OperationIo)]
#[aide(input)]
pub struct LoginRequest {
    /// User password
    pub password: String,
}

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

#[derive(Clone, Deserialize, JsonSchema)]
pub struct LoginFromQueryParams {
    /// Token to use for authentication.
    token: String,
    /// Optional requested locale
    lang: Option<String>,
}

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

    // the redirection path
    let mut target = String::from("/");

    // keep the "lang" URL query if it was present in the original request
    if let Some(lang) = params.lang {
        if !lang.is_empty() {
            target.push_str(format!("?lang={}", lang).as_str());
        }
    }

    let location = HeaderValue::from_str(target.as_str());

    headers.insert(
        header::LOCATION,
        location.unwrap_or(HeaderValue::from_static("/")),
    );

    (StatusCode::TEMPORARY_REDIRECT, headers)
}

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
