//! Implements the basic handlers for the HTTP-based API (login, logout, ping, etc.).

use super::{
    auth::{generate_token, AuthError, TokenClaims},
    state::ServiceState,
};
use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};
use axum_extra::extract::cookie::CookieJar;
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

    if TokenClaims::from_token(&params.token, &state.config.jwt_secret).is_ok() {
        let cookie = auth_cookie_from_token(&params.token);
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
fn auth_cookie_from_token(token: &str) -> String {
    format!("agamaToken={}; HttpOnly", &token)
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
