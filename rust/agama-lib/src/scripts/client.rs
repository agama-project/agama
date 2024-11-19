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

use crate::base_http_client::{BaseHTTPClient, BaseHTTPClientError};

use super::{Script, ScriptsGroup};

/// HTTP client to interact with scripts.
pub struct ScriptsClient {
    client: BaseHTTPClient,
}

impl ScriptsClient {
    pub fn new(base: BaseHTTPClient) -> Self {
        Self { client: base }
    }

    /// Adds a script to the given group.
    ///
    /// * `script`: script's definition.
    pub async fn add_script(&self, script: Script) -> Result<(), BaseHTTPClientError> {
        self.client.post_void("/scripts", &script).await
    }

    /// Runs user-defined scripts of the given group.
    ///
    /// * `group`: group of the scripts to run
    pub async fn run_scripts(&self, group: ScriptsGroup) -> Result<(), BaseHTTPClientError> {
        self.client.post_void("/scripts/run", &group).await
    }

    /// Returns the user-defined scripts.
    pub async fn scripts(&self) -> Result<Vec<Script>, BaseHTTPClientError> {
        self.client.get("/scripts").await
    }

    /// Remove all the user-defined scripts.
    pub async fn delete_scripts(&self) -> Result<(), BaseHTTPClientError> {
        self.client.delete_void("/scripts").await
    }
}
