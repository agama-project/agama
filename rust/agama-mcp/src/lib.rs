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

//! Model Context Protocol (MCP) server for Agama installer using the official `rmcp` SDK.
//!
//! This crate implements an embedded MCP server exposing Agama's hardware probe,
//! configuration validation, installation proposal, installation execution,
//! progress monitoring, and log retrieval capabilities as standardized AI tools.

pub mod error;
pub mod logs;
pub mod mode;
pub mod server;
pub mod tools;
pub mod web;

pub use error::{BackendError, Error, SchemaError, ValidationError};
pub use mode::{McpMode, ModeParseError};
pub use server::{McpBackend, McpServer};
pub use web::mcp_router;
