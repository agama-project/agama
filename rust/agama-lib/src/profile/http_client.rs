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
use crate::error;

pub struct ProfileHTTPClient {
    client: BaseHTTPClient,
}

impl ProfileHTTPClient {
    pub fn new(base: BaseHTTPClient) -> Self {
        Self { client: base }
    }

    /// Validate a JSON profile, by doing a HTTP client request.
    pub async fn validate(
        &self,
        query: Option<(String, String)>,
        body: String,
    ) -> anyhow::Result<ValidationOutcome> {
        // we use plain text .body instead of .json
        let mut url = self.client
            .base_url
            .join("profile/validate")
            // unwrap OK: joining a parsable constant to a valid Url
            .unwrap();

        if let Some(query) = query {
            url.query_pairs_mut().append_pair(&query.0, &query.1);
        }

        let response = self.client
            .client
            .request(reqwest::Method::POST, url)
            .body(body)
            .send()
            .await?;

        Ok(self.client.deserialize_or_error(response).await?)
    }

    /// Evaluate a Jsonnet profile, by doing a HTTP client request.
    /// Return well-formed Agama JSON on success.
    pub async fn from_jsonnet(
        &self,
        query: Option<(String, String)>,
        body: String
    ) -> anyhow::Result<String> {
        // unwrap OK: joining a parsable constant to a valid Url
        let mut url = self.client
            .base_url
            .join("profile/evaluate")
            .unwrap();

        if let Some(query) = query {
            url.query_pairs_mut().append_pair(&query.0, &query.1);
        }

        // we use plain text .body instead of .json
        let response: Result<reqwest::Response, error::ServiceError> = self.client
            .client
            .request(reqwest::Method::POST, url)
            .body(body)
            .send()
            .await
            .map_err(|e| e.into());

        let output: Box<serde_json::value::RawValue> = self.client.deserialize_or_error(response?).await?;
        Ok(output.to_string())
    }

    /// Process AutoYaST profile (*url* ending with .xml, .erb, or dir/) by doing a HTTP client request.
    /// Note that this client does not act on this *url*, it passes it as a parameter
    /// to our web backend.
    /// Return well-formed Agama JSON on success.
    pub async fn from_autoyast(&self, url: &Uri<String>) -> anyhow::Result<String> {
        // FIXME: how to escape it?
        let api_url = format!("/profile/autoyast?url={}", url);
        let output: Box<serde_json::value::RawValue> = self.client.post(&api_url, &()).await?;
        let config_string = format!("{}", output);
        Ok(config_string)
    }
}
