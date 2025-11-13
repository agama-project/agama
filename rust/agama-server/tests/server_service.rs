// Copyright (c) [2025] SUSE LLC
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

use agama_utils::api;
use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
};
use common::{body_to_string, build_server_service};
use std::error::Error;
use tokio::test;
use tower::ServiceExt;

#[test]
async fn test_get_extended_config() -> Result<(), Box<dyn Error>> {
    let server_service = build_server_service().await?;
    let request = Request::builder()
        .uri("/extended_config")
        .body(Body::empty())
        .unwrap();

    let response = server_service.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(r#""locale""#));
    assert!(body.contains(r#""keymap""#));
    assert!(body.contains(r#""timezone""#));

    Ok(())
}

#[test]
async fn test_get_empty_config() -> Result<(), Box<dyn Error>> {
    let server_service = build_server_service().await?;
    let request = Request::builder()
        .uri("/config")
        .body(Body::empty())
        .unwrap();

    let response = server_service.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert_eq!(&body, "{}");

    Ok(())
}

#[test]
async fn test_put_config() -> Result<(), Box<dyn Error>> {
    let config = api::Config {
        l10n: Some(api::l10n::Config {
            locale: Some("es_ES.UTF-8".to_string()),
            keymap: Some("es".to_string()),
            timezone: Some("Atlantic/Canary".to_string()),
        }),
        ..Default::default()
    };

    let server_service = build_server_service().await?;
    let request = Request::builder()
        .uri("/config")
        .header("Content-Type", "application/json")
        .method(Method::PUT)
        .body(serde_json::to_string(&config)?)
        .unwrap();

    let response = server_service.clone().oneshot(request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let request = Request::builder()
        .uri("/config")
        .body(Body::empty())
        .unwrap();

    let response = server_service.clone().oneshot(request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert!(body
        .contains(r#""l10n":{"locale":"es_ES.UTF-8","keymap":"es","timezone":"Atlantic/Canary"#));

    let config = api::Config {
        l10n: Some(api::l10n::Config {
            locale: None,
            keymap: Some("en".to_string()),
            timezone: None,
        }),
        ..Default::default()
    };

    let request = Request::builder()
        .uri("/config")
        .header("Content-Type", "application/json")
        .method(Method::PUT)
        .body(serde_json::to_string(&config)?)
        .unwrap();

    let response = server_service.clone().oneshot(request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let request = Request::builder()
        .uri("/config")
        .body(Body::empty())
        .unwrap();

    let response = server_service.clone().oneshot(request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(r#""l10n":{"keymap":"en"}"#));

    Ok(())
}

#[test]
async fn test_patch_config() -> Result<(), Box<dyn Error>> {
    let l10n = api::l10n::Config {
        locale: Some("es_ES.UTF-8".to_string()),
        keymap: Some("es".to_string()),
        timezone: Some("Atlantic/Canary".to_string()),
    };

    let config = api::Config {
        l10n: Some(l10n),
        ..Default::default()
    };

    let server_service = build_server_service().await?;
    let request = Request::builder()
        .uri("/config")
        .header("Content-Type", "application/json")
        .method(Method::PUT)
        .body(serde_json::to_string(&config)?)
        .unwrap();

    let response = server_service.clone().oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let config = api::Config {
        l10n: Some(api::l10n::Config {
            locale: None,
            keymap: Some("en".to_string()),
            timezone: None,
        }),
        ..Default::default()
    };
    let patch = agama_utils::api::Patch::with_update(&config).unwrap();

    let request = Request::builder()
        .uri("/config")
        .header("Content-Type", "application/json")
        .method(Method::PATCH)
        .body(serde_json::to_string(&patch)?)
        .unwrap();

    let response = server_service.clone().oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let request = Request::builder()
        .uri("/config")
        .body(Body::empty())
        .unwrap();

    let response = server_service.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert!(body
        .contains(r#""l10n":{"locale":"es_ES.UTF-8","keymap":"en","timezone":"Atlantic/Canary"#));

    Ok(())
}
