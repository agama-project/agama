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

use agama_mcp::error::BackendError;
use agama_mcp::mode::McpMode;
use agama_mcp::server::{McpBackend, McpServer};
use agama_mcp::web::mcp_router;
use agama_utils::api::question::Question;
use agama_utils::api::status::Status;
use agama_utils::api::{Config, IssueWithScope, Proposal, SystemInfo};
use async_trait::async_trait;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::json;
use std::sync::Arc;
use tower::ServiceExt;

fn sample_system_info() -> SystemInfo {
    SystemInfo {
        manager: Default::default(),
        hostname: agama_utils::api::hostname::SystemInfo {
            r#static: None,
            hostname: "localhost".to_string(),
        },
        l10n: Default::default(),
        software: Default::default(),
        storage: Some(json!({ "disks": ["/dev/sda"] })),
        iscsi: None,
        bootloader: None,
        network: Default::default(),
        s390: None,
    }
}

fn sample_proposal() -> Proposal {
    Proposal {
        hostname: None,
        l10n: None,
        network: Default::default(),
        access: Default::default(),
        software: None,
        storage: None,
        users: None,
    }
}

#[derive(Default)]
struct DummyBackend;

#[async_trait]
impl McpBackend for DummyBackend {
    async fn get_system(&self) -> Result<SystemInfo, BackendError> {
        Ok(sample_system_info())
    }

    async fn set_config(&self, _config: Config) -> Result<(), BackendError> {
        Ok(())
    }

    async fn get_proposal(&self) -> Result<Option<Proposal>, BackendError> {
        Ok(Some(sample_proposal()))
    }

    async fn get_issues(&self) -> Result<Vec<IssueWithScope>, BackendError> {
        Ok(Vec::new())
    }

    async fn commit_install(&self) -> Result<(), BackendError> {
        Ok(())
    }

    async fn get_progress(&self) -> Result<Status, BackendError> {
        Ok(Default::default())
    }

    async fn get_questions(&self) -> Result<Vec<Question>, BackendError> {
        Ok(Vec::new())
    }

    async fn answer_question(
        &self,
        _id: u32,
        _action: String,
        _value: Option<String>,
    ) -> Result<(), BackendError> {
        Ok(())
    }
}

#[tokio::test]
async fn test_web_sse_without_session_id_returns_bad_request() {
    let server = McpServer::with_backend(Arc::new(DummyBackend), McpMode::Full);
    let app = mcp_router(server);

    // In MCP Streamable HTTP, GET without Mcp-Session-Id is rejected with 400 Bad Request
    let request = Request::builder()
        .uri("/")
        .method("GET")
        .header("Host", "localhost")
        .header("Accept", "text/event-stream")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_web_session_handshake_and_sse_stream() {
    let server = McpServer::with_backend(Arc::new(DummyBackend), McpMode::Full);
    let app = mcp_router(server);

    // 1. Initialize via POST to obtain an active Mcp-Session-Id
    let init_req = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            }
        }
    });

    let post_req = Request::builder()
        .uri("/")
        .method("POST")
        .header("Host", "localhost")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json, text/event-stream")
        .body(Body::from(serde_json::to_vec(&init_req).unwrap()))
        .unwrap();

    let init_res = app.clone().oneshot(post_req).await.unwrap();
    assert_eq!(init_res.status(), StatusCode::OK);

    let session_id = init_res
        .headers()
        .get("mcp-session-id")
        .expect("Mcp-Session-Id header expected on initialize response")
        .to_str()
        .unwrap();

    // 2. Connect to the SSE stream passing the established Mcp-Session-Id
    let get_req = Request::builder()
        .uri("/")
        .method("GET")
        .header("Host", "localhost")
        .header("Accept", "text/event-stream")
        .header("Mcp-Session-Id", session_id)
        .body(Body::empty())
        .unwrap();

    let sse_res = app.oneshot(get_req).await.unwrap();
    assert_eq!(sse_res.status(), StatusCode::OK);
    assert_eq!(
        sse_res
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok()),
        Some("text/event-stream")
    );
}

#[tokio::test]
async fn test_web_post_endpoint() {
    let server = McpServer::with_backend(Arc::new(DummyBackend), McpMode::Full);
    let app = mcp_router(server);

    let init_req = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            }
        }
    });

    let request = Request::builder()
        .uri("/")
        .method("POST")
        .header("Host", "localhost")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json, text/event-stream")
        .body(Body::from(serde_json::to_vec(&init_req).unwrap()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}
