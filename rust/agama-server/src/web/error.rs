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

//! Error handling utilities for HTTP API responses.
//!
//! This module provides server-specific functionality for RFC 9457 Problem Details.
//! The core types and constructor methods are defined in `agama_utils::api::ProblemDetails`.

use agama_utils::api::ProblemDetails;
use aide::OperationIo;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use schemars::JsonSchema;
use serde::Serialize;

/// Extension trait for server-specific ProblemDetails functionality
pub trait ProblemDetailsExt {
    /// Returns the HTTP status code for this problem
    fn status_code(&self) -> StatusCode;

    /// Convert to HTTP response (convenience method)
    fn into_response(self) -> Response;
}

impl ProblemDetailsExt for ProblemDetails {
    fn status_code(&self) -> StatusCode {
        match self {
            ProblemDetails::SchemaValidationFailed { .. } => StatusCode::BAD_REQUEST,
            ProblemDetails::InvalidJson { .. } => StatusCode::BAD_REQUEST,
            ProblemDetails::NetworkError { .. } => StatusCode::BAD_GATEWAY,
            ProblemDetails::FileSystemError { .. } => StatusCode::INTERNAL_SERVER_ERROR,
            ProblemDetails::DBusError { .. } => StatusCode::INTERNAL_SERVER_ERROR,
            ProblemDetails::InternalError { .. } => StatusCode::INTERNAL_SERVER_ERROR,
            ProblemDetails::NotFound { .. } => StatusCode::NOT_FOUND,
            ProblemDetails::Unauthorized { .. } => StatusCode::UNAUTHORIZED,
            ProblemDetails::Generic { .. } => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn into_response(self) -> Response {
        ProblemDetailsResponse::from(self).into_response()
    }
}

/// Wrapper to make ProblemDetails work with aide's OpenAPI generation and axum responses
#[derive(Debug, Clone, Serialize, JsonSchema, OperationIo)]
#[aide(output)]
#[serde(transparent)]
#[schemars(transparent)]
pub struct ProblemDetailsResponse(pub ProblemDetails);

impl ProblemDetailsResponse {
    /// Create a new ProblemDetailsResponse from ProblemDetails
    pub fn new(problem: ProblemDetails) -> Self {
        Self(problem)
    }
}

impl From<ProblemDetails> for ProblemDetailsResponse {
    fn from(problem: ProblemDetails) -> Self {
        Self(problem)
    }
}

impl IntoResponse for ProblemDetailsResponse {
    fn into_response(self) -> Response {
        let status = self.0.status_code();
        (
            status,
            [(axum::http::header::CONTENT_TYPE, "application/problem+json")],
            Json(self.0),
        )
            .into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_schema_validation_failed() {
        let problem = ProblemDetails::schema_validation_failed(vec![
            "/network/hostname: is required".to_string(),
        ]);

        assert_eq!(problem.status_code(), StatusCode::BAD_REQUEST);

        let json = serde_json::to_value(&problem).unwrap();
        // Title is translated, so just check it's present and non-empty
        assert!(json["title"].is_string());
        assert!(!json["title"].as_str().unwrap().is_empty());
        assert!(json["errors"].is_array());
        assert_eq!(json["errors"][0], "/network/hostname: is required");
        // Ensure status field is NOT in JSON
        assert!(json.get("status").is_none());
    }

    #[test]
    fn test_network_error() {
        let problem = ProblemDetails::network_error_with_status(
            "https://example.com",
            503,
            "Connection timeout",
        );

        assert_eq!(problem.status_code(), StatusCode::BAD_GATEWAY);

        let json = serde_json::to_value(&problem).unwrap();
        assert_eq!(json["url"], "https://example.com");
        assert_eq!(json["httpStatus"], 503);
    }

    #[test]
    fn test_dbus_error() {
        let problem = ProblemDetails::dbus_error_full(
            "org.freedesktop.NetworkManager",
            Some("/org/freedesktop/NetworkManager".to_string()),
            Some("GetDevices".to_string()),
            "Method call failed",
        );

        assert_eq!(problem.status_code(), StatusCode::INTERNAL_SERVER_ERROR);

        let json = serde_json::to_value(&problem).unwrap();
        assert_eq!(json["service"], "org.freedesktop.NetworkManager");
        assert_eq!(json["objectPath"], "/org/freedesktop/NetworkManager");
        assert_eq!(json["method"], "GetDevices");
    }

    #[test]
    fn test_generic_problem() {
        let problem = ProblemDetails::generic("Custom Error", "Something unusual happened");

        let json = serde_json::to_value(&problem).unwrap();
        assert_eq!(json["type"], "about:blank"); // RFC 9457 standard generic type
        assert_eq!(json["title"], "Custom Error");
    }
}
