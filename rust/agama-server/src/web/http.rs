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
use agama_lib::logs::{
    list as listLogs, store as storeLogs, LogOptions, LogsLists, DEFAULT_COMPRESSION,
};
use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use axum_extra::extract::cookie::CookieJar;
use pam::Client;
use serde::{Deserialize, Serialize};
use tokio_util::io::ReaderStream;
use utoipa::ToSchema;

/// Creates router for handling /logs/* endpoints
pub fn logs_router() -> Router<ServiceState> {
    Router::new()
        .route("/store", get(logs_store))
        .route("/list", get(logs_list))
}

#[utoipa::path(get, path = "/logs/store", responses(
    (status = 200, description = "Compressed Agama logs", content_type="application/octet-stream"),
    (status = 404, description = "Agama logs not available")
))]
async fn logs_store() -> impl IntoResponse {
    // TODO: require authorization
    let mut headers = HeaderMap::new();

    match storeLogs(LogOptions::default()) {
        Ok(path) => {
            let file = tokio::fs::File::open(path.clone()).await.unwrap();
            let stream = ReaderStream::new(file);
            let body = Body::from_stream(stream);

            // Cleanup - remove temporary file, no one cares it it fails
            let _ = std::fs::remove_file(path.clone());

            headers.insert(
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/toml; charset=utf-8"),
            );
            headers.insert(
                header::CONTENT_DISPOSITION,
                HeaderValue::from_static("attachment; filename=\"agama-logs\""),
            );
            headers.insert(
                header::CONTENT_ENCODING,
                HeaderValue::from_static(DEFAULT_COMPRESSION.1),
            );

            (headers, body)
        }
        Err(_) => {
            // fill in with meaningful headers
            (headers, Body::empty())
        }
    }
}

#[utoipa::path(get, path = "/logs/list", responses(
    (status = 200, description = "Lists of collected logs", body = LogsLists)
))]
pub async fn logs_list() -> Json<LogsLists> {
    Json(listLogs(LogOptions::default()))
}

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

// builds a response tuple for translation redirection
fn redirect_to_file(file: &str) -> (StatusCode, HeaderMap, Body) {
    tracing::info!("Redirecting to translation file {}", file);

    let mut response_headers = HeaderMap::new();
    // translation found, redirect to the real file
    response_headers.insert(
        header::LOCATION,
        // if the file exists then the name is a valid value and unwrapping is safe
        HeaderValue::from_str(file).unwrap(),
    );

    (
        StatusCode::TEMPORARY_REDIRECT,
        response_headers,
        Body::empty(),
    )
}

// handle the /po.js request
// the requested language (locale) is sent in the "agamaLang" HTTP cookie
// this reimplements the Cockpit translation support
pub async fn po(State(state): State<ServiceState>, jar: CookieJar) -> impl IntoResponse {
    if let Some(cookie) = jar.get("agamaLang") {
        tracing::info!("Language cookie: {}", cookie.value());
        // try parsing the cookie
        if let Some((lang, region)) = cookie.value().split_once('-') {
            // first try language + country
            let target_file = format!("po.{}_{}.js", lang, region.to_uppercase());
            if state.public_dir.join(&target_file).exists() {
                return redirect_to_file(&target_file);
            } else {
                // then try the language only
                let target_file = format!("po.{}.js", lang);
                if state.public_dir.join(&target_file).exists() {
                    return redirect_to_file(&target_file);
                };
            }
        } else {
            // use the cookie as is
            let target_file = format!("po.{}.js", cookie.value());
            if state.public_dir.join(&target_file).exists() {
                return redirect_to_file(&target_file);
            }
        }
    }

    tracing::info!("Translation not found");
    // fallback, return empty javascript translations if the language is not supported
    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/javascript"),
    );

    (StatusCode::OK, response_headers, Body::empty())
}
