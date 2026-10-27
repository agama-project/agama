// Copyright (c) [2025-2026] SUSE LLC
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
use agama_lib::profile::ValidationOutcome;
use agama_manager::test_utils::start_service;
use agama_server::{
    profile::profile_service,
    server::web::{server_with_state, ServerState},
};
use agama_utils::{
    api::{event, status::Task, Event},
    question, test,
};
use axum::http::{Method, Request, StatusCode};
use common::body_to_string;
use std::{error::Error, path::PathBuf};
use test_context::{test_context, AsyncTestContext};
use tokio::{sync::broadcast::channel, test};

use crate::common::Client;

struct Context {
    client: Client,
    events: event::Receiver,
}

impl AsyncTestContext for Context {
    async fn setup() -> Context {
        common::ensure_test_schemas().await;
        let share_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share");
        std::env::set_var("AGAMA_SHARE_DIR", share_dir.display().to_string());
        let schema_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../share");
        std::env::set_var("AGAMA_SCHEMA_DIR", schema_dir.display().to_string());

        let (events_tx, events_rx) = channel(100);
        let dbus = test::dbus::connection().await.unwrap();

        let questions = question::start(events_tx.clone()).await.unwrap();
        let manager = start_service(events_tx, dbus).await;
        let profile = profile_service().await;

        let service = server_with_state(ServerState::new(manager, questions), profile)
            .expect("Could not create the testing router");
        Context {
            client: Client::new(service),
            events: events_rx,
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

// Waits until the configuration is applied.
//
// NOTE: temporarily it waits for the "software_config" task to be completed.
// In the future we plan to add an specific event.
async fn wait_until_finished(events: &mut event::Receiver) {
    const TASK_NAME: &str = "software_config";
    loop {
        match events.recv().await {
            Ok(Event::TaskFinished {
                task: Task { name, .. },
                ..
            }) if name.as_str() == TASK_NAME => break,

            Ok(_event) => {}

            Err(error) => {
                eprintln!("Error receiving events: {error}");
            }
        }
    }
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

    wait_until_finished(&mut ctx.events).await;

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

    wait_until_finished(&mut ctx.events).await;

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

    wait_until_finished(&mut ctx.events).await;

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
    wait_until_finished(&mut ctx.events).await;

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

#[test_context(Context)]
#[test]
async fn test_system_matches_schema(ctx: &mut Context) -> Result<(), Box<dyn Error>> {
    let request = Request::builder()
        .uri("/system")
        .body("".to_string())
        .unwrap();

    let response = ctx.client.send_request(request).await;
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;

    let validator = common::build_test_validator("SystemInfo").await;
    match validator.validate_str(&body)? {
        ValidationOutcome::Valid => {}
        ValidationOutcome::NotValid(errors) => {
            panic!(
                "GET /system response failed schema validation:\n{:#?}",
                errors
            );
        }
    }

    Ok(())
}

#[test_context(Context)]
#[test]
async fn test_proposal_matches_schema(ctx: &mut Context) -> Result<(), Box<dyn Error>> {
    select_product(&ctx.client).await?;

    let request = Request::builder()
        .uri("/proposal")
        .body("".to_string())
        .unwrap();

    let response = ctx.client.send_request(request).await;
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;

    let validator = common::build_test_validator("Proposal").await;
    match validator.validate_str(&body)? {
        ValidationOutcome::Valid => {}
        ValidationOutcome::NotValid(errors) => {
            panic!(
                "GET /proposal response failed schema validation:\n{:#?}",
                errors
            );
        }
    }

    Ok(())
}

#[tokio::test]
async fn test_validate_config_full() -> Result<(), Box<dyn Error>> {
    let validator = common::build_test_validator("Config").await;
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let full_example = manifest_dir.join("../share/examples/config_full.json");
    let result = validator.validate_file(&full_example)?;
    match result {
        ValidationOutcome::Valid => {}
        ValidationOutcome::NotValid(errors) => {
            panic!("Comprehensive config failed validation:\n{:#?}", errors);
        }
    }
    Ok(())
}

#[tokio::test]
async fn test_validate_profile_tw_invalid() -> Result<(), Box<dyn Error>> {
    let validator = common::build_test_validator("Config").await;
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let invalid_example = manifest_dir.join("../share/examples/profile_tw_invalid.json");
    let result = validator.validate_file(&invalid_example)?;
    match result {
        ValidationOutcome::Valid => {
            panic!("Invalid profile should have failed validation");
        }
        ValidationOutcome::NotValid(errors) => {
            assert!(!errors.is_empty());
            for err in &errors {
                assert!(
                    !err.contains("anyOf"),
                    "Error should not mention 'anyOf', but got: {}",
                    err
                );
            }
        }
    }
    Ok(())
}

#[tokio::test]
async fn test_validate_unknown_field_rejected() -> Result<(), Box<dyn Error>> {
    let validator = common::build_test_validator("Config").await;
    let json_with_unknown_field = r#"
    {
        "bootloader": {
            "unknownKey": true
        }
    }
    "#;
    let result = validator.validate_str(json_with_unknown_field)?;
    match result {
        ValidationOutcome::Valid => {
            panic!("Profile with unknown key should have failed validation");
        }
        ValidationOutcome::NotValid(errors) => {
            assert!(!errors.is_empty());
            assert!(
                errors.iter().any(|e| e.contains("unknownKey")),
                "Expected error mentioning unknownKey, got: {:#?}",
                errors
            );
        }
    }
    Ok(())
}

#[tokio::test]
async fn test_validate_invalid_enum_rejected_cleanly() -> Result<(), Box<dyn Error>> {
    let validator = common::build_test_validator("Config").await;
    let json_with_invalid_enum = r#"
    {
        "access": {
            "ssh": "invalid_value"
        }
    }
    "#;
    let result = validator.validate_str(json_with_invalid_enum)?;
    match result {
        ValidationOutcome::Valid => {
            panic!("Profile with invalid enum should have failed validation");
        }
        ValidationOutcome::NotValid(errors) => {
            assert!(!errors.is_empty());
            for err in &errors {
                assert!(
                    !err.contains("oneOf") && !err.contains("anyOf"),
                    "Error should not mention 'oneOf' or 'anyOf', but got: {}",
                    err
                );
            }
        }
    }
    Ok(())
}
