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

//! Axum HTTP transport integration for Agama MCP using `rmcp` StreamableHttpService.

use crate::server::McpServer;
use axum::Router;
use rmcp::transport::streamable_http_server::{
    session::local::LocalSessionManager, StreamableHttpServerConfig, StreamableHttpService,
};
use std::sync::Arc;

/// Builds and returns the Axum router wrapping the `rmcp` StreamableHttpService.
pub fn mcp_router(server: McpServer) -> Router {
    // Disable host/origin filtering so Agama bare-metal nodes accept MCP requests across any network interface or IP.
    let config = StreamableHttpServerConfig::default()
        .disable_allowed_hosts()
        .disable_allowed_origins();
    let session_manager = Arc::new(LocalSessionManager::default());

    let mcp_service = StreamableHttpService::new(
        move || Ok::<_, std::io::Error>(server.clone()),
        session_manager,
        config,
    );

    Router::new().fallback_service(mcp_service)
}
