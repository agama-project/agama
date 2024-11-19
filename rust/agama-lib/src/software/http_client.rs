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
use crate::software::model::SoftwareConfig;
use std::collections::HashMap;

use super::model::{ResolvableParams, ResolvableType};

pub struct SoftwareHTTPClient {
    client: BaseHTTPClient,
}

impl SoftwareHTTPClient {
    pub fn new(base: BaseHTTPClient) -> Self {
        Self { client: base }
    }

    pub async fn get_config(&self) -> Result<SoftwareConfig, BaseHTTPClientError> {
        self.client.get("/software/config").await
    }

    pub async fn set_config(&self, config: &SoftwareConfig) -> Result<(), BaseHTTPClientError> {
        // FIXME: test how errors come out:
        // unknown pattern name,
        // D-Bus client returns
        //            Err(ServiceError::UnknownPatterns(wrong_patterns))
        // CLI prints:
        // Anyhow(Backend call failed with status 400 and text '{"error":"Agama service error: Failed to find these patterns: [\"no_such_pattern\"]"}')
        self.client.put_void("/software/config", config).await
    }

    /// Returns the ids of patterns selected by user
    pub async fn user_selected_patterns(&self) -> Result<Vec<String>, BaseHTTPClientError> {
        // TODO: this way we unnecessarily ask D-Bus (via web.rs) also for the product and then ignore it
        let config = self.get_config().await?;

        let Some(patterns_map) = config.patterns else {
            return Ok(vec![]);
        };

        let patterns: Vec<String> = patterns_map
            .into_iter()
            .filter_map(|(name, is_selected)| if is_selected { Some(name) } else { None })
            .collect();

        Ok(patterns)
    }

    /// Selects patterns by user
    pub async fn select_patterns(
        &self,
        patterns: HashMap<String, bool>,
    ) -> Result<(), BaseHTTPClientError> {
        let config = SoftwareConfig {
            product: None,
            // TODO: SoftwareStore only passes true bools, false branch is untested
            patterns: Some(patterns),
        };
        self.set_config(&config).await
    }

    /// Sets a resolvable list
    pub async fn set_resolvables(
        &self,
        name: &str,
        r#type: ResolvableType,
        names: &[&str],
        optional: bool,
    ) -> Result<(), BaseHTTPClientError> {
        let path = format!("/software/resolvables/{}", name);
        let options = ResolvableParams {
            names: names.iter().map(|n| n.to_string()).collect(),
            r#type,
            optional,
        };
        self.client.put_void(&path, &options).await?;
        Ok(())
    }
}
