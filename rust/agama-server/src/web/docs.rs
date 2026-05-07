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

use std::path::PathBuf;

use agama_utils::{api::Event, test};
use aide::openapi::{
    Contact, ExternalDocumentation, Info, License, OpenApi, Operation, PathItem, ReferenceOr,
    SchemaObject, SecurityScheme, Server, ServerVariable, Tag,
};
use aide::transform::TransformOperation;
use axum::Json;
use indexmap::IndexMap;
use schemars::schema_for;
use tokio::sync::broadcast;

use crate::test_utils;
use crate::web::error::ErrorResponse;
use crate::web::http::{AuthResponse, LoginRequest};

/// Builds the unified OpenAPI specification for the Agama HTTP API using aide.
///
/// Instantiates an ApiRouter using the test_utils::router function and generates
/// the API from there.
pub async fn build() -> OpenApi {
    let mut api = OpenApi {
        openapi: "3.1.0".into(),
        info: Info {
            title: "Agama HTTP API".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            description: Some(
                "Complete HTTP API for the Agama installer. \
                See https://agama-project.github.io for more information."
                    .to_string(),
            ),
            contact: Some(Contact {
                name: Some("Agama Project Team".to_string()),
                url: Some("https://github.com/agama-project/agama".to_string()),
                email: Some("agama-devel@lists.opensuse.org".to_string()),
                ..Default::default()
            }),
            license: Some(License {
                name: "GPL-2.0".to_string(),
                identifier: None,
                url: Some("https://www.gnu.org/licenses/old-licenses/gpl-2.0.html".to_string()),
                ..Default::default()
            }),
            ..Default::default()
        },
        servers: vec![Server {
            url: "{agamaUrl}".to_string(),
            description: Some("Agama instance URL".to_string()),
            variables: IndexMap::from([(
                "agamaUrl".to_string(),
                ServerVariable {
                    default: "https://agama.local".to_string(),
                    description: Some("URL of the Agama instance".to_string()),
                    ..Default::default()
                },
            )]),
            ..Default::default()
        }],
        tags: vec![
            Tag {
                name: "Authentication".to_string(),
                description: Some("User authentication and session management".to_string()),
                ..Default::default()
            },
            Tag {
                name: "System & Monitoring".to_string(),
                description: Some(
                    "System information, installation status, and progress monitoring".to_string(),
                ),
                ..Default::default()
            },
            Tag {
                name: "Configuration".to_string(),
                description: Some("System configuration management".to_string()),
                ..Default::default()
            },
            Tag {
                name: "Actions".to_string(),
                description: Some("Installation actions and commands".to_string()),
                ..Default::default()
            },
            Tag {
                name: "Issues & Questions".to_string(),
                description: Some("Problem tracking and interactive questions".to_string()),
                ..Default::default()
            },
        ],
        external_docs: Some(ExternalDocumentation {
            description: Some("Full Agama documentation".to_string()),
            url: "https://agama-project.github.io".to_string(),
            ..Default::default()
        }),
        ..Default::default()
    };

    // Add security schemes
    if api.components.is_none() {
        api.components = Some(Default::default());
    }
    if let Some(components) = &mut api.components {
        let mut security_schemes = IndexMap::new();
        security_schemes.insert(
            "bearerAuth".to_string(),
            ReferenceOr::Item(SecurityScheme::Http {
                scheme: "bearer".to_string(),
                bearer_format: Some("JWT".to_string()),
                description: Some(
                    "JWT token obtained from the authentication endpoint".to_string(),
                ),
                extensions: IndexMap::new(),
            }),
        );
        components.security_schemes = security_schemes;
    }

    let share_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../test/share");
    std::env::set_var("AGAMA_SHARE_DIR", share_dir.display().to_string());

    let (events_tx, _events_rx) = broadcast::channel::<Event>(16);
    let dbus = test::dbus::connection().await.unwrap();
    let app = test_utils::router(events_tx.clone(), dbus.clone())
        .await
        .expect("Failed to build the router to build the OpenAPI specification");
    _ = app.finish_api(&mut api);

    // Add global security requirement (all endpoints require authentication by default)
    api.security = vec![IndexMap::from([("bearerAuth".to_string(), vec![])])];

    // Manually add auth endpoint (not auto-generated by aide due to complex return types)
    add_auth_endpoint(&mut api);

    api
}

