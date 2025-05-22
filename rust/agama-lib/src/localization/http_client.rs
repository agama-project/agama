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
use crate::http::{BaseHTTPClient, BaseHTTPClientError};

#[derive(Debug, thiserror::Error)]
pub enum LocalizationHTTPClientError {
    #[error(transparent)]
    HTTP(#[from] BaseHTTPClientError),
}

pub struct LocalizationHTTPClient {
    client: BaseHTTPClient,
}

impl LocalizationHTTPClient {
    pub fn new(base: BaseHTTPClient) -> Self {
        Self { client: base }
    }

    pub async fn get_config(&self) -> Result<LocaleConfig, LocalizationHTTPClientError> {
        Ok(self.client.get("/l10n/config").await?)
    }

    pub async fn set_config(
        &self,
        config: &LocaleConfig,
    ) -> Result<(), LocalizationHTTPClientError> {
        Ok(self.client.patch_void("/l10n/config", config).await?)
    }
}
