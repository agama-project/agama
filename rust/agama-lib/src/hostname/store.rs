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

//! Implements the store for the hostname settings.

use super::{
    http_client::{HostnameHTTPClient, HostnameHTTPClientError},
    model::HostnameSettings,
};
use crate::base_http_client::BaseHTTPClient;

#[derive(Debug, thiserror::Error)]
#[error("Error processing hostname settings: {0}")]
pub struct HostnameStoreError(#[from] HostnameHTTPClientError);

type HostnameStoreResult<T> = Result<T, HostnameStoreError>;

/// Loads and stores the hostname settings from/to the HTTP service.
pub struct HostnameStore {
    hostname_client: HostnameHTTPClient,
}

impl HostnameStore {
    pub fn new(client: BaseHTTPClient) -> Self {
        Self {
            hostname_client: HostnameHTTPClient::new(client),
        }
    }

    pub async fn load(&self) -> HostnameStoreResult<HostnameSettings> {
        Ok(self.hostname_client.get_config().await?)
    }

    pub async fn store(&self, settings: &HostnameSettings) -> HostnameStoreResult<()> {
        Ok(self.hostname_client.set_config(settings).await?)
    }
}