/// Builds the OpenAPI specification and returns it as a JSON value.
///
/// This function applies post-processing to work around aide's serialization behavior
/// (e.g., empty arrays are skipped, but we need `security: []` on the login endpoint).
pub async fn build_json() -> Result<serde_json::Value, serde_json::Error> {
    let openapi = build().await;
    let mut json_value = serde_json::to_value(&openapi)?;

    // Post-process: Add empty security array to login endpoint to explicitly override global security
    // Note: aide's serialization skips empty arrays (#[serde(skip_serializing_if = "Vec::is_empty")]),
    // but OpenAPI spec requires explicit empty array to override global security
    if let Some(paths) = json_value.get_mut("paths") {
        if let Some(auth_path) = paths.get_mut("/api/auth") {
            if let Some(post_op) = auth_path.get_mut("post") {
                post_op
                    .as_object_mut()
                    .unwrap()
                    .insert("security".to_string(), serde_json::json!([]));
            }
        }
    }

    Ok(json_value)
}

/// Manually adds the authentication endpoint to the OpenAPI spec.
///
/// This is done manually because the auth handlers return complex tuple types
/// (headers + JSON) that aide cannot introspect automatically. However, we use
/// aide's TransformOperation API to build the operations cleanly.
fn add_auth_endpoint(api: &mut OpenApi) {
    let mut auth_path = PathItem::default();

    // POST /api/auth - Login
    let mut login_op = Operation::default();
    let _ = login_docs(TransformOperation::new(&mut login_op));
    login_op.security = vec![]; // Override global security - login doesn't require auth
    auth_path.post = Some(login_op);

    // GET /api/auth - Check session
    let mut session_op = Operation::default();
    let _ = session_docs(TransformOperation::new(&mut session_op));
    auth_path.get = Some(session_op);

    // DELETE /api/auth - Logout
    let mut logout_op = Operation::default();
    let _ = logout_docs(TransformOperation::new(&mut logout_op));
    auth_path.delete = Some(logout_op);

    if let Some(paths) = &mut api.paths {
        paths
            .paths
            .insert("/api/auth".to_string(), ReferenceOr::Item(auth_path));
    }

    // Register schemas in components
    // Note: When using TransformOperation manually (outside the router flow),
    // aide doesn't automatically register schemas in components, so we must add them explicitly
    if let Some(components) = &mut api.components {
        let login_request_schema = schema_for!(LoginRequest);
        let auth_response_schema = schema_for!(AuthResponse);

        components.schemas.insert(
            "LoginRequest".to_string(),
            SchemaObject {
                json_schema: login_request_schema,
                example: None,
                external_docs: None,
            },
        );
        components.schemas.insert(
            "AuthResponse".to_string(),
            SchemaObject {
                json_schema: auth_response_schema,
                example: None,
                external_docs: None,
            },
        );
    }
}

/// Documentation for POST /api/auth (login endpoint)
fn login_docs(op: TransformOperation) -> TransformOperation {
    op.id("login")
        .summary("Authenticate user")
        .description(
            "Authenticates the user with the provided password and returns a JWT bearer token. \
            The token should be included in the Authorization header for subsequent requests. \
            Also sets an HttpOnly session cookie for browser-based clients.",
        )
        .tag("Authentication")
        .input::<Json<LoginRequest>>()
        .response_with::<200, Json<AuthResponse>, _>(|res| {
            res.description("Authentication successful, returns bearer token")
        })
        .response_with::<401, Json<ErrorResponse>, _>(|res| {
            res.description("Authentication failed - invalid credentials")
        })
}

/// Documentation for GET /api/auth (check session endpoint)
fn session_docs(op: TransformOperation) -> TransformOperation {
    op.id("checkSession")
        .summary("Check session status")
        .description(
            "Verifies that the current authentication token is valid. Returns 200 if the \
            user is authenticated, 401 otherwise. Use this endpoint to check if a session \
            is still active.",
        )
        .tag("Authentication")
        .response::<200, ()>()
        .response_with::<401, Json<ErrorResponse>, _>(|res| {
            res.description("Unauthorized - invalid or missing token")
        })
}

/// Documentation for DELETE /api/auth (logout endpoint)
fn logout_docs(op: TransformOperation) -> TransformOperation {
    op.id("logout")
        .summary("End user session")
        .description(
            "Invalidates the current session by clearing the authentication cookie. \
            After logout, the token should no longer be used for authenticated requests.",
        )
        .tag("Authentication")
        .response::<200, ()>()
        .response_with::<401, Json<ErrorResponse>, _>(|res| {
            res.description("Unauthorized - invalid or missing token")
        })
}
