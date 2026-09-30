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

use aide::axum::ApiRouter;
use axum::{
    body::{to_bytes, Body},
    extract::Request,
    response::Response,
};
use tower::ServiceExt;

/// Turns a request or response body into a string.
pub async fn body_to_string(body: Body) -> String {
    let bytes = to_bytes(body, usize::MAX).await.unwrap();
    String::from_utf8(bytes.to_vec()).unwrap()
}

/// Wrapper around a router to send request.
///
/// It hides the details of the communication with the server.
pub struct Client {
    router: ApiRouter,
}

impl Client {
    /// Creates a new client.
    ///
    /// * `router`: service router.
    pub fn new(router: ApiRouter) -> Self {
        Self { router }
    }

    /// Sends a message.
    pub async fn send_request(&self, request: Request<String>) -> Response<Body> {
        self.router
            .clone()
            .oneshot(request)
            .await
            .expect("Could not send the request: {request:?}")
    }
}

use std::path::PathBuf;
use std::sync::OnceLock;

static INIT_TEST_SCHEMAS: OnceLock<()> = OnceLock::new();

/// Cargo has no built-in pre-test hooks to run `cargo xtask openapi` before `cargo test`.
/// To avoid committing generated schemas to git while ensuring tests always run against
/// the latest compiled types in clean environments, generate the schema dynamically on test setup.
pub async fn ensure_test_schemas() {
    if INIT_TEST_SCHEMAS.get().is_some() {
        return;
    }
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let out_dir = manifest_dir.join("../out");
    let schemas_dir = out_dir.join("schemas");
    _ = std::fs::create_dir_all(&schemas_dir);

    if let Ok(mut json_value) = agama_server::web::docs::build_json().await {
        if let Some(component) = json_value
            .pointer_mut("/components/schemas/Config")
            .map(|v| v.take())
        {
            let mut schema_obj = component;
            if let Some(map) = schema_obj.as_object_mut() {
                map.insert(
                    "$schema".to_string(),
                    serde_json::json!("https://json-schema.org/draft/2019-09/schema"),
                );
                map.insert(
                    "$id".to_string(),
                    serde_json::json!("file:///usr/share/agama/openapi/latest/schemas/config.schema.json"),
                );
                if let Some(components) = json_value.get("components") {
                    map.insert("components".to_string(), components.clone());
                }
            }
            let config_path = schemas_dir.join("config.schema.json");
            if let Ok(mut f) = std::fs::File::create(config_path) {
                use std::io::Write;
                _ = f.write_all(serde_json::to_string_pretty(&schema_obj).unwrap().as_bytes());
            }
        }
    }
    INIT_TEST_SCHEMAS.get_or_init(|| ());
}
