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

use std::fmt::Display;

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

    /// Internal server error (HTTP 500)
    #[serde(
        rename = "tag:agama.opensuse.org,2026:problems/internal-error",
        rename_all = "camelCase"
    )]
    InternalError { title: String, detail: String },

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

    /// Creates an internal error problem
    pub fn internal_error(detail: impl Into<String>) -> Self {
        Self::InternalError {
            title: gettext("Internal server error"),
            detail: detail.into(),
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

impl Display for ProblemDetails {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::SchemaValidationFailed {
                title,
                detail,
                errors,
            } => {
                let body = errors
                    .iter()
                    .map(|e| format!("  - {e}"))
                    .collect::<Vec<_>>()
                    .join("\n");
                write_problem(f, title, detail.as_deref(), Some(&body))?
            }

            Self::Unauthorized { title, detail }
            | Self::InternalError { title, detail }
            | Self::Generic { title, detail } => write_problem(f, title, Some(detail), None)?,

            ProblemDetails::InvalidJson { title, detail } => {
                write_problem(f, title, detail.as_deref(), None)?
            }
        }

        Ok(())
    }
}

pub fn write_problem(
    f: &mut std::fmt::Formatter<'_>,
    title: &str,
    detail: Option<&str>,
    body: Option<&str>,
) -> std::fmt::Result {
    writeln!(f, "{}", gettext("Error:"))?;
    writeln!(f, "{}", title)?;
    if let Some(detail) = detail {
        let label = gettext("Details:");
        writeln!(f, "\n{label}\n{detail}")?;
    }

    if let Some(body) = body {
        writeln!(f, "\n{body}")?;
    }

    Ok(())
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
