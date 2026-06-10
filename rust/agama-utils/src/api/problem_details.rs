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

//! Problem Details for HTTP APIs (RFC 9457)
//!
//! This module defines the wire format for API errors following RFC 9457.
//! These types are shared between the server and client.

use gettextrs::gettext;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Problem Details for HTTP APIs (RFC 9457)
///
/// This enum represents different types of API errors following RFC 9457.
/// Each variant contains only the fields relevant to that specific error type.
///
/// The `type` field (used for i18n) is determined by the enum variant,
/// and the HTTP status code is determined by the server.
///
/// # Examples
///
/// Deserializing a schema validation error from JSON:
///
/// ```
/// # use agama_utils::api::ProblemDetails;
/// let json = r#"{
///   "type": "tag:agama.opensuse.org,2026:problems/schema-validation-failed",
///   "title": "Schema Validation Failed",
///   "detail": "The provided configuration does not match the required schema",
///   "errors": ["/network/hostname: is required"]
/// }"#;
///
/// let problem: ProblemDetails = serde_json::from_str(json).unwrap();
/// match problem {
///     ProblemDetails::SchemaValidationFailed { errors, .. } => {
///         assert_eq!(errors.len(), 1);
///     }
///     _ => panic!("Expected SchemaValidationFailed"),
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ProblemDetails {
    /// Schema validation failed (HTTP 400)
    #[serde(
        rename = "tag:agama.opensuse.org,2026:problems/schema-validation-failed",
        rename_all = "camelCase"
    )]
    SchemaValidationFailed {
        /// Short summary
        title: String,
        /// Detailed explanation
        #[serde(skip_serializing_if = "Option::is_none")]
        detail: Option<String>,
        /// List of validation error messages
        errors: Vec<String>,
    },

    /// Invalid JSON in request body (HTTP 400)
    #[serde(
        rename = "tag:agama.opensuse.org,2026:problems/invalid-json",
        rename_all = "camelCase"
    )]
    InvalidJson {
        title: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        detail: Option<String>,
    },

    /// Network error - upstream service unreachable (HTTP 502)
    #[serde(
        rename = "tag:agama.opensuse.org,2026:problems/network-error",
        rename_all = "camelCase"
    )]
    NetworkError {
        title: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        detail: Option<String>,
        /// URL that failed
        url: String,
        /// HTTP status from upstream (if available)
        #[serde(skip_serializing_if = "Option::is_none")]
        http_status: Option<u16>,
    },

    /// File system error (HTTP 500)
    #[serde(
        rename = "tag:agama.opensuse.org,2026:problems/file-system-error",
        rename_all = "camelCase"
    )]
    FileSystemError {
        title: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        detail: Option<String>,
        /// File path
        path: String,
        /// Operation that failed (read, write, delete, etc.)
        operation: String,
    },

    /// D-Bus service error (HTTP 500)
    #[serde(
        rename = "tag:agama.opensuse.org,2026:problems/dbus-error",
        rename_all = "camelCase"
    )]
    DBusError {
        title: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        detail: Option<String>,
        /// D-Bus service name
        service: String,
        /// D-Bus object path
        #[serde(skip_serializing_if = "Option::is_none")]
        object_path: Option<String>,
        /// D-Bus method name
        #[serde(skip_serializing_if = "Option::is_none")]
        method: Option<String>,
    },

    /// Internal server error (HTTP 500)
    #[serde(
        rename = "tag:agama.opensuse.org,2026:problems/internal-error",
        rename_all = "camelCase"
    )]
    InternalError { title: String, detail: String },

    /// Resource not found (HTTP 404)
    #[serde(
        rename = "tag:agama.opensuse.org,2026:problems/not-found",
        rename_all = "camelCase"
    )]
    NotFound { title: String, detail: String },

    /// Unauthorized - authentication required (HTTP 401)
    #[serde(
        rename = "tag:agama.opensuse.org,2026:problems/unauthorized",
        rename_all = "camelCase"
    )]
    Unauthorized { title: String, detail: String },

    /// Generic error without specific type (HTTP 500)
    #[serde(rename = "about:blank", rename_all = "camelCase")]
    Generic { title: String, detail: String },
}

impl ProblemDetails {
    /// Creates a schema validation failed problem
    pub fn schema_validation_failed(errors: Vec<String>) -> Self {
        Self::SchemaValidationFailed {
            title: gettext("Schema validation failed"),
            detail: Some(gettext(
                "The provided configuration does not match the required schema",
            )),
            errors,
        }
    }

    /// Creates an invalid JSON problem
    pub fn invalid_json(detail: impl Into<String>) -> Self {
        Self::InvalidJson {
            title: gettext("Invalid JSON"),
            detail: Some(detail.into()),
        }
    }

