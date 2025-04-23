// Copyright (c) [2025] SUSE LLC
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

use crate::{base_http_client::BaseHTTPClient, error::ServiceError};

use super::model::SSLFingerprint;

pub struct SecurityHTTPClient {
    client: BaseHTTPClient,
}

impl SecurityHTTPClient {
    pub fn new(base: BaseHTTPClient) -> Self {
        Self { client: base }
    }

    pub async fn get_ssl_fingerprints(&self) -> Result<Vec<SSLFingerprint>, ServiceError> {
        self.client.get("/security/ssl_fingerprints").await
    }

    pub async fn set_ssl_fingerprints(
        &self,
        fps: &Vec<SSLFingerprint>,
    ) -> Result<(), ServiceError> {
        self.client
            .put_void("/security/ssl_fingerprints", fps)
            .await
    }
}
