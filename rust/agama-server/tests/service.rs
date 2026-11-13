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

pub mod common;

use agama_lib::auth::AuthToken;
use agama_server::web::{MainServiceBuilder, ServiceConfig};
use aide::axum::ApiRouter;
use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
    response::Response,
    routing::get,
};
use common::body_to_string;
use std::{error::Error, path::PathBuf};
use tokio::{sync::broadcast::channel, test};
use tower::ServiceExt;

fn public_dir() -> PathBuf {
    std::env::current_dir().unwrap().join("public")
}

#[test]
async fn test_ping() -> Result<(), Box<dyn Error>> {
    let config = ServiceConfig::default();
    let (events_tx, _) = channel(16);
    let protected_service = ApiRouter::new().route("/", get(protected));
    let web_service = MainServiceBuilder::new(events_tx, public_dir())
        .add_service("/protected", protected_service)
        .with_config(config)
        .build();

    let request = Request::builder()
        .uri("/api/ping")
        .body(Body::empty())
        .unwrap();

    let response = web_service.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert_eq!(&body, "{\"status\":\"success\"}");
    Ok(())
}

async fn protected() -> String {
    "OK".to_string()
}

async fn access_protected_route(token: &str, jwt_secret: &str) -> Response {
    let config = ServiceConfig {
        jwt_secret: jwt_secret.to_string(),
        mcp_token: None,
    };
    let (events_tx, _) = channel(16);
    let protected_service = ApiRouter::new().route("/", get(protected));
    let web_service = MainServiceBuilder::new(events_tx, public_dir())
        .add_service("/protected", protected_service)
        .with_config(config)
        .build();

    let request = Request::builder()
        .uri("/api/protected")
        .method(Method::GET)
        .header("Authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    web_service.oneshot(request).await.unwrap()
}

// TODO: The following test should belong to `auth.rs`
#[test]
async fn test_access_protected_route() -> Result<(), Box<dyn Error>> {
    let token = AuthToken::generate("nots3cr3t")?;
    let response = access_protected_route(token.as_str(), "nots3cr3t").await;
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert_eq!(body, "OK");
    Ok(())
}
//
// TODO: The following test should belong to `auth.rs`.
#[test]
async fn test_access_protected_route_failed() -> Result<(), Box<dyn Error>> {
    let token = AuthToken::generate("nots3cr3t")?;
    let response = access_protected_route(token.as_str(), "wrong").await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    Ok(())
}

#[test]
async fn test_access_mcp_route_unauthorized() -> Result<(), Box<dyn Error>> {
    let config = ServiceConfig {
        jwt_secret: "secret123".to_string(),
        mcp_token: Some("mcp-secret-token-xyz".to_string()),
    };
    let (events_tx, _) = channel(16);
    // Use fallback_service without explicit routes to mirror agama-mcp's router structure
    // and verify that MainServiceBuilder handles fallback-only MCP services without panicking.
    let mcp_router = axum::Router::new().fallback_service(get(|| async { "mcp ok" }));
    let web_service = MainServiceBuilder::new(events_tx, public_dir())
        .with_mcp_service(mcp_router)
        .with_config(config)
        .build();

    let request = Request::builder()
        .uri("/mcp")
        .method(Method::GET)
        .body(Body::empty())
        .unwrap();

    let response = web_service.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    Ok(())
}

#[test]
async fn test_access_mcp_route_with_dedicated_mcp_token() -> Result<(), Box<dyn Error>> {
    let config = ServiceConfig {
        jwt_secret: "secret123".to_string(),
        mcp_token: Some("mcp-secret-token-xyz".to_string()),
    };
    let (events_tx, _) = channel(16);
    // Use fallback_service without explicit routes to mirror agama-mcp's router structure
    let mcp_router = axum::Router::new().fallback_service(get(|| async { "mcp ok" }));
    let web_service = MainServiceBuilder::new(events_tx, public_dir())
        .with_mcp_service(mcp_router)
        .with_config(config)
        .build();

    let request = Request::builder()
        .uri("/mcp")
        .method(Method::GET)
        .header("Authorization", "Bearer mcp-secret-token-xyz")
        .body(Body::empty())
        .unwrap();

    let response = web_service.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = body_to_string(response.into_body()).await;
    assert_eq!(body, "mcp ok");
    Ok(())
}

#[test]
async fn test_mcp_token_cannot_access_general_api() -> Result<(), Box<dyn Error>> {
    let config = ServiceConfig {
        jwt_secret: "secret123".to_string(),
        mcp_token: Some("mcp-secret-token-xyz".to_string()),
    };
    let (events_tx, _) = channel(16);
    let protected_service = ApiRouter::new().route("/", get(protected));
    let mcp_router = axum::Router::new().fallback_service(get(|| async { "mcp ok" }));
    let web_service = MainServiceBuilder::new(events_tx, public_dir())
        .add_service("/protected", protected_service)
        .with_mcp_service(mcp_router)
        .with_config(config)
        .build();

    // AI agent tries to use its MCP token to hit general /api endpoints via curl
    let request = Request::builder()
        .uri("/api/protected")
        .method(Method::GET)
        .header("Authorization", "Bearer mcp-secret-token-xyz")
        .body(Body::empty())
        .unwrap();

    let response = web_service.oneshot(request).await.unwrap();
    // Must be strictly rejected!
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    Ok(())
}

#[test]
async fn test_api_token_cannot_access_mcp() -> Result<(), Box<dyn Error>> {
    let config = ServiceConfig {
        jwt_secret: "secret123".to_string(),
        mcp_token: Some("mcp-secret-token-xyz".to_string()),
    };
    let (events_tx, _) = channel(16);
    let mcp_router = axum::Router::new().fallback_service(get(|| async { "mcp ok" }));
    let web_service = MainServiceBuilder::new(events_tx, public_dir())
        .with_mcp_service(mcp_router)
        .with_config(config)
        .build();

    let api_token = AuthToken::generate("secret123")?;
    let request = Request::builder()
        .uri("/mcp")
        .method(Method::GET)
        .header("Authorization", format!("Bearer {}", api_token))
        .body(Body::empty())
        .unwrap();

    let response = web_service.oneshot(request).await.unwrap();
    // Master/API token is rejected by /mcp!
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    Ok(())
}
