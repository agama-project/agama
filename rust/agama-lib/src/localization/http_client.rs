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

use super::model::LocaleConfig;
use crate::base_http_client::{BaseHTTPClient, BaseHTTPClientError};

pub struct LocalizationHTTPClient {
    client: BaseHTTPClient,
}

impl LocalizationHTTPClient {
    pub fn new(base: BaseHTTPClient) -> Result<Self, BaseHTTPClientError> {
        Ok(Self { client: base })
    }

    pub async fn get_config(&self) -> Result<LocaleConfig, BaseHTTPClientError> {
        self.client.get("/l10n/config").await
    }

    pub async fn set_config(&self, config: &LocaleConfig) -> Result<(), BaseHTTPClientError> {
        self.client.patch_void("/l10n/config", config).await
    }
}
