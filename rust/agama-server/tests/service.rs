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
    let (tx, _) = channel(16);
    let web_service = MainServiceBuilder::new(tx, public_dir())
        .add_service("/protected", get(protected))
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
    };
    let (tx, _) = channel(16);
    let web_service = MainServiceBuilder::new(tx, public_dir())
        .add_service("/protected", get(protected))
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
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    Ok(())
}
