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
use tokio::sync::OnceCell;

static OPENAPI_SPEC: OnceCell<serde_json::Value> = OnceCell::const_new();

fn write_test_schema(
    json_value: &serde_json::Value,
    component_name: &str,
    file_name: &str,
    schemas_dir: &std::path::Path,
) {
    if let Some(component) = json_value
        .pointer(&format!("/components/schemas/{}", component_name))
        .cloned()
    {
        let mut schema_obj = component;
        if let Some(map) = schema_obj.as_object_mut() {
            map.insert(
                "$schema".to_string(),
                serde_json::json!("https://json-schema.org/draft/2019-09/schema"),
            );
            map.insert(
                "$id".to_string(),
                serde_json::json!(format!(
                    "file:///usr/share/agama/openapi/nightly/schemas/{}",
                    file_name
                )),
            );
            if let Some(components) = json_value.get("components") {
                map.insert("components".to_string(), components.clone());
            }
        }
        let file_path = schemas_dir.join(file_name);
        if let Ok(mut f) = std::fs::File::create(file_path) {
            use std::io::Write;
            _ = f.write_all(
                serde_json::to_string_pretty(&schema_obj)
                    .unwrap()
                    .as_bytes(),
            );
        }
    }
}

/// Ensures that the latest JSON schemas are generated and available in `out/schemas/`.
///
/// # Why this is needed
///
/// In development environments (unlike production where schemas are installed in `/usr/share`),
/// when tests invoke HTTP endpoints like `PUT /config` or `PATCH /config`, the server's request
/// handler (`agama_server::server::config_schema::check`) validates incoming payloads using
/// `agama_lib::profile::ProfileValidator::default_schema()`.
///
/// `ProfileValidator::default_schema()` searches for `../out/schemas/config.schema.json` on disk.
/// Since Cargo does not provide a pre-test hook to run `cargo xtask openapi` automatically,
/// this function dynamically builds the OpenAPI specification via `docs::build_json()`, writes
/// `config.schema.json` (as well as `proposal.schema.json` and `system.schema.json`) into
/// `out/schemas/`, and caches the resulting spec in memory via [`OnceCell`].
///
/// This guarantees that:
/// 1. `ProfileValidator::default_schema()` always finds an up-to-date schema on disk during HTTP test runs.
/// 2. Schema generation and disk writes run exactly once across all tests in the test process.
pub async fn ensure_test_schemas() -> &'static serde_json::Value {
    OPENAPI_SPEC
        .get_or_init(|| async {
            let json_value = agama_server::web::docs::build_json()
                .await
                .expect("Failed to build OpenAPI specification");

            let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
            let schemas_dir = manifest_dir.join("../out/schemas");
            _ = std::fs::create_dir_all(&schemas_dir);

            write_test_schema(&json_value, "Config", "config.schema.json", &schemas_dir);
            write_test_schema(
                &json_value,
                "Proposal",
                "proposal.schema.json",
                &schemas_dir,
            );
            write_test_schema(
                &json_value,
                "SystemInfo",
                "system.schema.json",
                &schemas_dir,
            );

            json_value
        })
        .await
}

/// Builds an in-memory [`ProfileValidator`] for a given component directly from the
/// cached OpenAPI spec without requiring `out/schemas` on disk or running `xtask`.
pub async fn build_test_validator(component_name: &str) -> agama_lib::profile::ProfileValidator {
    let json_value = ensure_test_schemas().await;
    let mut schema_obj = json_value
        .pointer(&format!("/components/schemas/{}", component_name))
        .cloned()
        .unwrap_or_else(|| panic!("Component {} not found in OpenAPI spec", component_name));

    if let Some(map) = schema_obj.as_object_mut() {
        if let Some(components) = json_value.get("components") {
            map.insert("components".to_string(), components.clone());
        }
    }

    agama_lib::profile::ProfileValidator::from_value(&schema_obj).expect("valid schema")
}
