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

//! Error types for the Agama MCP Server.
//!
//! MCP Error Handling Model:
//! - **Tool-level errors (`tool_error`)**: Returned as `Ok(CallToolResult)` with `isError: true`, sending actionable feedback to the LLM's context window so it can self-correct.
//! - **Protocol-level errors (`Error`)**: Converted into JSON-RPC `ErrorData` (`error: { code, message }`), aborting the call at transport level (used for permission denials and internal crashes).

use agama_utils::question;
use rmcp::handler::server::tool::IntoCallToolResult;
use rmcp::model::{CallToolResponse, ErrorCode, ErrorData};

/// Internal backend errors from Agama actors, converted to `tool_error` so the AI sees why the action failed.
#[derive(thiserror::Error, Debug)]
pub enum BackendError {
    #[error("Manager error: {0}")]
    Manager(#[from] agama_manager::service::Error),

    #[error("Questions error: {0}")]
    Questions(#[from] question::service::Error),

    #[error("{0}")]
    Other(String),
}

/// Protocol-level errors returning JSON-RPC `error: { code, message }` instead of tool output.
#[derive(thiserror::Error, Debug)]
pub enum Error {
    /// Read-only authorization failure (JSON-RPC 403 Forbidden).
    #[error("403 Forbidden: commit_install is disabled in read-only mode (inst.mcp=readonly). A human operator must approve and trigger installation via the Agama Web UI.")]
    ReadOnly,

    /// Unrecoverable response serialization failure (JSON-RPC -32603 Internal Error).
    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),
}

impl From<Error> for ErrorData {
    fn from(err: Error) -> Self {
        match err {
            Error::ReadOnly => ErrorData::new(ErrorCode(403), err.to_string(), None),
            Error::Json(e) => ErrorData::internal_error(e.to_string(), None),
        }
    }
}

impl IntoCallToolResult for Error {
    fn into_call_tool_result(self) -> Result<CallToolResponse, ErrorData> {
        Err(self.into())
    }
}
