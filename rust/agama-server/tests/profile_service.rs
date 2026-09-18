// Copyright (c) [2026] SUSE LLC
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
use agama_server::{
    profile::profile_service,
    server::web::{server_with_state, ServerState},
};
use agama_utils::{question, test};
use axum::http::{Method, Request, StatusCode};
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
        let schema_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../share");
        std::env::set_var("AGAMA_SCHEMA_DIR", schema_dir.display().to_string());

        let (events_tx, _events_rx) = channel(100);
        let dbus = test::dbus::connection().await.unwrap();

        let questions = question::start(events_tx.clone()).await.unwrap();
        let manager = start_service(events_tx, dbus).await;
        let profile = profile_service().await;

        let service = server_with_state(ServerState::new(manager, questions), profile)
            .expect("Could not create the testing router");
        Context {
            client: Client::new(service),
        }
    }
}

fn post_request(uri: &str, body: &str) -> Request<String> {
    Request::builder()
        .uri(uri)
        .header("Content-Type", "application/json")
        .method(Method::POST)
        .body(body.to_string())
        .unwrap()
}

/// Regression test: sending an empty body (no "path", "url" or "profile" key)
/// used to make the "validate" handler panic (`.expect("Missing profile")`)
/// instead of returning a proper HTTP error response.
#[test_context(Context)]
#[test]
async fn test_validate_without_profile_returns_bad_request(
    ctx: &mut Context,
) -> Result<(), Box<dyn Error>> {
    let request = post_request("/private/profile/validate", "{}");
    let response = ctx.client.send_request(request).await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    Ok(())
}

/// Same regression, but for an empty (not even valid JSON object) body.
#[test_context(Context)]
#[test]
async fn test_validate_with_empty_body_returns_bad_request(
    ctx: &mut Context,
) -> Result<(), Box<dyn Error>> {
    let request = post_request("/private/profile/validate", "");
    let response = ctx.client.send_request(request).await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    Ok(())
}

/// Regression test: sending an empty body used to make the "evaluate"
/// handler panic (`.expect("Missing profile")`) instead of returning a
/// proper HTTP error response.
#[test_context(Context)]
#[test]
async fn test_evaluate_without_profile_returns_bad_request(
    ctx: &mut Context,
) -> Result<(), Box<dyn Error>> {
    let request = post_request("/private/profile/evaluate", "{}");
    let response = ctx.client.send_request(request).await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    Ok(())
}

/// A profile given inline (as the "profile" key) should validate correctly.
#[test_context(Context)]
#[test]
async fn test_validate_with_inline_profile(ctx: &mut Context) -> Result<(), Box<dyn Error>> {
    let body = r#"{"profile": "{}"}"#;
    let request = post_request("/private/profile/validate", body);
    let response = ctx.client.send_request(request).await;
    assert_eq!(response.status(), StatusCode::OK);
    Ok(())
}
