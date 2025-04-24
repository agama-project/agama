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

//! Implements the store for the security settings.

use super::{settings::SecuritySettings, SecurityHTTPClient, SecurityHTTPClientError};
use crate::base_http_client::BaseHTTPClient;

#[derive(Debug, thiserror::Error)]
#[error("Error processing security settings: {0}")]
pub struct SecurityStoreError(#[from] SecurityHTTPClientError);

type SecurityResult<T> = Result<T, SecurityStoreError>;

/// Loads and stores the security settings from/to the HTTP API.
pub struct SecurityStore {
    security_client: SecurityHTTPClient,
}

impl SecurityStore {
    pub fn new(client: BaseHTTPClient) -> SecurityResult<SecurityStore> {
        Ok(Self {
            security_client: SecurityHTTPClient::new(client),
        })
    }

    pub async fn load(&self) -> SecurityResult<SecuritySettings> {
        let fingerprints = self.security_client.get_ssl_fingerprints().await?;
        let opt_fps = if fingerprints.is_empty() {
            None
        } else {
            Some(fingerprints)
        };
        Ok(SecuritySettings {
            ssl_certificates: opt_fps,
        })
    }

    pub async fn store(&self, settings: &SecuritySettings) -> SecurityResult<()> {
        if let Some(fingerprints) = &settings.ssl_certificates {
            self.security_client
                .set_ssl_fingerprints(fingerprints)
                .await?
        }
        Ok(())
    }
}
