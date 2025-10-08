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

use agama_l10n::Config;
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
#[cfg(not(ci))]
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
#[cfg(not(ci))]
async fn test_put_config() -> Result<(), Box<dyn Error>> {
    let localization = Config {
        locale: Some("es_ES.UTF-8".to_string()),
        keymap: Some("es".to_string()),
        timezone: Some("Atlantic/Canary".to_string()),
    };

    let mut config = InstallSettings {
        localization: Some(localization),
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
    assert!(body.contains(
        r#""localization":{"locale":"es_ES.UTF-8","keymap":"es","timezone":"Atlantic/Canary"#
    ));

    let localization = Config {
        locale: None,
        keymap: Some("en".to_string()),
        timezone: None,
    };
    config.localization = Some(localization);

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
    assert!(body.contains(r#""localization":{"keymap":"en"}"#));

    Ok(())
}

#[test]
#[cfg(not(ci))]
async fn test_patch_config() -> Result<(), Box<dyn Error>> {
    let localization = Config {
        locale: Some("es_ES.UTF-8".to_string()),
        keymap: Some("es".to_string()),
        timezone: Some("Atlantic/Canary".to_string()),
    };

    let mut config = InstallSettings {
        localization: Some(localization),
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

    let localization = Config {
        locale: None,
        keymap: Some("en".to_string()),
        timezone: None,
    };
    config.localization = Some(localization);

    let request = Request::builder()
        .uri("/config")
        .header("Content-Type", "application/json")
        .method(Method::PATCH)
        .body(serde_json::to_string(&config)?)
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
    assert!(body.contains(
        r#""localization":{"locale":"es_ES.UTF-8","keymap":"en","timezone":"Atlantic/Canary"#
    ));

    Ok(())
}
