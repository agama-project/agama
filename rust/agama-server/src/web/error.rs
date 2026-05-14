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

//! Shared error handling utilities for HTTP API responses.

use aide::OperationIo;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use schemars::JsonSchema;
use serde::Serialize;

/// Error response returned by API endpoints
#[derive(Serialize, JsonSchema, OperationIo)]
#[aide(output)]
pub struct ErrorResponse {
    /// Error message
    pub error: String,
}

impl ErrorResponse {
    /// Creates a new error response with the given message.
    pub fn new(error: impl std::error::Error) -> Self {
        Self {
            error: error.to_string(),
        }
    }

    /// Creates an HTTP response with the given status code.
    pub fn into_response_with_status(self, status: StatusCode) -> Response {
        tracing::warn!("Server return error {} with status {}", self.error, status);
        (status, Json(self)).into_response()
    }

    /// Creates a BAD_REQUEST (400) response.
    pub fn bad_request(error: impl std::error::Error) -> Response {
        Self::new(error).into_response_with_status(StatusCode::BAD_REQUEST)
    }

    /// Creates an INTERNAL_SERVER_ERROR (500) response.
    pub fn internal_server_error(error: impl std::error::Error) -> Response {
        Self::new(error).into_response_with_status(StatusCode::INTERNAL_SERVER_ERROR)
    }

    /// Creates an UNPROCESSABLE_ENTITY (422) response.
    pub fn unprocessable_entity(error: impl std::error::Error) -> Response {
        Self::new(error).into_response_with_status(StatusCode::UNPROCESSABLE_ENTITY)
    }
}