    /// Creates a network error problem
    pub fn network_error(url: impl Into<String>, detail: impl Into<String>) -> Self {
        Self::NetworkError {
            title: gettext("Network error"),
            detail: Some(detail.into()),
            url: url.into(),
            http_status: None,
        }
    }

    /// Creates a network error problem with HTTP status
    pub fn network_error_with_status(
        url: impl Into<String>,
        http_status: u16,
        detail: impl Into<String>,
    ) -> Self {
        Self::NetworkError {
            title: gettext("Network error"),
            detail: Some(detail.into()),
            url: url.into(),
            http_status: Some(http_status),
        }
    }

    /// Creates a file system error problem
    pub fn file_system_error(
        path: impl Into<String>,
        operation: impl Into<String>,
        detail: impl Into<String>,
    ) -> Self {
        Self::FileSystemError {
            title: gettext("File system error"),
            detail: Some(detail.into()),
            path: path.into(),
            operation: operation.into(),
        }
    }

    /// Creates a D-Bus error problem
    pub fn dbus_error(service: impl Into<String>, detail: impl Into<String>) -> Self {
        Self::DBusError {
            title: gettext("D-Bus service error"),
            detail: Some(detail.into()),
            service: service.into(),
            object_path: None,
            method: None,
        }
    }

    /// Creates a D-Bus error problem with full context
    pub fn dbus_error_full(
        service: impl Into<String>,
        object_path: Option<String>,
        method: Option<String>,
        detail: impl Into<String>,
    ) -> Self {
        Self::DBusError {
            title: gettext("D-Bus service error"),
            detail: Some(detail.into()),
            service: service.into(),
            object_path,
            method,
        }
    }

    /// Creates an internal error problem
    pub fn internal_error(detail: impl Into<String>) -> Self {
        Self::InternalError {
            title: gettext("Internal server error"),
            detail: detail.into(),
        }
    }

    /// Creates a not found problem
    pub fn not_found(resource: impl Into<String>) -> Self {
        Self::NotFound {
            title: gettext("Not Found"),
            detail: format!("Resource not found: {}", resource.into()),
        }
    }

    /// Creates an unauthorized problem
    pub fn unauthorized(detail: impl Into<String>) -> Self {
        Self::Unauthorized {
            title: gettext("Unauthorized"),
            detail: detail.into(),
        }
    }

    /// Creates a generic problem
    pub fn generic(title: impl Into<String>, detail: impl Into<String>) -> Self {
        Self::Generic {
            title: title.into(),
            detail: detail.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deserialize_schema_validation_failed() {
        let json = r#"{
            "type": "tag:agama.opensuse.org,2026:problems/schema-validation-failed",
            "title": "Schema Validation Failed",
            "detail": "Config invalid",
            "errors": ["/network/hostname: is required"]
        }"#;

        let problem: ProblemDetails = serde_json::from_str(json).unwrap();
        match problem {
            ProblemDetails::SchemaValidationFailed { title, errors, .. } => {
                assert_eq!(title, "Schema Validation Failed");
                assert_eq!(errors.len(), 1);
                assert_eq!(errors[0], "/network/hostname: is required");
            }
            _ => panic!("Expected SchemaValidationFailed"),
        }
    }

    #[test]
    fn test_deserialize_network_error() {
        let json = r#"{
            "type": "tag:agama.opensuse.org,2026:problems/network-error",
            "title": "Network Error",
            "url": "https://example.com",
            "httpStatus": 503
        }"#;

        let problem: ProblemDetails = serde_json::from_str(json).unwrap();
        match problem {
            ProblemDetails::NetworkError {
                url, http_status, ..
            } => {
                assert_eq!(url, "https://example.com");
                assert_eq!(http_status, Some(503));
            }
            _ => panic!("Expected NetworkError"),
        }
    }

    #[test]
    fn test_deserialize_generic() {
        let json = r#"{
            "type": "about:blank",
            "title": "Something went wrong",
            "detail": "An unexpected error occurred"
        }"#;

        let problem: ProblemDetails = serde_json::from_str(json).unwrap();
        match problem {
            ProblemDetails::Generic { title, detail, .. } => {
                assert_eq!(title, "Something went wrong");
                assert_eq!(detail, "An unexpected error occurred");
            }
            _ => panic!("Expected Generic"),
        }
    }

    #[test]
    fn test_serialize_and_deserialize_roundtrip() {
        let original = ProblemDetails::SchemaValidationFailed {
            title: "Test".to_string(),
            detail: Some("Detail".to_string()),
            errors: vec!["error1".to_string()],
        };

        let json = serde_json::to_string(&original).unwrap();
        let deserialized: ProblemDetails = serde_json::from_str(&json).unwrap();

        assert_eq!(original, deserialized);
    }
}
