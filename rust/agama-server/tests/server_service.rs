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

use agama_l10n::UserConfig;
use agama_lib::error::ServiceError;
use agama_lib::install_settings::InstallSettings;
use agama_server::server::server_service;
use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
    Router,
};
use common::body_to_string;
use std::error::Error;
use tokio::{sync::broadcast::channel, test};
use tower::ServiceExt;

async fn build_server_service() -> Result<Router, ServiceError> {
    let (tx, _rx) = channel(16);

    server_service(tx).await
}

#[test]
#[cfg(not(ci))]
async fn test_get_config() -> Result<(), Box<dyn Error>> {
    let server_service = build_server_service().await?;
    let request = Request::builder()
        .uri("/config")
        .body(Body::empty())
        .unwrap();

    let response = server_service.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(r#""localization":{"language":"en_US.UTF-8"#));

    Ok(())
}

#[test]
#[cfg(not(ci))]
async fn test_get_user_config() -> Result<(), Box<dyn Error>> {
    let server_service = build_server_service().await?;
    let request = Request::builder()
        .uri("/config/user")
        .body(Body::empty())
        .unwrap();

    let response = server_service.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert!(!body.contains(r#""localization""#));

    Ok(())
}

#[test]
#[cfg(not(ci))]
async fn test_put_user_config() -> Result<(), Box<dyn Error>> {
    let localization = UserConfig {
        language: Some("es_ES.UTF-8".to_string()),
        keyboard: Some("es".to_string()),
        timezone: Some("Atlantic/Canary".to_string()),
    };

    let mut config = InstallSettings {
        localization: Some(localization),
        ..Default::default()
    };

    let server_service = build_server_service().await?;
    let request = Request::builder()
        .uri("/config/user")
        .header("Content-Type", "application/json")
        .method(Method::PUT)
        .body(serde_json::to_string(&config)?)
        .unwrap();

    let response = server_service.clone().oneshot(request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let request = Request::builder()
        .uri("/config/user")
        .body(Body::empty())
        .unwrap();

    let response = server_service.clone().oneshot(request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(
        r#""localization":{"language":"es_ES.UTF-8","keyboard":"es","timezone":"Atlantic/Canary"#
    ));

    let localization = UserConfig {
        language: None,
        keyboard: Some("en".to_string()),
        timezone: None,
    };
    config.localization = Some(localization);

    let request = Request::builder()
        .uri("/config/user")
        .header("Content-Type", "application/json")
        .method(Method::PUT)
        .body(serde_json::to_string(&config)?)
        .unwrap();

    let response = server_service.clone().oneshot(request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let request = Request::builder()
        .uri("/config/user")
        .body(Body::empty())
        .unwrap();

    let response = server_service.clone().oneshot(request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(r#""localization":{"keyboard":"en"}"#));

    Ok(())
}

#[test]
#[cfg(not(ci))]
async fn test_patch_user_config() -> Result<(), Box<dyn Error>> {
    let localization = UserConfig {
        language: Some("es_ES.UTF-8".to_string()),
        keyboard: Some("es".to_string()),
        timezone: Some("Atlantic/Canary".to_string()),
    };

    let mut config = InstallSettings {
        localization: Some(localization),
        ..Default::default()
    };

    let server_service = build_server_service().await?;
    let request = Request::builder()
        .uri("/config/user")
        .header("Content-Type", "application/json")
        .method(Method::PUT)
        .body(serde_json::to_string(&config)?)
        .unwrap();

    let response = server_service.clone().oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let localization = UserConfig {
        language: None,
        keyboard: Some("en".to_string()),
        timezone: None,
    };
    config.localization = Some(localization);

    let request = Request::builder()
        .uri("/config/user")
        .header("Content-Type", "application/json")
        .method(Method::PATCH)
        .body(serde_json::to_string(&config)?)
        .unwrap();

    let response = server_service.clone().oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let request = Request::builder()
        .uri("/config/user")
        .body(Body::empty())
        .unwrap();

    let response = server_service.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(
        r#""localization":{"language":"es_ES.UTF-8","keyboard":"en","timezone":"Atlantic/Canary"#
    ));

    Ok(())
}
