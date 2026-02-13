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
use agama_manager::test_utils::start_service;
use agama_server::server::web::{server_with_state, ServerState};
use agama_utils::{question, test};
use axum::http::{Method, Request, StatusCode};
use common::body_to_string;
use std::{error::Error, path::PathBuf};
use test_context::{test_context, AsyncTestContext};
use tokio::{sync::broadcast::channel, test};

use crate::common::Client;

struct Context {
    client: Client,
}

impl AsyncTestContext for Context {
    async fn setup() -> Context {
        let share_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share");
        std::env::set_var("AGAMA_SHARE_DIR", share_dir.display().to_string());
        let schema_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../agama-lib/share");
        std::env::set_var("AGAMA_SCHEMA_DIR", schema_dir.display().to_string());

        let (events_tx, mut events_rx) = channel(16);
        let dbus = test::dbus::connection().await.unwrap();

        tokio::spawn(async move {
            while let Ok(event) = events_rx.recv().await {
                println!("{:?}", event);
            }
        });

        let questions = question::start(events_tx.clone()).await.unwrap();
        let manager = start_service(events_tx, dbus).await;

        let service = server_with_state(ServerState::new(manager, questions))
            .expect("Could not create the testing router");
        Context {
            client: Client::new(service),
        }
    }
}

async fn select_product(client: &Client) -> Result<(), Box<dyn Error>> {
    let json = r#"{"product": {"id": "SLES", "mode": "standard"}}"#;
    let request = Request::builder()
        .uri("/config")
        .header("Content-Type", "application/json")
        .method(Method::PUT)
        .body(json.to_string())?;
    let response = client.send_request(request).await;
    assert_eq!(
        response.status(),
        StatusCode::OK,
        "Failed to select the product"
    );
    Ok(())
}

#[test_context(Context)]
#[test]
async fn test_get_extended_config(ctx: &mut Context) -> Result<(), Box<dyn Error>> {
    let request = Request::builder()
        .uri("/extended_config")
        .body("".to_string())
        .unwrap();

    let response = ctx.client.send_request(request).await;
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(r#""locale""#));
    assert!(body.contains(r#""keymap""#));
    assert!(body.contains(r#""timezone""#));

    Ok(())
}

#[test_context(Context)]
#[test]
async fn test_get_empty_config(ctx: &mut Context) -> Result<(), Box<dyn Error>> {
    let request = Request::builder()
        .uri("/config")
        .body("".to_string())
        .unwrap();

    let response = ctx.client.send_request(request).await;
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert_eq!(&body, "{}");

    Ok(())
}

#[test_context(Context)]
#[test]
async fn test_put_config_success(ctx: &mut Context) -> Result<(), Box<dyn Error>> {
    let json = r#"
        {
          "product": { "id": "SLES", "mode": "standard" },
          "l10n": {
            "locale": "es_ES.UTF-8", "keymap": "es", "timezone": "Atlantic/Canary"
          }
        }
    "#;

    let request = Request::builder()
        .uri("/config")
        .header("Content-Type", "application/json")
        .method(Method::PUT)
        .body(json.to_string())
        .unwrap();

    let response = ctx.client.send_request(request).await;
    assert_eq!(response.status(), StatusCode::OK);

    let request = Request::builder()
        .uri("/config")
        .body("".to_string())
        .unwrap();

    let response = ctx.client.send_request(request).await;
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert!(body
        .contains(r#""l10n":{"locale":"es_ES.UTF-8","keymap":"es","timezone":"Atlantic/Canary"#));

    Ok(())
}

#[test_context(Context)]
#[test]
async fn test_put_config_without_mode(ctx: &mut Context) -> Result<(), Box<dyn Error>> {
    let json = r#"
        {
          "product": { "id": "SLES" },
          "l10n": {
            "locale": "es_ES.UTF-8", "keymap": "es", "timezone": "Atlantic/Canary"
          }
        }
    "#;

    let request = Request::builder()
        .uri("/config")
        .header("Content-Type", "application/json")
        .method(Method::PUT)
        .body(json.to_string())
        .unwrap();

    let response = ctx.client.send_request(request).await;
    assert_eq!(response.status(), StatusCode::OK);

    let request = Request::builder()
        .uri("/extended_config")
        .body("".to_string())
        .unwrap();

    let response = ctx.client.send_request(request).await;
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(r#""product":{"id":"SLES","mode":"standard"}"#));

    Ok(())
}

#[test_context(Context)]
#[test]
async fn test_put_config_invalid_json(ctx: &mut Context) -> Result<(), Box<dyn Error>> {
    let json = r#"{"key":"value"}"#;
    let request = Request::builder()
        .uri("/config")
        .header("Content-Type", "application/json")
        .method(Method::PUT)
        .body(json.to_string())
        .unwrap();

    let response = ctx.client.send_request(request).await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    Ok(())
}

#[test_context(Context)]
#[test]
async fn test_patch_config_success(ctx: &mut Context) -> Result<(), Box<dyn Error>> {
    select_product(&ctx.client).await?;

    let json = r#"
        {
          "l10n": {
            "locale": "es_ES.UTF-8", "keymap": "es", "timezone": "Atlantic/Canary"
          }
        }
    "#;

    let request = Request::builder()
        .uri("/config")
        .header("Content-Type", "application/json")
        .method(Method::PATCH)
        .body(json.to_string())
        .unwrap();

    let response = ctx.client.send_request(request).await;
    assert_eq!(response.status(), StatusCode::OK);

    let json = r#"{ "update": { "l10n": { "keymap": "en" } } }"#;
    let request = Request::builder()
        .uri("/config")
        .header("Content-Type", "application/json")
        .method(Method::PATCH)
        .body(json.to_string())
        .unwrap();

    let response = ctx.client.send_request(request).await;
    assert_eq!(response.status(), StatusCode::OK);
    let request = Request::builder()
        .uri("/config")
        .body("".to_string())
        .unwrap();

    let response = ctx.client.send_request(request).await;
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(r#""l10n":{"keymap":"en"}"#));
    assert!(body.contains(r#""product":{"id":"SLES","mode":"standard"}"#));

    Ok(())
}

#[test_context(Context)]
#[test]
async fn test_patch_config_invalid_json(ctx: &mut Context) -> Result<(), Box<dyn Error>> {
    let json = r#"{"update": {"key":"value"}}"#;
    let request = Request::builder()
        .uri("/config")
        .header("Content-Type", "application/json")
        .method(Method::PATCH)
        .body(json.to_string())
        .unwrap();

    let response = ctx.client.send_request(request).await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    Ok(())
}
