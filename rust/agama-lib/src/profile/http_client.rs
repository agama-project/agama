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

use crate::http::BaseHTTPClient;
use crate::profile::ValidationOutcome;
use fluent_uri::Uri;
use serde::Serialize;
use std::collections::HashMap;

pub struct ProfileHTTPClient {
    client: BaseHTTPClient,
}

impl ProfileHTTPClient {
    pub fn new(base: BaseHTTPClient) -> Self {
        Self { client: base }
    }

    /// Validate a JSON profile, by doing a HTTP client request.
    pub async fn validate(&self, request: &impl Serialize) -> anyhow::Result<ValidationOutcome> {
        Ok(self.client.post("profile/validate", request).await?)
    }

    /// Evaluate a Jsonnet profile, by doing a HTTP client request.
    /// Return well-formed Agama JSON on success.
    pub async fn from_jsonnet(&self, request: &impl Serialize) -> anyhow::Result<String> {
        let output: Box<serde_json::value::RawValue> =
            self.client.post("profile/evaluate", request).await?;

        Ok(output.to_string())
    }

    /// Process AutoYaST profile (*url* ending with .xml, .erb, or dir/) by doing a HTTP client request.
    /// Note that this client does not act on this *url*, it passes it as a parameter
    /// to our web backend.
    /// Return well-formed Agama JSON on success.
    pub async fn from_autoyast(&self, url: &Uri<String>) -> anyhow::Result<String> {
        let mut map = HashMap::new();

        map.insert(String::from("url"), url.to_string());

        // FIXME: how to escape it?
        let output: Box<serde_json::value::RawValue> =
            self.client.post("/profile/autoyast", &map).await?;
        let config_string = format!("{}", output);
        Ok(config_string)
    }
}
